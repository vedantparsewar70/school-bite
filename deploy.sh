#!/usr/bin/env bash
set -e

# ========================================================
# Vidyalaya NutriBox - One-Click VPS Deployment Script
# Supports: Ubuntu 20.04+, Debian 11+
# ========================================================

echo "===================================================="
echo "🍱 Setting up Vidyalaya NutriBox on your VPS..."
echo "===================================================="

# 1. Check for Docker & Docker Compose
if ! command -v docker &> /dev/null; then
    echo "📦 Docker not found. Installing Docker engine..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm -f get-docker.sh
    echo "✅ Docker installed successfully."
fi

# Ensure docker compose plugin exists
if ! docker compose version &> /dev/null; then
    echo "📦 Installing docker-compose-plugin..."
    sudo apt-get update && sudo apt-get install -y docker-compose-plugin
fi

# 2. Check environment configuration
if [ ! -f .env ]; then
    echo "⚙️ Creating .env from .env.example..."
    cp .env.example .env
    # Generate random secure JWT Secret
    RAND_SECRET=$(openssl rand -hex 32 2>/dev/null || date +%s | sha256sum | base64 | head -c 32)
    sed -i "s|super-secure-school-mealbox-jwt-secret-key-2026|${RAND_SECRET}|g" .env
    echo "🔑 Generated unique JWT_SECRET in .env."
fi

# 3. Build & start containers
echo "🚀 Building and starting Docker containers..."
docker compose up -d --build

# 4. Display status
echo ""
echo "===================================================="
echo "🎉 Vidyalaya NutriBox is successfully deployed!"
echo "===================================================="
SERVER_IP=$(curl -s https://ifconfig.me || curl -s https://api.ipify.org || echo "YOUR_SERVER_IP")
echo ""
echo "👉 Web Application: http://${SERVER_IP}:3000"
echo "👉 View logs with:    docker compose logs -f"
echo "👉 Stop server with:  docker compose down"
echo "👉 Restart with:      docker compose restart"
echo ""
echo "Need custom domain & automatic HTTPS? Check HOSTING.md"
echo "===================================================="
