#!/bin/sh

set -e

# The macOS version of realpath does not support the -m switch so the GNU version
# is needed.
if [ $(uname) = "Darwin" ] && [ x$(command -v grealpath) = "x" ]; then
  echo "GNU coreutils need to be installed to use realpath with the -m switch"
  exit 1
fi

# If running on macOS use the GNU version of realpath.
if [ $(uname) = "Darwin" ]; then
  alias realpath="grealpath"
fi

PGDATA_VOLUME=$(docker volume ls -q -f "name=capxmlpgdata")
PGADMIN_VOLUME=$(docker volume ls -q -f "name=capxmlpgadmin")
PGBOOTSTRAP_VOLUME=$(docker volume ls -q -f "name=capxmlpgbootstrap")
LIQUIBASE_VOLUME=$(docker volume ls -q -f "name=capxmlliquibase")

if [ -z "$PGDATA_VOLUME" ]; then
  docker volume create capxmlpgdata
else
  echo Named volume capxmlpgdata exists
fi

if [ -z "$PGADMIN_VOLUME" ]; then
  docker volume create capxmlpgadmin
else
  echo Named volume capxmlpgadmin exists
fi

if [ -z "$PGBOOTSTRAP_VOLUME" ]; then
  docker volume create capxmlpgbootstrap
else
  echo Named volume capxmlpgbootstrap exists
fi

if [ -z "$PGTMP_VOLUME" ]; then
  docker volume create capxmlpgtmp
else
  echo Named volume capxmlpgtmp exists
fi

if [ -z "$LIQUIBASE_VOLUME" ]; then
  docker volume create capxmlliquibase
else
  echo Named volume capxmlliquibase exists
fi

# Default to configuration required when creating a development container by cloning the remote
# repository into a container volume.
CAP_XML_HOST_DIR=/workspaces/cap-xml/

if [ ! -d ${CAP_XML_HOST_DIR} ] && ([ -d /opt${CAP_XML_HOST_DIR} ] || [ -L /opt${CAP_XML_HOST_DIR} ]); then
  # A development container is being created from a local repository.
  CAP_XML_HOST_DIR=/opt${CAP_XML_HOST_DIR}
elif [ x"$LOCAL_CAP_XML_DIR"  != "x" ] && [ -d ${LOCAL_CAP_XML_DIR} ]; then
  # A development container is not being created.
  CAP_XML_HOST_DIR=${LOCAL_CAP_XML_DIR}
fi

PG_TEMP_CONTAINER=$(docker ps -a -q -f "name=capxmlpgbootstraptemp")

if [ ! -z "$PG_TEMP_CONTAINER" ]; then
  docker rm capxmlpgbootstraptemp
  echo Removed capxmlpgbootstraptemp container
fi

# Create a temporary container to load the database bootstrapping and setup scripts into named volumes
# used by the database container.
# https://stackoverflow.com/questions/37468788/what-is-the-right-way-to-add-data-to-an-existing-named-volume-in-docker
docker container create --name capxmlpgbootstraptemp -v capxmlpgbootstrap:/docker-entrypoint-initdb.d -v capxmlpgtmp:/tmp alpine
echo Created capxmlpgbootstraptemp container
docker cp ${CAP_XML_HOST_DIR}/docker/cap-xml-db/bootstrap-cap-xml-db.sh capxmlpgbootstraptemp:/docker-entrypoint-initdb.d/bootstrap-cap-xml-db.sh
(cd $(realpath -m  ${CAP_XML_HOST_DIR})/../cap-xml-db && docker cp ./cx/0.0.1/setup.sql capxmlpgbootstraptemp:/tmp/setup.sql)
docker rm capxmlpgbootstraptemp
echo Removed capxmlpgbootstraptemp container

LIQUIBASE_TEMP_CONTAINER=$(docker ps -a -q -f "name=capxmlliquibasetemp")

if [ ! -z "$LIQUIBASE_TEMP_CONTAINER" ]; then
  docker rm capxmlliquibasetemp
  echo Removed capxmlliquibasetemp container
fi

# Create a temporary container to facilitate liquibase bootstrapping through a named volume
# used by the Liquibase container.
# https://stackoverflow.com/questions/37468788/what-is-the-right-way-to-add-data-to-an-existing-named-volume-in-docker
docker container create --name capxmlliquibasetemp -v capxmlliquibase:/capxmldb alpine
echo Created capxmlliquibasetemp container
(cd $(realpath -m ${CAP_XML_HOST_DIR})/../cap-xml-db/cx && docker cp . capxmlliquibasetemp:/capxmldb)
docker rm capxmlliquibasetemp
echo Removed capxmlliquibasetemp container