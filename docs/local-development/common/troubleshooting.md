# Troubleshooting

## Floci Container Fails To Start

* This could be caused by an existing application using the subnet configured for Floci to act as a DNS server (192.168.0.0/24).
  * The configured subnet avoids conflict with Oracle VirtualBox networking.
* If the configured subnet conflicts with another application that cannot be stopped, try changing the networking configuration in the [development container Docker Compose file](../.devcontainer/devcontainer.yml) to use a different subnet (such as 10.0.2.0/24), [teardown](../common/teardown.md) existing development container based resources and create a new development container.

**IMPORTANT** - If cloning the remote repository into a container volume, the configuration change must be pushed to a branch from which the new containerised development environment **must** be created.

### Rootless Docker Connectivity Issues

* The most probable cause is a lack of permissions on the rootless Docker socket.
  * Ensure that rootless Docker is configured correctly:
    * [Rootless Docker based configuration with development containers](../dev-container/rootless-docker-configuration.md)
    * [Rootless Docker based configuration without development containers](../manual-configuration/rootless-docker-configuration.md)

### Lambda Function Step Debugging

* Step debugging of Lambda functions is **not currently supported under Floci** - see
  [Running AWS Lambda Functions](./running-and-debugging-lambda-functions.md#step-debugging-is-not-currently-supported).

### Node.js Module Import Errors

Node.js module import failures occur when code to be run/debugged cannot be located. This results in stack traces such as the following:

```stacktrace
{"errorType":"Runtime.ImportModuleError","errorMessage":"Error: Cannot find module 'processMessage'\nRequire stack:\n- /var/runtime/index.mjs","trace":["Runtime.ImportModuleError: Error: Cannot find module 'processMessage'","Require stack:","- /var/runtime/index.mjs","    at _loadUserApp (file:///var/runtime/index.mjs:1087:17)","    at async UserFunction.js.module.exports.load (file:///var/runtime/index.mjs:1119:21)","    at async start (file:///var/runtime/index.mjs:1282:23)","    at async file:///var/runtime/index.mjs:1288:1"]}
```

#### Development Container Considerations

When used with [Docker outside Of Docker Compose](https://github.com/devcontainers/templates/tree/main/src/docker-outside-of-docker-compose), regardless of how a development container is created, repository contents **must** be available at the same location on the host and in the development container to enable running/debugging development container associated code.

Ensure that the [local cap-xml repository location](../dev-container/local-repository-creation.md) and [workspace folder](../dev-container/workspace-folder-configuration.md) are configured for code to be run/debugged.

### Unsuccessful Resolution Of Problems

If problems persist, prerequisites and associated configuration should be reviewed followed by a [teardown](../common/teardown.md) and rebuild of the containerised development environment. If Floci resources for other projects are present (for example [fws-api](https://github.com/DEFRA/fws-api)), try removing these resources before rebuilding to eliminate potential conflicts.
