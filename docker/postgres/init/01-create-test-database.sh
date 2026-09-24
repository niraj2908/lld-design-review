#!/bin/bash
# Runs once, on first initialisation of the data volume.
#
# Integration tests need their own database so a test run can truncate every
# table without touching development data.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
  CREATE DATABASE "${POSTGRES_TEST_DB}";
SQL

for database in "$POSTGRES_DB" "$POSTGRES_TEST_DB"; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$database" <<SQL
    CREATE EXTENSION IF NOT EXISTS "vector";
SQL
done
