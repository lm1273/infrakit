#!/bin/sh
set -e

echo "Starting Garage S3 initialization..."

# 1. Wait for Garage to be ready
echo "Waiting for Garage API at http://garage:3903..."
until curl -s -H "Authorization: Bearer ${SERVICE_PASSWORD_64_GARAGE_ADMIN}" http://garage:3903/v2/GetClusterStatus > /dev/null 2>&1; do
  sleep 2
  echo "Still waiting..."
done

echo "Garage is up! Downloading CLI..."
curl -L https://garagehq.deuxfleurs.fr/_releases/v1.1.0/x86_64-unknown-linux-musl/garage -o /tmp/garage
chmod +x /tmp/garage

echo "Applying layout and configuration..."
export GARAGE_ADMIN_TOKEN=${SERVICE_PASSWORD_64_GARAGE_ADMIN}
GARAGE="/tmp/garage --api-endpoint http://garage:3903"

# Get NODE_ID
NODE_ID=$($GARAGE node id -q | cut -c1-16)
echo "Local Node ID: $NODE_ID"

# Assign and Apply
$GARAGE layout assign $NODE_ID -z dc1 -c ${STORAGE_CAPACITY:-1G} || echo "Already assigned"
$GARAGE layout apply --version 1 || echo "Already applied"

# Key and Bucket
echo "Setting up Access Key and Bucket..."
$GARAGE key import --name app-key ${STORAGE_ACCESS_KEY_ID} ${STORAGE_SECRET_ACCESS_KEY} || echo "Key already exists"
$GARAGE bucket create ${STORAGE_BUCKET:-uploads} || echo "Bucket already exists"
$GARAGE bucket allow ${STORAGE_BUCKET:-uploads} --read --write --owner --key app-key || echo "Permissions already set"

echo "Garage S3 initialization complete!"
rm /tmp/garage
