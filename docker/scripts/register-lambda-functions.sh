#!/bin/sh
# This script MUST be called from ${containerWorkspace Folder}.
# See https://containers.dev/implementors/json_reference/.
set -e

lambda_functions_dir="lib/functions"
deployed_cpx_agw_url=http://$(awslocal apigateway get-rest-apis | jq -r ".items[0].id").execute-api.localhost.localstack.cloud:4566/local

# Prepare a comma separated list of custom environment variables required by
# each Lambda function.
cpx_db_username=$(echo CPX_DB_USERNAME=$CPX_DB_USERNAME)
cpx_db_password=$(echo CPX_DB_PASSWORD=$CPX_DB_PASSWORD)
cpx_db_name=$(echo CPX_DB_NAME=$CPX_DB_NAME)
cpx_db_host=$(echo CPX_DB_HOST=$CPX_DB_HOST)
cpx_agw_url=$(echo CPX_AGW_URL=$deployed_cpx_agw_url)
cpx_redis_host=$(echo CPX_REDIS_HOST=$CPX_REDIS_HOST)
cpx_redis_port=$(echo CPX_REDIS_PORT=$CPX_REDIS_PORT)
cpx_redis_tls=$(echo CPX_REDIS_TLS=$CPX_REDIS_TLS)
cpx_meteoalarm_api_url=$(echo CPX_METEOALARM_API_URL=$CPX_METEOALARM_API_URL)
cpx_meteoalarm_api_username=$(echo CPX_METEOALARM_API_USERNAME=$CPX_METEOALARM_API_USERNAME)
cpx_meteoalarm_api_password=$(echo CPX_METEOALARM_API_PASSWORD=$CPX_METEOALARM_API_PASSWORD)
cpx_meteoalarm_disable=$(echo CPX_METEOALARM_DISABLE=$CPX_METEOALARM_DISABLE)
node_tls_reject_unauthorized=$(echo NODE_TLS_REJECT_UNAUTHORIZED=$NODE_TLS_REJECT_UNAUTHORIZED)
set -- $cpx_db_username $cpx_db_password $cpx_db_name $cpx_db_host $cpx_agw_url $cpx_redis_host $cpx_redis_port $cpx_redis_tls $cpx_meteoalarm_api_url $cpx_meteoalarm_api_username $cpx_meteoalarm_api_password $node_tls_reject_unauthorized $cpx_meteoalarm_disable
custom_environment_variables=$(printf '%s,' "$@" | sed 's/,*$//g')

# Iterate over each file in lambda_functions_dir
find "$lambda_functions_dir" -type f -name "*.js" | while read -r lambda_function; do
  if [ -f "$lambda_function" ]; then
      relative_path="${lambda_function#$lambda_functions_dir/}"
      dir_prefix=$(dirname "$relative_path")
      function_name=$(basename "$lambda_function" .js)
      handler_path="lib/functions/$function_name.$function_name"  # default

      # If the directory matches v{number}, update function name and handler path
      case "$dir_prefix" in
        v[0-9]*)
          handler_path="lib/functions/$dir_prefix/$function_name.$function_name"
          function_name="${function_name}_${dir_prefix}"
          ;;
        *)
          echo "No version prefix"
          ;;
      esac

      echo Registering $function_name with LocalStack

      awslocal lambda create-function \
        --function-name "$function_name" \
        --code S3Bucket="hot-reload",S3Key="$(pwd)/" \
        --runtime nodejs${NODEJS_VERSION}.x \
        --timeout $LAMBDA_TIMEOUT \
        --role arn:aws:iam::000000000000:role/lambda-role \
        --handler "$handler_path" \
        --environment "Variables={$custom_environment_variables}" \
        --no-cli-pager
      sleep 1

  fi
done

echo "All Lambda functions have been registered with LocalStack."

awslocal lambda create-function-url-config --function-name archiveMessages --auth-type NONE

echo "Created function URL config for archiveMessages function"

echo Function URL for archiveMessages is $(awslocal lambda get-function-url-config --function-name archiveMessages | jq -r .FunctionUrl)
echo  API Gateway root URL is http://$(awslocal apigateway get-rest-apis | jq -r ".items[0].id").execute-api.localhost.localstack.cloud:4566/local

