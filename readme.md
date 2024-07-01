[![Build Status](https://travis-ci.org/DEFRA/cap-xml.svg?branch=master)](https://travis-ci.org/DEFRA/cap-xml)[![Maintainability](https://api.codeclimate.com/v1/badges/e6e726f97cd31b8569fa/maintainability)](https://codeclimate.com/github/DEFRA/cap-xml/maintainability)[![Test Coverage](https://api.codeclimate.com/v1/badges/e6e726f97cd31b8569fa/test_coverage)](https://codeclimate.com/github/DEFRA/cap-xml/test_coverage)

# CAP-XML Services

## Synopsis

This project is a serverless implementation to provide CAP XML services, through the use of AWS Lambda.

## Installing

### There is a global dependency on [serverless](https://serverless.com/) which is used for configuration and deployments to AWS
`npm i -g serverless`

`npm install`

## Configuration files

## Local debug test

The project can be debugged locally through visual studio code

See example <https://hackernoon.com/running-and-debugging-aws-lambda-functions-locally-with-the-serverless-framework-and-vs-code-a254e2011010>

### first install serverless as a dependency
`npm i serverless`
### add launch.json config as follows:
```
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "node",
            "request": "launch",
            "name": "run processMessage function",
            "program": "${workspaceRoot}/node_modules/.bin/sls",
            "args": [
                "invoke",
                "local",
                "-f",
                "processMessage",
                "--path",
                "./config/cap.json"
            ]
        },
        {
            "type": "node",
            "request": "launch",
            "name": "Launch Program",
            "program": "${workspaceRoot}/handler.js"
        }
    ]
}
```
### Add an example json object to be used in the function's event, stored in `./config/cap.json` above.

eg: `{
    "bodyXml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<alert xmlns=\"urn:oasis:names:tc:emergency:cap:1.2\">\r\n <identifier>4eb3b7350ab7aa443650fc9351f02940E</identifier>\r\n <sender>www.gov.uk/environment-agency</sender>\r\n <sent>2017-05-28T11:00:02-00:00</sent>\r\n <status>Actual</status>\r\n <msgType>Alert</msgType>\r\n <source>Flood warning service</source>\r\n <scope>Public</scope>\r\n <info>\r\n <language>en-GB</language>\r\n <category>Met</category>\r\n <event><![CDATA[064 Issue Flood Alert EA]]></event>\r\n <urgency>Immediate</urgency><expires>2022-09-20T11:00:02-00:00</expires><area><geocode><valueName>TargetAreaCode</valueName><value><![CDATA[TESTAREA1]]></value></geocode></area></info></alert>"
}`

### Then run debug through VSC selecting the above config and it will hit the function with the above arguments


## Deployment

`npm run deploy`

## Contributing to this project

If you have an idea you'd like to contribute please log an issue.

All contributions should be submitted via a pull request.

## License

Copyright, Environment Agency. Licensed under Creative Commons BY 4.0
