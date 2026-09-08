# Running AWS Lambda Functions

## Step Debugging Is Not Currently Supported

**WARNING** - Step debugging of AWS Lambda functions in the local development environment is **not currently
supported under Floci**. It was previously possible under LocalStack and was lost when the local development
environment moved to Floci.

LocalStack supported a **LAMBDA_DOCKER_FLAGS** environment variable, which this project used to pass
`-e NODE_OPTIONS=--inspect-brk=0.0.0.0:9229 -p 9229:9229` to each Lambda container so that the Visual Studio Code
debugger could attach to the standard Node.js debug port. Floci provides no equivalent - it has no mechanism for
injecting arbitrary Docker flags or environment variables into the containers it spawns for Lambda functions, so
neither the inspector nor the published debug port can be enabled.

Floci also starts a **fresh container for every invocation** (see [Container Lifecycle](#container-lifecycle) below),
so even if the inspector could be enabled, the debugger would need to reattach on every single request.

In the meantime:

* Unit tests can still be debugged with the Visual Studio Code **debug unit tests** configuration.
* Lambda function behaviour can be inspected at runtime using container logs, for example
  `docker logs <<LAMBDA-CONTAINER-NAME>>`, and by adding logging to the function under investigation.

## Invoking AWS Lambda Functions

From within the development container, use the AWS CLI (configured with the **AWS_ENDPOINT_URL** environment variable pointing at Floci) to retrieve the identifier of the deployed REST API from the API Gateway. For example, the command below can be used when an initial attempt to create a containerised development environment succeeds (resulting in the creation of one REST API instance)

```sh
aws apigateway get-rest-apis | jq -r '.items[0].id'
```

IMPORTANT

In the following examples of invoking Lambda functions through API Gateway endpoints:

* Angled bracket based placeholders such as **&lt;&lt;REST-API-ID&gt;&gt;** placeholder **must** be replaced.
* For convenience, Floci is configured not to require an API key when calling API Gateway endpoints.

### Loading dummy data

There is a helper script to upload 10 dummy messages to the development environment. This can be executed after the local development environment has been bootstrapped.

```sh
npm run load-dummy-data
```

### Making A HTTP GET Request To The /messages.atom Endpoint

Use the REST API identifier to call the **/messages.atom** endpoint linked to the **getMessagesAtom** AWS Lambda function. For example, the following curl command can be used:

```sh
curl "http://localhost:4566/restapis/<<REST-API-ID>>/local/_user_request_/messages.atom"
```

### Making A HTTP GET Request To The /message Endpoint

Use the REST API identifier to call the **/message/&lt;&lt;MESSAGE-ID&gt;&gt;** endpoint linked to the **getMessage** AWS Lambda function. For example, the following curl command can be used:

```sh
curl "http://localhost:4566/restapis/<<REST-API-ID>>/local/_user_request_/message/<<MESSAGE-ID>>"
```

### Making A HTTP POST To The /message Endpoint

AWS API Gateway request templates are used to ensure XML message content is embedded within AWS Lambda JSON event objects.
Real AWS API Gateway software appears capable of embedding raw XML within AWS Lambda JSON event objects without further configuration.
The configured Floci API Gateway integration requires raw XML message content to be embedded as a string
within a JSON document and slightly different request templates to be able to provide the AWS Lambda function with an event object reflecting that received from real AWS API Gateway software. For example, real AWS API Gateway software appears capable of handling raw XML
such as the following:

```sh
<xml>
  <element>content</element>
</xml>
```

The configured Floci API Gateway integration requires a JSON structure such as the following for Lambda functions to receive an event object
consistent with that received from real AWS API Gateway software.

```sh
{
  "message": "<xml><element>content</element></xml>"
}
```

The following command can be used as a guide to making a HTTP POST request to the **/message** endpoint using **curl**:

```sh
curl -H "Content-Type: text/xml" -d "@<</path/to/message/file>>" "http://localhost:4566/restapis/<<REST-API-ID>>/local/_user_request_/message"
```

IMPORTANT

* The request header **Content-Type: text/xml** or **Content-Type: text/html** **must** be used to ensure correct processing by the Floci API Gateway request template.

### Invoking The archiveMessages AWS Lambda Function

This function is not invoked through an API Gateway endpoint and needs to be invoked using an AWS Lambda Function URL locally.
An AWS Lambda Function URL is created and output during local environment provisioning. The URL can be retrieved using the following command:

```sh
aws lambda get-function-url-config --function-name archiveMessages | jq -r .FunctionUrl
```

The AWS Lambda Function URL can be used with a suitable HTTP client such as curl. For example, the following command can be used in a Linux environment:

```sh
curl $(aws lambda get-function-url-config --function-name archiveMessages | jq -r .FunctionUrl)
```

## Making Code Changes

Lambda functions are registered with Floci in bind-mount hot-reload mode, so code changes are picked up without
having to redeploy. The repository working directory is mounted into each Lambda container at **/var/task**, meaning
every invocation runs the files exactly as they currently exist on disk.

## Container Lifecycle

Hot-reload containers are **always ephemeral**. Floci starts a fresh container for **every invocation** and removes it
once the invocation completes, which is what guarantees the next invocation sees the current state of the directory.

This means:

* There is no warm container reuse, so every request pays a cold start penalty. End to end functional tests are
  correspondingly slower than they would be against warm containers.
* This is inherent to hot-reload mode rather than a misconfiguration. Setting **FLOCI_SERVICES_LAMBDA_EPHEMERAL** to
  false does **not** change it, because hot-reload overrides that setting. Warm container reuse would require giving up
  hot-reload and deploying function code as a ZIP instead.

The invocation timeout for a Lambda function is specified by the LAMBDA_TIMEOUT environment variable within
[the Docker environment variable file](../../../docker/.env), which the registration script passes to Floci as the
function **--timeout**.

## Known Issues

**NOTE** - The issues below were originally observed under LocalStack and have not yet been re-verified against Floci; treat them as unconfirmed until retested.

* Calls to the **getMessagesAtom** and **getMessage** API Gateway endpoints return a Content-Type HTTP response header of **text/plain** rather than **application/xml** returned by calls to AWS API Gateway endpoints. This affects markup formatting in browsers.
* When running/debugging in a development container created by cloning the repository into a container volume, calls to  **getMessagesAtom** return XML content containing incorrect URLs that use the REST API ID configured on the host machine rather than the REST API ID configured in the development container.
  * To workaround this issue, ensure that the url attribute within config/config.json on the host machine matches that configured in the development container.
