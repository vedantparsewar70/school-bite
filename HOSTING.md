# 🚀 Hosting Guide: Vidyalaya NutriBox (Docker & VPS)

This guide walks you through deploying your **Next.js 16 + Prisma SQLite** web application to any Virtual Private Server (VPS) or cloud host using Docker.

---

## 📋 What Was Configured For You

1. **[`Dockerfile`](./Dockerfile)**:
   - High-performance multi-stage build using `node:20-alpine`.
   - Standalone Next.js output (small image footprint, fast boot times).
   - Bundles Prisma engine and client with SQLite support.

2. **[`docker-entrypoint.sh`](./docker-entrypoint.sh)**:
   - Automatically syncs the Prisma schema (`npx prisma db push`) on startup.
   - Preserves all existing orders, users, and meal data.

3. **[`docker-compose.yml`](./docker-compose.yml)**:
   - Mounts `./prisma:/app/prisma` as a host volume so `dev.db` persists forever across container rebuilds.
   - Built-in container restart policy (`unless-stopped`).

4. **[`Caddyfile`](./Caddyfile)**:
   - Reverse proxy configuration with automatic, zero-config Let's Encrypt HTTPS/SSL for custom domains.

5. **[`deploy.sh`](./deploy.sh)**:
   - One-click script for Ubuntu/Debian that installs Docker (if missing) and boots the entire project.

---

## ⚡ Quick Start: Deploy to Ubuntu / Debian VPS

> **Recommended VPS Providers** (cost ~ $4 to $6/month):
> - **Hetzner Cloud** (CX22 / CPX11) - Great performance, ~$4/mo
> - **DigitalOcean** (Basic Droplet with Ubuntu 24.04 or 22.04)
> - **Linode / Akamai** ($5/mo Nanode)
> - **AWS EC2** (t3.micro / t4g.small) or **Lightsail** ($3.50/mo)

### Step 1: Connect to your VPS
From your terminal or PowerShell:
```bash
ssh root@<YOUR_VPS_IP>
```

---

### Step 2: Transfer the Code to the VPS

You can either clone your Git repository or transfer files using `rsync` / `scp`:

#### Option A: Via Git (Recommended)
```bash
# Push your local code to GitHub / GitLab, then on your VPS:
git clone <YOUR_GIT_REPO_URL> school2
cd school2
```

#### Option B: Via SCP from your Windows PC
From PowerShell on your local machine:
```powershell
scp -r "c:\Users\chait\OneDrive\Desktop\programming\school2" root@<YOUR_VPS_IP>:/root/school2
```
Then on your VPS:
```bash
cd /root/school2
```

---

### Step 3: Run the 1-Click Deployment Script

On your VPS, run:
```bash
chmod +x deploy.sh docker-entrypoint.sh
./deploy.sh
```

The script will automatically:
1. Install Docker & Docker Compose if not already installed.
2. Initialize `.env` with a secure random `JWT_SECRET`.
3. Build the production Docker container.
4. Launch the application in the background on port `3000`.

Your website is now live at:
```
http://<YOUR_VPS_IP>:3000
```

---

## 🌐 Connecting a Custom Domain with Automatic HTTPS (SSL)

To enable free automatic SSL certificates (Let's Encrypt):

1. **Point your domain's DNS `A` record** to `<YOUR_VPS_IP>` at your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.).
2. Edit [`Caddyfile`](./Caddyfile) on the VPS:
   ```bash
   nano Caddyfile
   ```
   Change `yourdomain.com` to your real domain (e.g. `canteen.school.org`):
   ```caddy
   canteen.school.org {
       reverse_proxy web:3000
       encode zstd gzip
   }
   ```
3. Start the HTTPS profile:
   ```bash
   docker compose --profile https up -d
   ```
Caddy will automatically provision a valid HTTPS certificate and redirect all HTTP traffic to HTTPS!

---

## 🛠️ Management & Maintenance Commands

### View Live Application Logs
```bash
docker compose logs -f web
```

### Restart Application
```bash
docker compose restart
```

### Stop the Containers
```bash
docker compose down
```

### Update the App After Modifying Code
Whenever you make changes to the code:
```bash
git pull
docker compose up -d --build
```
*(Your SQLite data remains 100% safe inside the `./prisma` folder during rebuilds!)*

### Database Backup
Because SQLite is a single file, backup is instantaneous:
```bash
# Create a timestamped backup of the database
cp ./prisma/dev.db ./prisma/dev_backup_$(date +%Y%m%d_%H%M%S).db
```

---

## 🔐 Environment Variables Summary

| Variable | Description | Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | SQLite file connection string | `file:./dev.db` |
| `JWT_SECRET` | Secret key for JWT session tokens | Secure random string |
| `NEXT_PUBLIC_APP_NAME` | Branding title shown across the UI | `Vidyalaya NutriBox` |
| `SEED_ON_INIT` | Whether to run demo seed data on fresh launch | `false` |
| `PORT` | Container internal port | `3000` |
