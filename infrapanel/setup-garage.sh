#!/bin/sh
set -e

echo "Starting Garage S3 initialization..."

# 1. Wait for Garage to be ready
echo "Waiting for Garage API at http://garage:3903..."
until curl -s http://garage:3903/status > /dev/null 2>&1; do
  sleep 2
  echo "Still waiting..."
done

echo "Garage is up! Downloading CLI..."
curl -L https://garagehq.deuxfleurs.fr/_releases/v1.1.0/x86_64-unknown-linux-musl/garage -o /tmp/garage
chmod +x /tmp/garage

echo "Applying layout and configuration..."
# Get NODE_ID
NODE_ID=$(/tmp/garage -h http://garage:3903 node id -q | cut -c1-16)
echo "Local Node ID: $NODE_ID"

# Assign and Apply
/tmp/garage -h http://garage:3903 layout assign $NODE_ID -z dc1 -c ${STORAGE_CAPACITY:-1G} || echo "Already assigned"
/tmp/garage -h http://garage:3903 layout apply --version 1 || echo "Already applied"

# Key and Bucket
echo "Setting up Access Key and Bucket..."
/tmp/garage -h http://garage:3903 key import --name app-key ${STORAGE_ACCESS_KEY_ID} ${STORAGE_SECRET_ACCESS_KEY} || echo "Key already exists"
/tmp/garage -h http://garage:3903 bucket create ${STORAGE_BUCKET:-uploads} || echo "Bucket already exists"
/tmp/garage -h http://garage:3903 bucket allow ${STORAGE_BUCKET:-uploads} --read --write --owner --key app-key || echo "Permissions already set"

echo "Garage S3 initialization complete!"
rm /tmp/garage
