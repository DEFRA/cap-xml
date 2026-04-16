# CAP-XML Release 4.0.1 - Tuesday, 28th April 2026

## Information
Hotfix update: 4.0.1 - axios v 1.15.0 installation due to critical vulnerability


## Branches

The branches for this release are rc-4.0.1 for cap-xml (https://github.com/DEFRA/cap-xml/tree/rc-4.0.1) and master for cap-xml-db (https://github.com/DEFRA/cap-xml-db)
 
## Tickets

Tickets linked to the release in Jira: [https://eaflood.atlassian.net/projects/NI/versions/27929/tab/release-report-all-issues](https://eaflood.atlassian.net/projects/NI/versions/27929/tab/release-report-all-issues)

## Instructions

Following environment variables need to be made available to the cap-xml lambda service, REDIS values to be supplied by webops and METEOALARM values to be supplied by devs:

```
CPX_REDIS_HOST=
CPX_REDIS_PORT=
CPX_REDIS_TLS=true
CPX_METEOALARM_API_URL=
CPX_METEOALARM_API_USERNAME=
CPX_METEOALARM_API_PASSWORD=
CPX_METEOALARM_DISABLE=false
```

CCOE Deployment steps:
- Deploy redis
- Deploy SSM parameters
- Deploy _01_UPDATE_DATABASE - (use master branch for cap-xml-db repository)
- Deploy _02_DEPLOY_API_LAMBDA - MODULE_DEPLOY=api_gateways and use branch rc-4.0.0 for cap-xml repository
- Deploy _02_DEPLOY_API_LAMBDA - MODULE_DEPLOY=lambda and use branch rc-4.0.0 for cap-xml repository


Confirm deployment with the flood dev and test team.

