FROM postgres:latest

COPY 01-extensions.sql /docker-entrypoint-initdb.d/01-extensions.sql
COPY 02-glitchtip-db.sql /docker-entrypoint-initdb.d/02-glitchtip-db.sql
