# Development Container Setup

A [development container](https://code.visualstudio.com/docs/remote/containers) automates a number of setup activities required for a functioning local development environment such as:

* Configuration of additional operating system package repositories.
* Installation of additional operating system packages.
* Addition of Visual Studio Code extensions.
* CAP XML database creation and reference data population using a containerised Postgres instance.
* Use of a [containerised Postgres Graphical User Interface](https://www.pgadmin.org/download/pgadmin-4-container/)
  for performing database operations.
* [Floci](https://floci.io/) AWS API Gateway and AWS Lambda
  provisioning to facilitate local running of CAP XML calls without round tripping
  to AWS infrastructure.
  * The AWS CLI (configured with the **AWS_ENDPOINT_URL** environment variable pointing at Floci) is
    used during provisioning and can also be used at runtime.
* Runtime environment variable configuration.
  * Configuration generation providing connectivity to local development environment resources.

Development containers are based on [Docker outside Of Docker Compose](https://github.com/devcontainers/templates/tree/main/src/docker-outside-of-docker-compose).

Development containers run as an unprivileged **vscode** user with passwordless sudo access.

The development environment as code approach ensures that all developers utilise a common development environment without having to follow detailed setup instructions that could be erroneous, incomplete or followed incorrectly.

If an existing local development environment has been configured manually **it is recommended that a backup of it is created before proceeding**.

## Contents

* [Prerequisites](./prerequisites.md)
* [Local Repository Creation](./local-repository-creation.md)
* [Workspace Folder Configuration](./workspace-folder-configuration.md)
  * **Not** applicable when using Windows with non-systemd enabled WSL 2 currently.
* [Rootless Docker Configuration](./rootless-docker-configuration.md)
  * **Only** applicable when using native Linux or systemd enabled WSL 2 with native Docker.
* [Dev Container Creation](./dev-container-creation.md)
* [Running AWS Lambda Functions](../common/running-and-debugging-lambda-functions.md)
* [Troubleshooting](../common/troubleshooting.md)
* [Teardown](../common/teardown.md)
* [Additional Development Container Considerations](./additional-dev-container-considerations.md)
