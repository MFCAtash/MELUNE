#!/usr/bin/env bash
# =============================================================================
# MELUNE — Oracle Cloud (Ubuntu 22.04/24.04) first-boot bootstrap
# =============================================================================
# Run once on a fresh Always Free VM, as a sudo-capable user:
#
#   sudo REPO_URL=https://github.com/<you>/melune.git bash scripts/deploy/oracle-bootstrap.sh
#
# What it does:
#   1. Adds a 2 GB swap file when RAM is small (protects the Next.js build on
#      the 1 GB Ampere micro shape).
#   2. Installs Docker Engine + Compose v2 from Docker's official apt repo.
#   3. Opens 22/80/443 in UFW and in the Oracle image's iptables rules.
#   4. Clones the repo to /opt/melune (unless APP_DIR already exists).
#
# It does NOT create .env.production, certificates or Cloudflare DNS — those
# are account-specific and covered in docs/deploy-oracle-cloudflare.md.
# =============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/melune}"
REPO_URL="${REPO_URL:-}"
DEPLOY_USER="${DEPLOY_USER:-${SUDO_USER:-ubuntu}}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script with sudo." >&2
  exit 1
fi

echo "==> Base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg git ufw fail2ban jq unzip

# ---------------------------------------------------------------------------
# Swap (skip when the VM already has >= 4 GB RAM or any swap)
# ---------------------------------------------------------------------------
MEM_MB="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
if [ "$MEM_MB" -lt 4096 ] && ! swapon --show | grep -q .; then
  echo "==> Adding 2 GB swap (RAM=${MEM_MB}MB)"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  if ! grep -q '^/swapfile ' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
  sysctl -w vm.swappiness=10
  echo 'vm.swappiness=10' > /etc/sysctl.d/99-melune-swap.conf
else
  echo "==> Swap not needed (RAM=${MEM_MB}MB)"
fi

# ---------------------------------------------------------------------------
# Docker Engine + Compose plugin
# ---------------------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  ARCH="$(dpkg --print-architecture)"
  CODENAME="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  cat >/etc/apt/sources.list.d/docker.list <<EOF
deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${CODENAME} stable
EOF
  apt-get update -y
  apt-get install -y --no-install-recommends \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  echo "==> Docker already installed: $(docker --version)"
fi

systemctl enable --now docker

if id "$DEPLOY_USER" >/dev/null 2>&1; then
  usermod -aG docker "$DEPLOY_USER"
  echo "==> $DEPLOY_USER added to the docker group (re-login required)"
fi

# ---------------------------------------------------------------------------
# Host firewall
# ---------------------------------------------------------------------------
echo "==> Configuring UFW"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'ssh'
ufw allow 80/tcp comment 'http (ACME + redirect)'
ufw allow 443/tcp comment 'https'
ufw --force enable

# Ubuntu images on Oracle ship with iptables REJECT rules that run before UFW.
# Insert explicit ACCEPTs ahead of them (idempotent). Also open the ports in
# the OCI console Security List / NSG — the host firewall alone is not enough.
if command -v iptables >/dev/null 2>&1; then
  if ! iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null; then
    iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT || true
  fi
  if ! iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null; then
    iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT || true
  fi
  if command -v netfilter-persistent >/dev/null 2>&1; then
    netfilter-persistent save || true
  elif [ -d /etc/iptables ]; then
    iptables-save >/etc/iptables/rules.v4 || true
  fi
fi

systemctl enable --now fail2ban || true

# ---------------------------------------------------------------------------
# Repository checkout
# ---------------------------------------------------------------------------
if [ -d "$APP_DIR/.git" ]; then
  echo "==> $APP_DIR already exists; leaving it untouched"
else
  if [ -z "$REPO_URL" ]; then
    echo "==> REPO_URL not set; create $APP_DIR and clone manually." >&2
  else
    echo "==> Cloning $REPO_URL to $APP_DIR"
    mkdir -p "$(dirname "$APP_DIR")"
    git clone "$REPO_URL" "$APP_DIR"
    chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$APP_DIR"
  fi
fi

# ---------------------------------------------------------------------------
# Docker daemon log limits (defence in depth; compose already sets per-service)
# ---------------------------------------------------------------------------
mkdir -p /etc/docker
if [ ! -f /etc/docker/daemon.json ]; then
  cat >/etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "live-restore": true
}
EOF
  systemctl restart docker
fi

cat <<EOF

============================================================
Bootstrap complete.

Next steps (see docs/deploy-oracle-cloudflare.md):
  1. OCI console: open 22/80/443 in the VCN Security List / NSG.
  2. Cloudflare DNS: add
       A      music        <this VM's public IP>   Proxied
       CNAME  music-media  music.melune.app        Proxied
  3. cd $APP_DIR
     ./scripts/deploy/configure-domain.sh music.melune.app
     (generates .env.production with random secrets; use
      Caddyfile.origin once origin.pem/origin.key are in infra/caddy)
  4. docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
  5. Restore the database, rewrite media URLs, then switch Caddy to the
     Cloudflare Origin Certificate.

Re-login (or run 'newgrp docker') so $DEPLOY_USER can use Docker without sudo.
============================================================
EOF
