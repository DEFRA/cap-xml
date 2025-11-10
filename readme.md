# CAP-XML Services

![Build status](https://github.com/DEFRA/cap-xml/actions/workflows/ci.yml/badge.svg)[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_cap-xml&metric=alert_status)](https://sonarcloud.io/dashboard?id=DEFRA_cap-xml)[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_cap-xml&metric=coverage)](https://sonarcloud.io/dashboard?id=DEFRA_cap-xml)

## Synopsis

This project provides CAP XML services through the use of AWS Lambda.

## Environment Variables

| name               | description           | required |        default        | notes |
|--------------------|-----------------------|:--------:|-----------------------|-------|
| stage              | AWS stage             |    yes   |                       |       |
| CPX_REGION         | AWS region            |    yes   |                       |       |
| CPX_DB_USERNAME    | Database username     |    yes   |                       |       |
| CPX_DB_PASSWORD    | Database password     |    yes   |                       |       |
| CPX_DB_NAME        | Database name         |    yes   |                       |       |
| CPX_DB_HOST        | Database host         |    yes   |                       |       |
| CPX_AGW_URL        | API Gateway URL       |    yes   |                       |       |

## Prerequisites

- **Node.js 20** or higher

## Installing

`npm install`

## Running Unit Tests

`npm test`

### Running / Debugging Lambdas Locally

Following Serverless V.3 reaching end of support and a decision not to [upgrade to Serverless V.4](https://wb.serverless.com/framework/docs-guides-upgrading-v4), running / debugging Lambdas is **not** supported temporarily.
Alternative technlogies will be used to provide this functionality as soon as possible

## Contributing to this project

If you have an idea you'd like to contribute please log an issue.

All contributions should be submitted via a pull request.

## License

Copyright, Environment Agency. Licensed under Creative Commons BY 4.0
