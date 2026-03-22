#!/bin/bash

# Olvassuk ki a .env fájlt ha létezik
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | xargs)
fi

DATA_DIR=${DATA_DIR:-/opt/infrakit/data}
PROJECT_NAME=${PROJECT_NAME:-app}

TARGET_DIR="$DATA_DIR/$PROJECT_NAME"

echo "🚀 InfraKit mappa előkészítése Host szerveren..."
echo "📂 Célkönyvtár: $TARGET_DIR"

# Mappák létrehozása
mkdir -p "$TARGET_DIR/postgres"
mkdir -p "$TARGET_DIR/valkey"
mkdir -p "$TARGET_DIR/garage/data"
mkdir -p "$TARGET_DIR/garage/meta"
mkdir -p "$TARGET_DIR/uptime-kuma"
mkdir -p "$TARGET_DIR/filestash"
mkdir -p "$TARGET_DIR/tailscale"
mkdir -p /opt/infrakit/config
mkdir -p ./init/caddy # Lokális konfigurációs mappa biztosítása

# Garage konfiguráció másolása a perzisztens helyre
echo "📋 Garage konfiguráció másolása..."
cp "$(dirname "$0")/init/garage/garage.toml" /opt/infrakit/config/garage.toml

# PostgreSQL jogosultság beállítása (999:999 UID/GID)
# EZ KRITIKUS: ha a Docker hozza létre, root lesz, és a DB Permission Denied hibával nem indul el.
echo "🔒 PostgreSQL (UID 999) jogosultság fixálása..."
sudo chown -R 999:999 "$TARGET_DIR/postgres"
sudo chmod -R 700 "$TARGET_DIR/postgres"

# Garage és Valkey jogosultságok
echo "🔒 Garage és Valkey jogosultság fixálása..."
sudo chmod -R 777 "$TARGET_DIR/garage"
sudo chmod -R 777 "$TARGET_DIR/valkey"

echo "✅ Kész! Mehet a deploy Coolify-ban."
