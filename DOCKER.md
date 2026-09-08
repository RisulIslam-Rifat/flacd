# Docker Deployment Guide

This project ships as a **single self-contained container**. One image runs three things:

1. **Next.js 16** (standalone build) — the PWA frontend and the `/api/search` + `/api/download` routes
2. **Python 3 + Playwright + Chromium** — the download worker (`scripts/flac_download_worker.py`)
3. **Xvfb** — a virtual display, because the worker runs Chromium *headed* to get past flacdownloader.com's Cloudflare bot challenge

Download flow inside the container:
`POST /api/download` → request joins a serial queue (one Chromium at a time) → Node spawns the Python worker on virtual display `:99` → Chromium fetches the FLAC → the file is streamed back to the browser and the temp dir is deleted.

---

## Two Dockerfiles

| File | Use case | Port | Runs as |
|---|---|---|---|
| `Dockerfile` | Generic hosts: ClawCloud Run, Render, any VPS / self-hosting | 3000 | root |
| `Dockerfile.hf` | Hugging Face Spaces (requires **PRO**, see notes below) | 7860 | `user` (UID 1000) |

Everything below uses `Dockerfile`; the HF variant is covered at the end.

## Requirements

- Docker Engine 24+ (BuildKit enabled — default on modern installs)
- ~6 GB free disk for the build (Chromium + npm deps + build cache)
- **Host RAM ≥ 2 GB.** The download worker needs headroom for Chromium. On 512 MB hosts the site works but every download crashes the container (exit 137 / OOM).
- Outbound HTTPS (443) — the app calls flacdownloader.com and Deezer CDNs

## Quick start

```bash
# Build (first build takes ~5-10 minutes)
docker build -t flac-downloader .

# Run
docker run -d \
  --name flac-downloader \
  -p 3000:3000 \
  --restart unless-stopped \
  flac-downloader

# Open http://localhost:3000
```

Or with Compose (recommended for VPS — creates `docker-compose.yml`-managed container):

```bash
docker compose up -d --build
```

`docker-compose.yml` in this repo sets the port, restart policy, and a 2 GB memory limit.

## Environment variables

All of these have working defaults — you normally set none of them.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port the server listens on (platforms like Render/ClawCloud inject their own — that's fine, it wins) |
| `HOSTNAME` | `0.0.0.0` | Bind address — keep it so the container is reachable from outside |
| `PYTHON_BIN` | `python3` (resolves to `/app/.venv/bin/python3` via PATH) | Python interpreter used to run the download worker |
| `FLAC_WORKER_SCRIPT` | `<app dir>/scripts/flac_download_worker.py` | Path to the Python worker |
| `DISPLAY` | `:99` (Linux only) | Xvfb display for headed Chromium. On Windows/macOS dev machines Xvfb is skipped entirely |
| `PLAYWRIGHT_BROWSERS_PATH` | `/app/.cache/ms-playwright` | Where the Chromium binary lives (baked into the image) |
| `APP_ACCESS_TOKEN` | unset | Reserved for future use — **not enforced** by the current build |

## Verify the deployment

```bash
# 1. Homepage loads
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
# → 200

# 2. Search API returns real tracks
curl -s "http://localhost:3000/api/search?q=adele" | head -c 300

# 3. Full download test (takes ~30-90s; returns a real FLAC)
curl -X POST http://localhost:3000/api/download \
  -H "Content-Type: application/json" \
  -d '{"track":{"id":"1522223672","title":"Easy On Me","artist":"Adele","duration":224,"link":"https://www.deezer.com/track/1522223672"},"title":"Easy On Me","artist":"Adele"}' \
  -o test.flac -w "HTTP %{http_code}, %{size_download} bytes, %{time_total}s\n"

# 4. Confirm it is a genuine FLAC
python -c "print(open('test.flac','rb').read(4))"   # → b'fLaC'
```

## Logs and maintenance

```bash
docker logs -f flac-downloader        # follow logs (search/download activity shows here)
docker compose up -d --build          # rebuild after code changes
docker compose down                   # stop and remove
docker builder prune                  # reclaim build cache disk
```

Downloads are streamed through and temp files live only inside the container's `/tmp` (per-download dirs are cleaned up automatically) — no volumes are needed, and none are required for persistence.

## Deploying to specific hosts

### ClawCloud Run (free tier — $5/month credit, no credit card)

1. Push this repo to GitHub.
2. Sign in at `run.claw.cloud` with your GitHub account (must be ~180+ days old to receive the credit).
3. In **App Launchpad**, create an app from the image (see the GHCR option below for an automated image build), set the port to **3000**, and allocate **≥ 1 GB, ideally 2 GB RAM**.
4. ClawCloud gives you a public HTTPS URL — open it on your phone and use *Share → Add to Home Screen*.

**Automated image build (GHCR):** add a GitHub Actions workflow that builds `Dockerfile` and pushes to `ghcr.io/<user>/flac-downloader:latest`, then point ClawCloud at that image and hit *Redeploy* for updates.

### Render

`render.yaml` is ready for a Blueprint deploy — but check the plan against this table before spending money:

| Render plan | RAM | Downloads work? |
|---|---|---|
| Free / Starter ($7) | 512 MB | ❌ Chromium OOM — site + search only |
| Standard ($25) | 2 GB | ✅ |

Set `dockerfilePath: ./Dockerfile` (already in `render.yaml`); Render injects its own `PORT`, which the container honors.

### Hugging Face Spaces

⚠️ Docker Spaces now require a **PRO subscription ($9/mo)** — the "free HF" note in `README_HF.md` is outdated. If you have PRO:

1. Create a Space → SDK **Docker** → blank.
2. In the Space repo: copy this project over, renaming `Dockerfile.hf` → `Dockerfile` and `README_HF.md` → `README.md` (its frontmatter — `sdk: docker`, `app_port: 7860` — is already correct).
3. Push; the Space builds and serves at `https://<user>-<space>.hf.space`. Use **Protected** visibility (PRO) to keep the source private while the app URL stays public.

### Any VPS (Hetzner, Oracle, etc.)

```bash
git clone <your-repo> && cd music
docker compose up -d --build
# put Caddy/nginx in front for TLS if you want a domain — a Caddyfile is included
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Downloads return 502 `Spawn error: ... ENOENT` | Python or worker path wrong (custom image layout) | Set `PYTHON_BIN` and/or `FLAC_WORKER_SCRIPT` env vars |
| Worker log: `Executable doesn't exist ... chromium-XXXX` | Playwright Python package and the Chromium binary installed at build time are different versions (they normally release in lockstep; a build straddling a release can skew) | Rebuild the image; if it persists, pin both: install a specific `playwright==1.XX` pip version and run `bunx playwright@1.XX install chromium` with the same version |
| 502 `Worker produced no output` / Cloudflare errors | Upstream (flacdownloader.com) changed its page, API, or bot protection — the worker's UI selectors or the pinned `challenges.cloudflare.com` IP in the worker args may be stale | Check `docker logs`; update `scripts/flac_download_worker.py` selectors / remove the `--host-resolver-rules` pin |
| Container exits with code 137 | OOM — host RAM too small for Chromium | Give the container ≥ 2 GB (this is why Render free/starter fails) |
| First download after idle is slow (~10-20 s) | Xvfb + Chromium cold start | Normal; downloads are also serialized one-at-a-time by design |
| Search returns 502 | flacdownloader.com search API changed or is blocking your IP | Check `docker logs` for the upstream status code; the app proxies whatever upstream returns |
| Site loads but phone can't install PWA | Served over plain HTTP | PWA install requires HTTPS — use a platform URL (onrender.com / hf.space / ClawCloud URL) or put a reverse proxy with TLS in front |

## Security notes

- The generic `Dockerfile` runs as **root** inside the container (needed for the Xvfb socket on some hosts). The HF variant runs as UID 1000. Don't mount host paths you care about into the container.
- There is **no authentication** on the app or its API — anyone who finds your URL can search and download through it. Public deployment = public service; consider keeping the URL private or adding auth at the reverse-proxy layer.
- The app automates a third-party service (flacdownloader.com) that it has no API agreement with; expect upstream changes to break downloads from time to time, and review the service's terms before deploying publicly.
