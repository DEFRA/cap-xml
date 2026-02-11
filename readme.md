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
| CPX_REDIS_HOST     | Redis/Elasticache host|    yes   |                       |       |
| CPX_REDIS_PORT     | Redis/Elasticache port|    yes   |                       |       |
| CPX_REDIS_TLS      | Redis/Elasticache tls |    yes   |                       |       |
| CPX_METEOALARM_API_URL      | Meteoalarm url |    yes   |                       |       |
| CPX_METEOALARM_API_USERNAME      | Meteoalarm username |    yes   |                       |       |
| CPX_METEOALARM_API_PASSWORD      | Meteoalarm password |    yes   |                       |       |

## Prerequisites

- **Node.js 22** or higher

## Installing

`npm ci --ignore-scripts`

## Running Unit Tests

`npm test`

### Local Development

#### Local Development Prerequisites

- Docker 28.02 or above
- Docker Compose 2.34 or above

Containerisation is used to provide developers with the ability to develop, run and debug AWS Lambda functions without reliance on deployment to AWS infrastructure. This replaces [Serverless local function invocation](https://www.serverless.com/framework/docs/providers/aws/cli-reference/invoke-local) following Serverless V.3 reaching end of support and a decision not to [upgrade to Serverless V.4](https://wb.serverless.com/framework/docs-guides-upgrading-v4).

#### Local Development Options

- [Local Development Quickstart Using Visual Studio Code Development Containers](docs/local-development/dev-container/setup-and-teardown.md)
- [Configuring And Running A Local Development Environment Manually](docs/local-development/manual-configuration/setup-and-teardown.md)

## Contributing to this project

If you have an idea you'd like to contribute please log an issue.

All contributions should be submitted via a pull request.

## License

Copyright, Environment Agency. Licensed under Creative Commons BY 4.0
