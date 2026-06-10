# CAP-XML Release 4.1.0 - Thursday, 18/06/2026

## Information
Minor release 4.1.0

Including
- Node v24 update
- Fortigate deployment

## Branches

The branches for this release are rc-4.1.0 for cap-xml (https://github.com/DEFRA/cap-xml/tree/rc-4.1.0)
 
## Tickets

Tickets linked to the release in Jira: [https://eaflood.atlassian.net/projects/NI/versions/37344/tab/release-report-all-issues](https://eaflood.atlassian.net/projects/NI/versions/37344/tab/release-report-all-issues)

## Instructions

Special (please note, order and detail may differ from actual process, leave to ccoe):

- Deploy Fortigate settings for production cpx environment, ensuring that the meteoalarm api is whitelisted as per work on development/test environments

- Merge/Update terraform scripts to set lambda node version to 24.x

CCOE Deployment steps:
- Deploy _02_DEPLOY_API_LAMBDA - MODULE_DEPLOY=lambda and use branch rc-4.1.0 for cap-xml repository


Confirm deployment with the flood dev and test team.

