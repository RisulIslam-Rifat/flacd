# Deploying FLAC Downloader to Render

This guide walks you through deploying the FLAC Downloader PWA to [Render](https://render.com) using a Docker image. The Dockerfile handles all the tricky bits (Node + Python + Playwright + Xvfb in one container).

**Estimated time:** 15–25 minutes (most of it is Render's build time)
**Required plan:** Starter ($7/mo) — see "Why not free?" below

---

## 📋 Prerequisites

1. **A Render account** — sign up free at https://render.com
2. **A GitHub account** with this repo pushed to it (or GitLab — Render supports both)
3. **A credit card on Render** — required to upgrade to the Starter plan ($7/mo)

### Why not the Free plan?

The Free plan won't work for this app because:
| Limit | Free plan | What we need |
|---|---|---|
| RAM | 512 MB | ~1 GB (Chromium is memory-hungry) |
| Sleep | Sleeps after 15 min idle | Xvfb + Chromium must stay hot |
| Request timeout | 30 seconds | FLAC downloads take 30–60s |

**Starter plan** ($7/mo) gives 512 MB RAM → 2 GB RAM, no sleep, 5-min request timeout. That's enough.

---

## 🚀 Option A — One-click deploy via Blueprint (recommended)

This uses the included `render.yaml` file.

### Step 1: Push to GitHub

```bash
# Inside the project folder
git init
git add .
git commit -m "FLAC Downloader PWA"
git branch -M main
git remote add origin https://github.com/<your-username>/flac-downloader.git
git push -u origin main
```

### Step 2: Create a new Blueprint on Render

1. Go to https://dashboard.render.com/blueprints/new
2. Connect your GitHub account if you haven't already
3. Find and select the `flac-downloader` repository
4. Render will detect `render.yaml` and show a preview of the service
5. Click **Apply**
6. Render will start building the Docker image (this takes ~5–8 minutes on first build)

### Step 3: Set the access token (optional)

In the Render UI for the `flac-downloader` service:
1. Go to **Environment** in the sidebar
2. Find `APP_ACCESS_TOKEN` and set any random string (or leave blank)
3. Save

### Step 4: Wait for the deploy

- Build logs appear at https://dashboard.render.com/web/<service-id>/build
- Once "Live" appears, your URL is `https://flac-downloader-<random>.onrender.com`
- Open it on your phone, then **Add to Home Screen** (see "Installing on your phone" below)

---

## 🛠 Option B — Manual deploy (no render.yaml)

If you prefer to configure manually:

1. Go to https://dashboard.render.com/create?type=web
2. **Name:** `flac-downloader`
3. **Runtime:** `Docker`
4. **Region:** Pick the one closest to you (oregon / frankfurt / ohio / singapore)
5. **Branch:** `main`
6. **Plan:** `Starter` ($7/mo)
7. **Instance Type:** `512 MB` is fine to start, `1 GB` if you want faster downloads
8. Click **Create Web Service**

Render will build the Dockerfile and start the container.

---

## 🧪 Verifying the deploy

After the status shows "Live":

```bash
# Replace the URL with your actual Render URL
curl -i https://flac-downloader-xxxx.onrender.com/
# Expect: HTTP/1.1 200 OK

# Test the search API
curl "https://flac-downloader-xxxx.onrender.com/api/search?q=Adele&page=0" | head -200

# Test a download (this will take 30-60s and return a 25 MB FLAC file)
curl -X POST https://flac-downloader-xxxx.onrender.com/api/download \
  -H "Content-Type: application/json" \
  -d '{"track":{"id":3135556,"title":"Hello","artist":"Adele","duration":0,"link":"https://www.deezer.com/track/3135556"},"title":"Hello","artist":"Adele"}' \
  -o /tmp/test.flac -w "HTTP: %{http_code}\nSize: %{size_download} bytes\nTime: %{time_total}s\n" \
  --max-time 300
```

You should see something like:
```
HTTP: 200
Size: 25348423 bytes
Time: 45.2s
```

Verify the file is a real FLAC:
```bash
file /tmp/test.flac
# Expect: FLAC audio bitstream data, 16 bit, stereo, 44.1 kHz, ...
```

---

## 📲 Installing on your phone from Render

Once the deploy is live, your app URL looks like:
```
https://flac-downloader-<random>.onrender.com
```

### iPhone (iOS)
1. Open the URL in **Safari**
2. Tap the **Share** icon (square with up-arrow, bottom of screen)
3. Scroll → tap **Add to Home Screen**
4. Tap **Add** — an amber music-note icon appears on your home screen
5. Tap it — app opens full-screen, no Safari chrome

### Android
1. Open the URL in **Chrome**
2. Tap the **⋮** menu (top-right)
3. Tap **Add to Home screen** → **Add**
4. The icon appears on your home screen / app drawer

---

## ⚙️ How the Docker image works

```
┌─────────────────────────────────────────────┐
│  Container (Debian bookworm-slim)           │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Xvfb :99 (background daemon)         │  │  ← started by render-start.sh
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Next.js (node server.js)             │  │  ← main process, port 3000
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  /api/download (route handler)        │  │
│  │   ↓ spawns                             │  │
│  │  python3 scripts/flac_download_worker  │  │
│  │   ↓ drives                             │  │
│  │  Chromium (headed, DISPLAY=:99)        │  │  ← Playwright
│  │   ↓ downloads                          │  │
│  │  flacdownloader.com → FLAC file        │  │
│  │   ↓ streams                            │  │
│  │  back to the client as audio/flac     │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  Ports: 3000 (Next.js)                      │
│  Volumes: /tmp/flacdownloader_profile       │
│           (Chromium user profile —          │
│            keeps Cloudflare cookies warm)   │
└─────────────────────────────────────────────┘
```

---

## 🔄 Updating the deploy

Any push to `main` triggers an automatic rebuild (because `autoDeploy: true` in `render.yaml`). To deploy a change:

```bash
git add .
git commit -m "your change"
git push
# Watch the build at https://dashboard.render.com/web/<service-id>/build
```

To disable auto-deploy: in the Render UI → Settings → Auto-Deploy → Off.

---

## 🧯 Troubleshooting

### Build fails with "Out of memory"
- Render's free / 512 MB instances can OOM during `bun run build`
- Fix: upgrade the instance to 1 GB in **Settings → Instance Type**

### Downloads return 502 / "Worker produced no output"
- Usually means Xvfb didn't start, or Chromium can't connect to display :99
- Check logs at https://dashboard.render.com/web/<service-id>/logs
- You should see `[startup] Xvfb is ready (pid N)` near the top
- If not, the container is broken — trigger a manual deploy to restart

### Downloads time out after 30s
- This happens on the **free plan** — upgrade to Starter
- On Starter, the timeout is 5 minutes which is enough

### Cloudflare returns 403 / "FLAC button not available"
- The Playwright browser profile got stale or got banned
- Fix: SSH into the container (Render UI → Shell) and run:
  ```bash
  rm -rf /tmp/flacdownloader_profile
  ```
- Then trigger a restart: Render UI → Manual Deploy → Clear cache & deploy

### The app sleeps / first request is slow
- Free plan sleeps after 15 min idle — upgrade to Starter
- On Starter, the first request after a deploy may take ~10s (cold start)

### Can't install PWA on iOS
- Make sure you opened the URL in **Safari** (not Chrome on iOS)
- The Share icon is at the **bottom** of the screen, not the top

---

## 💰 Cost estimate

- **Starter plan**: $7/month for 1 instance, 512 MB RAM, 1 GB SSD
- **Recommended**: 1 GB RAM instance (~$14/month) for snappier downloads
- Render bills pro-rata, so you can try it for a day for ~$0.50

### To stop paying
- Render UI → your service → Settings → **Suspend** (keeps the service but stops billing)
- Or: **Delete Service** (deletes everything, including the URL)

---

## 🔒 Security notes

- The deployed app is **public** — anyone with the URL can use it
- To lock it down, you have a few options:
  1. **Cloudflare Access** in front of the Render URL (free, requires Cloudflare account)
  2. **Basic Auth** — add a middleware in Next.js (search "Next.js basic auth middleware")
  3. **Custom domain** with a long unguessable subdomain
- The `APP_ACCESS_TOKEN` env var in `render.yaml` is a placeholder — the current build doesn't enforce it, but you can wire it up by checking the `Authorization` header in `/api/search` and `/api/download`

---

## 📦 What's in this deployment package

```
.
├── Dockerfile              # Multi-stage Docker image (Node + Python + Xvfb)
├── render.yaml             # Render Blueprint (one-click deploy)
├── .dockerignore
├── scripts/
│   └── render-start.sh      # Container entrypoint — starts Xvfb + Next.js
├── README.md               # Local dev instructions
└── RENDER-DEPLOY.md        # ← this file
```

---

## ❓ FAQ

**Q: Why not deploy to Vercel?**
A: Vercel functions are serverless with read-only filesystems and no support for long-running processes. The FLAC downloader needs Python + Chromium + Xvfb running for up to 60 seconds per request — only a persistent container works.

**Q: Can I deploy to Fly.io / Railway / Heroku instead?**
A: Yes — they all support Docker. Use the same Dockerfile:
- **Fly.io**: `fly launch --dockerfile Dockerfile` then `fly deploy`
- **Railway**: connect the repo, Railway auto-detects Dockerfile
- **Heroku**: `heroku container:push web` + `heroku container:release web`

**Q: How do I scale this to 100+ users?**
A: This single-container setup handles ~1 concurrent download. For more, you'd need:
- Multiple Render instances behind a load balancer (Render's "Instances" setting)
- Or refactor to a queue-based architecture (Redis + worker dynos)
- Or use a dedicated VPS with more RAM

**Q: Can I download multiple FLACs in parallel?**
A: The current build processes one download at a time per instance. The frontend queues them sequentially. For parallel downloads, you'd need to run multiple Chromium contexts — a future enhancement.

---

Need help? Render support is fast: https://render.com/docs
Or just ask me — I can help you debug the deploy logs.
