# FWIS App Release - Thursday, 13th February 2025

## Information

This release updates CAP-XML to Node v20

## Branches
The branch for this release is release/2.1.0
 
## Tickets

Tickets linked to the release in Jira: [https://eaflood.atlassian.net/projects/NI/versions/20932/tab/release-report-all-issues](https://eaflood.atlassian.net/projects/NI/versions/20932/tab/release-report-all-issues)

## Instructions

 - CCoE WebOps to run ansible playbook to update Node version on CX servers to node v20

 - update prd deploy job(CX_{stage}_02_DEPLOY_LAMBDA) from node 18 to version 20

Execute jobs:

- `MIGRATION_CX_{stage}_02_DEPLOY_API_LAMBDA`
  - Modules to deploy:  `lambda`

Confirm deployment with the flood dev and test team.
