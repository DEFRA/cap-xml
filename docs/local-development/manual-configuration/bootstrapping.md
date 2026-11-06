# Bootstrapping

## Mandatory Environment Variables

| name | description |
|------|-------------|
| LOCAL_CAP_XML_DIR | The **absolute** path to the root of a local cap-xml repository. |
| DOCKER_SOCK | (Optional) absolute path to docker.sock for rootless installation, defaults to /run/user/1000/docker.sock

## Run Bootstrap Script

* Run the bootstrap-debug npm script from the repository root.

   ```sh
   npm run bootstrap-debug
   ```

  * The npm script runs [non-dev-container-bootstrap.sh](../../../docker/scripts/non-dev-container-bootstrap.sh)
    which performs the following activities:
    * Set required environment variables using the [Docker .env file](../../../docker/.env).
    * Docker named volume creation.
    * Docker custom network creation.
    * Container creation:
      * Floci.
      * Postgres database.
      * Pgadmin4.
      * Liquibase.
        * Changesets are run to create the containerised Postgres database structure.
    * AWS Lambda function registration with Floci.
    * AWS API Gateway registration with Floci.
    * Configuration generation providing connectivity to local development environment resources.
    * Liquibase container removal.
