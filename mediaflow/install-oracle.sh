#!/usr/bin/env bash
# Installa Docker + MediaFlow Proxy su Ubuntu (Oracle Cloud Free)
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Esegui con: sudo bash install-oracle.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "==> Aggiornamento sistema"
apt-get update -y
apt-get upgrade -y

echo "==> Installazione Docker"
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
fi
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker

APP_DIR="/opt/mediaflow"
mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [[ ! -f docker-compose.yml ]]; then
  cat > docker-compose.yml <<'YAML'
services:
  mediaflow:
    image: mhdzumair/mediaflow-proxy:latest
    container_name: mediaflow
    restart: unless-stopped
    ports:
      - "8888:8888"
    env_file:
      - .env
    environment:
      - PORT=8888
      - ENABLE_STREAMING_PROGRESS=false
YAML
fi

if [[ ! -f .env ]]; then
  PASS="$(openssl rand -base64 18 | tr -d '=+/')Mh1"
  echo "API_PASSWORD=${PASS}" > .env
  echo ""
  echo "============================================"
  echo " PASSWORD GENERATA (SALVALA):"
  echo " ${PASS}"
  echo "============================================"
  echo ""
else
  echo "==> .env già presente, non la sovrascrivo"
fi

echo "==> Avvio MediaFlow"
docker compose pull
docker compose up -d

echo "==> Firewall locale (se ufw attivo)"
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp || true
  ufw allow 8888/tcp || true
fi

sleep 3
docker compose ps
echo ""
echo "OK. Apri nel browser: http://IP_PUBBLICO_ORACLE:8888"
echo "Poi in StreamViX: Backend=MediaFlow | URL=http://IP:8888 | Password=quella in /opt/mediaflow/.env"
echo ""
cat .env
