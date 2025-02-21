# FWIS App Release - Thursday, 20th February 2025

## Information

This release updates CAP-XML to move from Serverless to Terraform.

## Branches
The branch for this release is release/2.0.0
 
## Tickets

Tickets linked to the release in Jira: [https://eaflood.atlassian.net/projects/NI/versions/20438/tab/release-report-all-issues](https://eaflood.atlassian.net/projects/NI/versions/20438/tab/release-report-all-issues)

## Instructions

Execute jobs:

- `MIGRATION_CX_{stage}_02_DEPLOY_API_LAMBDA`
  - Modules to deploy: `api_gateways` and `lambda`

Confirm deployment with the flood dev and test team.
