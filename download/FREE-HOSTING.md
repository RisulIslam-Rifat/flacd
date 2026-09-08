# Free Hosting Guide — FLAC Downloader

This guide covers **4 genuinely free options** to host your FLAC Downloader app. Pick the one that fits your needs.

## 📊 Comparison

| Option | Cost | RAM | Time limit | Credit card? | Difficulty | Best for |
|---|---|---|---|---|---|---|
| **1. Hugging Face Spaces** | $0 forever | 16 GB | Sleeps after 48h idle | ❌ No | ⭐ Easy | Quick start, no card |
| **2. Koyeb** | $0 forever | 512 MB | None | ❌ No | ⭐⭐ Medium | Always-on, custom domain |
| **3. Google Cloud Run** | $0/mo (2M req) | Up to 4 GB | 60 min/req | ✅ Yes | ⭐⭐⭐ Hard | Production-grade |
| **4. Oracle Cloud VM** | $0 forever | 24 GB ARM | None | ✅ Yes | ⭐⭐⭐⭐ Hardest | Power users, full control |

**My recommendation**: Start with **#1 Hugging Face Spaces** — it's truly free, no credit card, 16 GB RAM (way more than enough), and takes ~5 minutes to set up.

---

## 🥇 Option 1: Hugging Face Spaces (recommended)

**Truly free, no credit card, 16 GB RAM, persistent storage.**

### Step 1 — Sign up

1. Go to https://huggingface.co/join
2. Create a free account (you can use GitHub/Google login)

### Step 2 — Create a Docker Space

1. Go to https://huggingface.co/new-space
2. **Space name:** `flac-downloader`
3. **License:** MIT (or your choice)
4. **SDK:** Select **Docker**
5. **Space Hardware:** **CPU basic** (free, 16 GB RAM)
6. Click **Create Space**

### Step 3 — Upload the files

You need to upload these files to your Space (via the web UI or `git`):

```
Dockerfile.hf      → renamed to "Dockerfile" in the Space
README_HF.md       → renamed to "README.md" in the Space
scripts/           → entire folder
src/               → entire folder
public/            → entire folder
package.json
bun.lock
tsconfig.json
next.config.ts
postcss.config.mjs
tailwind.config.ts
components.json
eslint.config.mjs
next-env.d.ts
prisma/            → entire folder
```

**Via git (recommended)**:

```bash
# Clone the empty Space
git clone https://huggingface.co/spaces/<your-username>/flac-downloader
cd flac-downloader

# Copy files from the project
cp /path/to/flac-downloader/Dockerfile.hf ./Dockerfile
cp /path/to/flac-downloader/README_HF.md ./README.md
cp -r /path/to/flac-downloader/{scripts,src,public,prisma} ./
cp /path/to/flac-downloader/{package.json,bun.lock,tsconfig.json,next.config.ts,postcss.config.mjs,tailwind.config.ts,components.json,eslint.config.mjs,next-env.d.ts} ./

# Commit and push
git add .
git commit -m "Initial deploy"
git push
```

### Step 4 — Wait for the build

- Open your Space URL: `https://<your-username>-flac-downloader.hf.space`
- Click the "Logs" tab to see the Docker build (takes ~5–10 minutes)
- When it says "Running", the app is live

### Step 5 — Install on your phone

Open `https://<your-username>-flac-downloader.hf.space` on your phone:
- **iPhone**: Safari → Share → Add to Home Screen
- **Android**: Chrome → ⋮ → Add to Home screen

### Caveats
- ⏰ Space **sleeps after 48 hours of inactivity** (no requests). Next request wakes it in ~10 seconds.
- 🔒 The URL is **public**. Anyone who knows it can use the app.
- 🌍 **Custom domain**: not available on free Spaces (only on HF Pro at $9/mo).

---

## 🥈 Option 2: Koyeb (always-on)

**Free forever, 512 MB RAM, no sleep.**

### Step 1 — Sign up

1. Go to https://www.koyeb.com
2. Sign up with GitHub

### Step 2 — Push to GitHub

```bash
git init && git add . && git commit -m "FLAC Downloader"
git branch -M main
git remote add origin https://github.com/<you>/flac-downloader.git
git push -u origin main
```

### Step 3 — Create a Koyeb service

1. Go to https://app.koyeb.com
2. Click **Create Service**
3. **Source:** GitHub
4. **Repository:** `flac-downloader`
5. **Branch:** `main`
6. **Builder:** Docker
7. **Dockerfile path:** `Dockerfile` (the one in repo root)
8. **Instance type:** **Free** (512 MB RAM)
9. **Port:** `3000`
10. **Path:** `/`
11. Click **Deploy**

### Step 4 — Wait & verify

- Build logs appear in the Koyeb dashboard (5–8 minutes)
- Your URL: `https://flac-downloader-<random>.koyeb.app`
- Test:
  ```bash
  curl -i https://flac-downloader-xxxx.koyeb.app/
  curl "https://flac-downloader-xxxx.koyeb.app/api/search?q=Adele&page=0" | head -200
  ```

### Caveats
- ⚠️ **512 MB is tight** for Chromium. If downloads fail with "memory error", upgrade to a paid instance ($5/mo).
- 🌍 Free tier = 1 service only.
- ❌ Koyeb's free tier requires your account to be at least 24 hours old before deploying (anti-abuse).

---

## 🥉 Option 3: Google Cloud Run (production-grade)

**Free 2M requests/month, scales to zero, custom domain.**

### Prerequisites
- Google account
- **Credit card required** (for verification — you won't be billed if you stay under the free quota)

### Step 1 — Create a GCP project

1. Go to https://console.cloud.google.com
2. Create a new project: `flac-downloader`
3. Enable billing (link a credit card — required even for free tier)

### Step 2 — Enable Cloud Run + Artifact Registry

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com
gcloud artifacts repositories create flac-downloader --repository-format=docker --location=us-central1
```

### Step 3 — Build & push the image

```bash
# Configure Docker auth
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build and push (using the existing Dockerfile)
docker build -t us-central1-docker.pkg.dev/<your-project-id>/flac-downloader:latest .
docker push us-central1-docker.pkg.dev/<your-project-id>/flac-downloader:latest
```

### Step 4 — Deploy to Cloud Run

```bash
gcloud run deploy flac-downloader \
  --image us-central1-docker.pkg.dev/<your-project-id>/flac-downloader:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 3
```

### Step 5 — Get the URL

```bash
gcloud run services describe flac-downloader --region us-central1 --format 'value(status.url)'
# → https://flac-downloader-xxxx-uc.a.run.app
```

### Free tier quotas
- **2 million requests/month** — more than enough for personal use
- **360,000 GB-seconds/month** = ~5 minutes of 1 GB RAM × 24h × 30 days
- **360,000 vCPU-seconds/month** = similar
- ⚠️ If you exceed this, you pay per-use (~$0.00002400/vCPU-sec). For 100 FLAC downloads/mo, you'll be far under the limit.

### Caveats
- **Cloud Run scales to zero** when not in use. The first request after a cold start takes ~10s.
- ⚠️ Each Cloud Run instance has a **max 60 min request timeout** (more than enough for FLAC downloads).
- ❌ Each cold start launches a fresh container — your Chromium profile cookies are reset. Downloads still work, just slightly slower (~5s slower).
- 🌍 Custom domain supported: https://console.cloud.google.com/run/domains

---

## 🏆 Option 4: Oracle Cloud Always Free VM

**Most resources (24 GB RAM ARM!), full control, no time limits.**

### Prerequisites
- Oracle account
- **Credit card required** (for verification — never billed if you stay on Always Free tier)

### Step 1 — Sign up for Oracle Cloud

1. Go to https://cloud.oracle.com → **Start for free**
2. Complete signup (select **Home Region** = closest to you)
3. Verify email + credit card (not charged)

### Step 2 — Create an Always Free ARM VM

1. Go to **Compute → Instances → Create Instance**
2. **Name:** `flac-downloader`
3. **Shape:** Click Edit → **Ampere** (ARM-based) → **VM.Standard.A1.Flex**
4. **OCPU:** 4, **Memory:** 24 GB (Always Free quota)
5. **Image:** Canonical Ubuntu 22.04
6. **SSH keys:** Download private key (save it!)
7. Click **Create**

Wait ~2 minutes for the VM to provision. Note the **public IP**.

### Step 3 — SSH into the VM

```bash
chmod 600 ~/Downloads/ssh-key-*.key
ssh -i ~/Downloads/ssh-key-*.key ubuntu@<vm-public-ip>
```

### Step 4 — Install dependencies

```bash
sudo apt-get update
sudo apt-get install -y \
    curl ca-certificates xvfb python3 python3-pip python3-venv \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libxshmfence1 libasound2 \
    libpangocairo-1.0-0 libpango-1.0-0 libcairo2 libatspi2.0-0 \
    libgtk-3-0

# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Install Playwright Chromium
python3 -m venv /opt/venv
/opt/venv/bin/pip install playwright
/opt/venv/bin/playwright install chromium
```

### Step 5 — Clone your repo & build

```bash
git clone https://github.com/<you>/flac-downloader.git
cd flac-downloader
bun install
bun run build
```

### Step 6 — Set up Xvfb + Next.js as systemd services

Create `/etc/systemd/system/xvfb.service`:
```ini
[Unit]
Description=Xvfb
After=network.target

[Service]
ExecStart=/usr/bin/Xvfb :99 -screen 0 1280x800x24 -ac -nolisten tcp
Restart=always
User=root

[Install]
WantedBy=multi-user.target
```

Create `/etc/systemd/system/flac-downloader.service`:
```ini
[Unit]
Description=FLAC Downloader
After=xvfb.service network.target
Requires=xvfb.service

[Service]
WorkingDirectory=/home/ubuntu/flac-downloader
Environment="NODE_ENV=production"
Environment="PORT=3000"
Environment="HOSTNAME=0.0.0.0"
Environment="DISPLAY=:99"
Environment="PATH=/opt/venv/bin:/root/.bun/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=/root/.bun/bin/bun .next/standalone/server.js
Restart=always
User=root

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now xvfb
sudo systemctl enable --now flac-downloader
sudo systemctl status flac-downloader
```

### Step 7 — Open port 3000

```bash
sudo iptables -I INPUT -p tcp --dport 3000 -j ACCEPT
```

Also open it in Oracle's security list:
1. Go to **Networking → Virtual Cloud Networks → your VCN → Security Lists**
2. Add Ingress Rule: Source `0.0.0.0/0`, IP Protocol `TCP`, Destination Port `3000`

### Step 8 — Verify & install on phone

Open `http://<vm-public-ip>:3000` on your phone → **Add to Home Screen**.

### Optional — Add HTTPS with Caddy

```bash
sudo apt-get install -y caddy
echo "<your-domain-or-ip>:443 {
    reverse_proxy localhost:3000
}" | sudo tee /etc/caddy/Caddyfile
sudo systemctl restart caddy
```

Now you have HTTPS — required for proper PWA installation.

### Caveats
- ⚠️ **Always Free quota** limits you to 4 ARM cores + 24 GB RAM. Don't create more VMs than that.
- 🔒 **Public IP changes on reboot** unless you assign an **Always Free reserved public IP** (Networking → IPs → Reserved Public IPs).
- 🌍 Custom domain: point an A record to the VM's public IP and use Caddy for HTTPS.

---

## 🤔 Which one should I pick?

| If you want... | Choose |
|---|---|
| **Get it live in 10 min, no credit card** | 🥇 Hugging Face Spaces |
| **Always-on, no credit card, simple** | 🥈 Koyeb |
| **Production-grade, scales automatically** | 🥉 Google Cloud Run |
| **Full control, most resources, willing to learn** | 🏆 Oracle Cloud VM |

## 🚀 My personal recommendation

**Hugging Face Spaces** is the best starting point because:
- $0 forever
- No credit card
- 16 GB RAM (overkill for our needs)
- Standard Docker support
- Easy git-based workflow
- Public URL works instantly

If you outgrow it (too many users, want custom domain), upgrade to Google Cloud Run or Oracle VM later.

## 📱 Installing on your phone (works the same for all 4 options)

Once your app is live at any public URL:

### iPhone
1. Open the URL in **Safari**
2. Tap the **Share** button (square with up-arrow, bottom of screen)
3. Tap **Add to Home Screen** → **Add**
4. The amber music-note icon appears on your home screen

### Android
1. Open the URL in **Chrome**
2. Tap the **⋮** menu (top-right)
3. Tap **Add to Home screen** → **Add**
4. The icon appears on your home screen / app drawer

---

## ❓ FAQ

**Q: Why is Render's free plan not in the list?**
A: Render's free web services have a 30-second request timeout — too short for our FLAC downloads (which take 30–60 seconds). And they sleep after 15 min idle, killing Xvfb.

**Q: Why not Vercel / Netlify?**
A: They're serverless with read-only filesystems. The FLAC downloader needs Python + Chromium + Xvfb running in a single persistent container — serverless can't do that.

**Q: Will Cloudflare block my hosted instance?**
A: Possibly, if your IP gets flagged for abuse. If downloads fail with 502, try a different hosting provider. The Playwright flow uses a real Chromium browser, so it usually works — but Cloudflare is unpredictable.

**Q: How do I keep the URL secret?**
A: Either use a long unguessable subdomain (e.g. `flac-downloader-x7q2m9hf.hf.space`) or add basic auth via Next.js middleware. See the main `README.md` for details.

**Q: Can I use a custom domain?**
A: Yes on Cloud Run and Oracle VM (free). On Hugging Face Spaces and Koyeb free tier, you need a paid plan for custom domains.

---

## Need help?

If a deploy fails, paste the build/run logs here and I'll debug it for you.
