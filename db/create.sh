#!/bin/bash

SCRIPTPATH=$(dirname "$0")
psql -U "$1" -f "${SCRIPTPATH}/init.sql" -w
sh upgrade.sh "$1"
