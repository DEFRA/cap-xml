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
    "bodyXml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<alert xmlns=\"urn:oasis:names:tc:emergency:cap:1.2\">\r\n <identifier>4eb3b7350ab7aa443650fc9351f02940E</identifier>\r\n <sender>www.gov.uk/environment-agency</sender>\r\n <sent>2017-05-28T11:00:02-00:00</sent>\r\n <status>Actual</status>\r\n <msgType>Alert</msgType>\r\n <source>Flood warning service</source>\r\n <scope>Public</scope>\r\n <info>\r\n <language>en-GB</language>\r\n <category>Met</category>\r\n <event><![CDATA[064 Issue Flood Alert EA]]></event>\r\n <urgency>Immediate</urgency><area><geocode><valueName>TargetAreaCode</valueName><value><![CDATA[064WAF33Hogsmill]]></value></geocode></area></info></alert>"
}`

### Then run debug through VSC selecting the above config and it will hit the function with the above arguments


## Deployment

`serverless deploy -v`

## Contributing to this project

If you have an idea you'd like to contribute please log an issue.

All contributions should be submitted via a pull request.

## License

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

>Contains public sector information licensed under the Open Government license v3

### About the license

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable information providers in the public sector to license the use and re-use of their information under a common open licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.

