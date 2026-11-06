#!/bin/sh
# This script MUST be called from ${containerWorkspace Folder}.
# See https://containers.dev/implementors/json_reference/.
set -e

. docker/scripts/set-local-aws-environment.sh

main() {
  # Reference - https://docs.aws.amazon.com/cli/latest/reference/apigateway/
  echo "Creating API Gateway"
  echo $AWS_ENDPOINT_URL

  cap_xml_rest_api_id=$(aws --endpoint-url "$AWS_ENDPOINT_URL" apigateway create-rest-api --name "CPX API Gateway" | jq -r '.id')
  cap_xml_rest_api_root_resource_id=$(aws --endpoint-url "$AWS_ENDPOINT_URL" apigateway get-resources --rest-api-id "$cap_xml_rest_api_id" | jq -r '.items[] | select(.path == "/") | .id')
  lambda_functions_dir="lib/functions"

  find "$lambda_functions_dir" -type f -name "*.js" | while read -r lambda_function; do
    relative_path="${lambda_function#$lambda_functions_dir/}"
    dir_prefix=$(dirname "$relative_path")
    lambda_function_name=$(basename "$lambda_function" .js)
    http_method=$(get_http_method $lambda_function_name)
    
    case "$dir_prefix" in
      v[0-9]*)
        lambda_function_name="${lambda_function_name}_${dir_prefix}"
        ;;
      *)
        echo "No version prefix"
        ;;
    esac

    if [ $lambda_function_name = "archiveMessages" ]; then
      echo Skipping $lambda_function because it is not accessed through an API Gateway
      continue
    fi
    
    # Convert the Lambda function name from camel case to undersore case to call the correct API gateway registration function.
    $(echo register_api_gateway_support_for_$lambda_function_name | sed -E "s/([a-z0-9])([A-Z])/\1_\2/g; s/([A-Z])([A-Z][a-z])/\1_\2/g" | tr "[:upper:]" "[:lower:]")
    echo "API Gateway support added for $lambda_function_name"

  done

  deployment_id=$(aws --endpoint-url "$AWS_ENDPOINT_URL" apigateway create-deployment \
      --rest-api-id $cap_xml_rest_api_id | jq -r '.id')

  aws --endpoint-url "$AWS_ENDPOINT_URL" apigateway create-stage \
      --rest-api-id $cap_xml_rest_api_id \
      --stage-name local \
      --deployment-id $deployment_id

  echo "Created API Gateway deployment"
  return 0
}

get_http_method() {
  lambda_function_name=$1
  if [ $lambda_function_name = "processMessage" ]; then
    echo POST
  else
    echo GET
  fi
  return 0
}

register_api_gateway_support_for_get_message() {
  get_message_resource_id=$(create_resource $cap_xml_rest_api_root_resource_id  "message")
  message_resource_id=$(create_resource $get_message_resource_id  "{id}")
  put_method_and_integration $message_resource_id
  return 0
}

register_api_gateway_support_for_get_message_v2() {
  if [ -z "$v2_resource_id" ]; then
    v2_resource_id=$(create_resource "$cap_xml_rest_api_root_resource_id" "v2")
  fi
  get_message_v2_resource_id=$(create_resource $v2_resource_id  "message")
  message_v2_resource_id=$(create_resource $get_message_v2_resource_id  "{id}")
  put_method_and_integration $message_v2_resource_id
  return 0
}

register_api_gateway_support_for_get_messages_atom() {
  get_messages_atom_resource_id=$(create_resource $cap_xml_rest_api_root_resource_id  "messages.atom")
  put_method_and_integration $get_messages_atom_resource_id
  return 0
}

register_api_gateway_support_for_get_messages_atom_v2() {
  if [ -z "$v2_resource_id" ]; then
    v2_resource_id=$(create_resource "$cap_xml_rest_api_root_resource_id" "v2")
  fi
  get_messages_atom_v2_resource_id=$(create_resource $v2_resource_id  "messages.atom")
  put_method_and_integration $get_messages_atom_v2_resource_id
  return 0
}

register_api_gateway_support_for_process_message() {
  process_message_resource_id=$(create_resource $cap_xml_rest_api_root_resource_id  "message")
  put_method_and_integration $process_message_resource_id
  return 0
}

create_resource() {
  cap_xml_rest_api_parent_resource_id=$1
  cap_xml_rest_api_path_part=$2

  # A resource with the same parent and path part may already have been created
  # by another lambda function (e.g. GET /message/{id} and POST /message share /message).
  existing_resource_id=$(aws --endpoint-url "$AWS_ENDPOINT_URL" apigateway get-resources \
    --rest-api-id $cap_xml_rest_api_id \
    | jq -r --arg parent "$cap_xml_rest_api_parent_resource_id" --arg path "$cap_xml_rest_api_path_part" \
      '.items[] | select(.parentId == $parent and .pathPart == $path) | .id')

  if [ -n "$existing_resource_id" ]; then
    echo $existing_resource_id
    return 0
  fi

  echo $(aws --endpoint-url "$AWS_ENDPOINT_URL" apigateway create-resource \
    --rest-api-id $cap_xml_rest_api_id \
    --parent-id $cap_xml_rest_api_parent_resource_id \
    --path-part $cap_xml_rest_api_path_part | jq -r '.id')
  return 0
}

put_method_and_integration() {
  resource_id=$1

  aws --endpoint-url "$AWS_ENDPOINT_URL" apigateway put-method \
      --rest-api-id $cap_xml_rest_api_id \
      --resource-id $resource_id \
      --http-method $http_method \
      --authorization-type "NONE" \
      $(get_request_parameters $lambda_function_name)

  put_integration
  return 0
}

get_request_parameters() {
  if [ $lambda_function_name = "getMessage" ]; then
    echo --request-parameters "method.request.path.id=true"
  fi
  return 0
}

put_integration() {

  # Due to unresolved shell expansion issues integration request templates need to be hardcoded rather than being returned 
  # by a function. This results in some duplication.

  case $lambda_function_name in
    getMessage|getMessage_v2)
      aws --endpoint-url "$AWS_ENDPOINT_URL" apigateway put-integration \
        --rest-api-id $cap_xml_rest_api_id \
        --resource-id $resource_id \
        --http-method $http_method \
        --type AWS \
        --integration-http-method POST \
        --uri arn:aws:apigateway:eu-west-2:lambda:path/2015-03-31/functions/arn:aws:lambda:eu-west-2:000000000000:function:$lambda_function_name/invocations \
        --passthrough-behavior WHEN_NO_TEMPLATES \
        --content-handling CONVERT_TO_TEXT \
        --request-templates '{"application/json": "{\"pathParameters\": { \"id\": \"$input.params(\"id\")\"}}", "application/xml" : "#set($inputRoot = $input.path(\"$\"))\n$inputRoot.body"}'

      put_responses_for_get_message
      ;;
    getMessagesAtom|getMessagesAtom_v2)
      aws --endpoint-url "$AWS_ENDPOINT_URL" apigateway put-integration \
        --rest-api-id $cap_xml_rest_api_id \
        --resource-id $resource_id \
        --http-method $http_method \
        --type AWS \
        --integration-http-method POST \
        --uri arn:aws:apigateway:eu-west-2:lambda:path/2015-03-31/functions/arn:aws:lambda:eu-west-2:000000000000:function:$lambda_function_name/invocations \
        --passthrough-behavior WHEN_NO_MATCH \
        --content-handling CONVERT_TO_TEXT

      put_responses_for_get_messages_atom
      ;;
    processMessage)
      aws --endpoint-url "$AWS_ENDPOINT_URL" apigateway put-integration \
        --rest-api-id $cap_xml_rest_api_id \
        --resource-id $resource_id \
        --http-method $http_method \
        --type AWS \
        --integration-http-method POST \
        --uri arn:aws:apigateway:eu-west-2:lambda:path/2015-03-31/functions/arn:aws:lambda:eu-west-2:000000000000:function:$lambda_function_name/invocations \
        --passthrough-behavior WHEN_NO_TEMPLATES \
        --content-handling CONVERT_TO_TEXT \
        --request-templates '{
            "text/html": "{\"bodyXml\": \"$util.escapeJavaScript($input.body)\"}",
            "text/xml": "{\"bodyXml\": \"$util.escapeJavaScript($input.body)\"}"
          }'


      put_responses_for_process_message
      ;;
    *)
      echo "Unable to configure integration for unexpected function $lambda_function_name"
      ;;
  esac

  return 0
}

put_method_response_for_http_200_status_code() {
  # Due to unresolved shell expansion issues integration response models need to be hardcoded rather than being returned
  # by a function. This results in some duplication.
  case $lambda_function_name in
    getMessage|getMessagesAtom)
      aws --endpoint-url "$AWS_ENDPOINT_URL" apigateway put-method-response \
        --rest-api-id $cap_xml_rest_api_id \
        --resource-id $resource_id \
        --http-method $http_method \
        --status-code 200 \
        --response-models '{"application/xml": "Empty"}'
      ;;
    processMessage)
      aws --endpoint-url "$AWS_ENDPOINT_URL" apigateway put-method-response \
        --rest-api-id $cap_xml_rest_api_id \
        --resource-id $resource_id \
        --http-method $http_method \
        --status-code 200 \
        --response-models '{"application/json": "Empty"}'
      ;;
    *)
      echo "Unable to configure method response for unexpected function $lambda_function_name"
      ;;
  esac
  return 0
}

put_responses_for_get_message() {
  
  # Due to unresolved shell expansion issues integration response templates need to be hardcoded rather than being returned 
  # by a function. This results in some duplication.

  put_responses_for_http_200_get

  aws --endpoint-url "$AWS_ENDPOINT_URL" apigateway put-integration-response \
    --rest-api-id $cap_xml_rest_api_id \
    --resource-id $resource_id \
    --http-method $http_method \
    --status-code 404 \
    --selection-pattern 'No message found' \
    --response-parameters '{"method.response.header.content-type": "integration.response.header.content-type"}' \
    --response-templates  '{"application/json": "{\"errorMessage\": $input.json(\"$.errorMessage\")}"}'

  put_integration_response_for_http_500
  return 0
}

put_responses_for_get_messages_atom() {
  put_responses_for_http_200_get
  put_integration_response_for_http_500
  return 0
}

put_responses_for_process_message() {
  aws --endpoint-url "$AWS_ENDPOINT_URL" apigateway put-integration-response \
    --rest-api-id $cap_xml_rest_api_id \
    --resource-id $resource_id \
    --http-method $http_method \
    --status-code 200

  put_method_response_for_http_200_status_code
  put_integration_response_for_http_500
  return 0
}

put_responses_for_http_200_get() {

  put_method_response_for_http_200_status_code

  aws --endpoint-url "$AWS_ENDPOINT_URL" apigateway put-integration-response \
    --rest-api-id $cap_xml_rest_api_id \
    --resource-id $resource_id \
    --http-method $http_method \
    --status-code 200 \
    --response-parameters '{"method.response.header.content-type": "integration.response.body.headers.content-type"}' \
    --response-templates '{"application/xml" : "#set($inputRoot = $input.path(\"$\"))\n$inputRoot.body"}'
  return 0
}

put_integration_response_for_http_500() {

  aws --endpoint-url "$AWS_ENDPOINT_URL" apigateway put-integration-response \
    --rest-api-id $cap_xml_rest_api_id \
    --resource-id $resource_id \
    --http-method $http_method \
    --status-code 500 \
    --response-parameters '{"method.response.header.content-type": "integration.response.body.headers.content-type"}' \
    --response-templates '{"application/json": "{\"errorMessage\": $input.json(\"$.errorMessage\")}"}' \
    --selection-pattern '(\n|.)+'
  return 0
}

main "$@"