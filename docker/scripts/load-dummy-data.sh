#!/bin/sh
# This script MUST be called from ${containerWorkspace Folder}.
# Preload the database with 10 dummy messages

set -e

# Constants
BASE_GUID="4eb3b7350ab7aa443650fc9351f02940E"
BASE_AREA="TESTAREA"
DATA_FILE="test/lib/functions/data/nws-alert.xml"
LAMBDA_URL=http://$(awslocal apigateway get-rest-apis | jq -r ".items[0].id").execute-api.localhost.localstack.cloud:4566/local/message

# Calculate tomorrow's date
TOMORROW=$(date -u -d "+1 day" +"%Y-%m-%dT%H:%M:%S+00:00")

# Loop 10 times
i=1
while [ $i -le 10 ]; do
    NEW_GUID="${BASE_GUID}${i}"
    NEW_AREA="${BASE_AREA}${i}"

    echo "Posting with GUID: $NEW_GUID and Area: $NEW_AREA"

    # Perform find and replace, then send with curl
    curl -X POST "$LAMBDA_URL" \
         -H "Content-Type: text/xml" \
         -d "$(sed -e "s/${BASE_GUID}/${NEW_GUID}/g" -e "s/${BASE_AREA}/${NEW_AREA}/g" -e "s|<expires>2025-11-16T08:00:27+00:00</expires>|<expires>${TOMORROW}</expires>|g" "$DATA_FILE")"

    echo "Done with POST $i"
    i=$((i + 1))
done

echo "Data loaded:"
echo ${LAMBDA_URL}s.atom 