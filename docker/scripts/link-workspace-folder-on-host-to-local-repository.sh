#!/bin/sh
# This script MUST be run on the host before attempting to create a development container.
set -e

if [ $(whoami) != root ]; then
  echo This script must be run as root
  exit 1
fi

if [ ! -d "$LOCAL_CAP_XML_DIR"/.git ] && [ x$(echo $"$LOCAL_CAP_XML_DIR" | grep -E /cap-xml/?$) = "x" ]; then
 echo LOCAL_CAP_XML_DIR must be set to the absolute path of the root of a local cap-xml repository
 exit 1
fi

if [ $(uname) != "Linux" ] && [ $(uname) != "Darwin" ]; then
  echo "Unsupported operating system $(uname) detected - Linux and  macOS are supported"
  exit 1
fi


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

# Ensure that local/remote repository contents are available in a development container directory compatible with Linux and macOS.
CAP_XML_WORKSPACE_DIR=/opt/workspaces/cap-xml

# A Docker Compose based development container requires a workspace folder (see https://containers.dev/implementors/json_reference/).
# If creating a development container from a local cap-xml repository, the development container user needs read write access to the workspace
# folder from within the development container.
#
# Create a symbolic link from the workspace folder to the local repository on the host.
if [ ! -L "$CAP_XML_WORKSPACE_DIR" ] && [ $(realpath -m "$CAP_XML_WORKSPACE_DIR") != $(realpath -m "$LOCAL_CAP_XML_DIR") ]; then
  mkdir -p /opt/workspaces
  ln -s "$LOCAL_CAP_XML_DIR" "$CAP_XML_WORKSPACE_DIR"
  echo Created symbolic link from "$CAP_XML_WORKSPACE_DIR" to "$LOCAL_CAP_XML_DIR"
fi

if [ $(realpath -m "$CAP_XML_WORKSPACE_DIR") = $(realpath -m "$LOCAL_CAP_XML_DIR") ]; then
  echo "$CAP_XML_WORKSPACE_DIR" references "$LOCAL_CAP_XML_DIR"
fi

# To support development container creation by cloning into a container volume, a bootstrap container is used that makes the
# remote repository contents available within /workspaces/cap-xml
# (see https://github.com/microsoft/vscode-remote-release/issues/6891).
# This location appears to be non-configurable. For running and debugging to work, the source code MUST be available in the
# same directory structure on the host machine.
CAP_XML_VOLUME_WORKSPACE_DIR=/workspaces/cap-xml

# To support development container creation by cloning into a container volume on a Linux host, provide the required directory
# structure by creating a symbolic link from /workspaces/cap-xml to the macOS compatible local repository location
# /opt/cap-xml. If a local repository has been cloned to somewhere other than /opt/cap-xml, this results in two symbolic
# links leading to the local repository on the host. For example:
# /workspaces/cap-xml -> /opt/workspaces/cap-xml -> /path/to/local/cap-xml
#
# As macOS does not support creating content under / by default
# (see https://apple.stackexchange.com/questions/388236/unable-to-create-folder-in-root-of-macintosh-hd),
# /workspaces/cap-xml cannot be created. Container volume based running/debugging is NOT supported using default
# macOS configuration accordingly.
if [ $(uname) = "Linux" ] && [ ! -L "$CAP_XML_VOLUME_WORKSPACE_DIR" ] && [ $(realpath -m "$CAP_XML_VOLUME_WORKSPACE_DIR") != $(realpath -m "$CAP_XML_WORKSPACE_DIR") ]; then
  mkdir -p /workspaces
  ln -s "$CAP_XML_WORKSPACE_DIR" "$CAP_XML_VOLUME_WORKSPACE_DIR"
  echo Created symbolic link from "$CAP_XML_VOLUME_WORKSPACE_DIR" to "$CAP_XML_WORKSPACE_DIR"
elif [ $(uname) = "Darwin" ]; then
  echo "macOS detected - WARNING - Running/debugging is only supported when creating a development container from a local cap-xml repository"
fi

if [ $(realpath -m "$CAP_XML_VOLUME_WORKSPACE_DIR") = $(realpath -m "$CAP_XML_WORKSPACE_DIR") ]; then
  echo "$CAP_XML_VOLUME_WORKSPACE_DIR" references "$CAP_XML_WORKSPACE_DIR"
fi
