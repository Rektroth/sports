#!/bin/bash

SCRIPTPATH=$(dirname "$0")
DIR="$SCRIPTPATH/upgrades"

for file in $DIR/*; do
    psql -U "$1" -d sports -f "${file}" -w
done
