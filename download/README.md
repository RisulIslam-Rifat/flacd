# FLAC Downloader — Mobile App (PWA)

A cross-platform mobile-first Progressive Web App that lets you search any artist and download their tracks as true lossless FLAC audio. Installable on both **iOS** and **Android** — no App Store or Play Store needed.

Built on top of the original `flac_downloader.py` Playwright script.

---

## ✨ Features

- 🔎 **Search** any artist — powered by `flacdownloader.com`
- 🎧 **Preview** any track (30-second MP3) before downloading
- ⬇️ **Download FLAC** — true lossless audio (16-bit / 44.1 kHz)
- 📱 **Installable PWA** — works on iOS + Android via "Add to Home Screen"
- 🌗 **Dark / Light mode** with mobile safe-area support (notch + home indicator)
- 💾 **Persistent history** and download queue (localStorage via Zustand)
- 🎨 Warm amber theme, vinyl-spin animation, audio equalizer bars

---

## 📦 Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York)
- **State**: Zustand (persisted) + TanStack Query
- **Theme**: next-themes (dark/light)
- **Backend**: Next.js API Routes
  - `/api/search` → proxies `flacdownloader.com/search` (60s cache)
  - `/api/download` → spawns Python helper inside **Xvfb** (for Cloudflare bot-challenge bypass), streams the FLAC file back to the client
- **Download engine**: Python + Playwright (headed Chromium inside Xvfb)
- **PWA**: `manifest.webmanifest` with standalone display, maskable icons

---

## 🚀 Run locally

### Prerequisites

- **Node.js 20+** and **Bun** (or npm/pnpm/yarn)
- **Python 3.10+** with `playwright` installed:
  ```bash
  pip install playwright
  playwright install chromium
  ```
- **Xvfb** (Linux only — needed because flacdownloader.com sits behind Cloudflare which blocks headless browsers):
  ```bash
  # Debian/Ubuntu
  sudo apt-get install -y xvfb
  ```

### Install & start

```bash
bun install         # or: npm install / pnpm install
bun run db:push     # optional — initialize SQLite via Prisma
bun run dev         # starts Next.js on http://localhost:3000
```

Open `http://localhost:3000` in your browser.

### Install on your phone (same network)

1. Find your computer's local IP, e.g. `192.168.1.42`
2. Start dev with `--hostname`:
   ```bash
   bun run dev -- -H 0.0.0.0
   ```
3. On your phone, open `http://192.168.1.42:3000`
4. **iOS**: Safari → Share → Add to Home Screen
5. **Android**: Chrome → ⋮ → Add to Home screen / Install app

---

## 📁 Project structure

```
.
├── src/
│   ├── app/
│   │   ├── layout.tsx          # PWA metadata, manifest, safe-area viewport
│   │   ├── page.tsx            # Main mobile UI
│   │   ├── globals.css         # Amber theme + mobile utilities
│   │   └── api/
│   │       ├── search/route.ts # Proxies flacdownloader.com search
│   │       └── download/route.ts# Spawns Python helper, streams FLAC
│   ├── components/
│   │   ├── flac/               # SearchBar, TrackCard, PreviewPlayer, etc.
│   │   ├── theme-provider.tsx
│   │   └── ui/                 # shadcn/ui components
│   └── lib/
│       ├── store.ts            # Zustand (history + download queue)
│       ├── types.ts            # Track / SearchResponse types
│       └── db.ts               # Prisma client (optional)
├── scripts/
│   ├── flac_download_worker.py # Python Playwright worker
│   └── gen_icons.mjs           # Icon generator (sharp)
├── public/
│   ├── manifest.webmanifest
│   ├── icons/
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   └── logo.svg
├── prisma/schema.prisma
├── package.json
└── README.md
```

---

## 🌐 Deploy

This is a standard Next.js 16 app — deploy anywhere that supports Node:

- **Vercel** (recommended): `vercel --prod` (Note: the Python+Xvfb worker needs a different host — see below)
- **Self-hosted**: `bun run build && bun run start` on a Linux server with Python + Xvfb installed

### Important — the Python worker

The `/api/download` route spawns a Python subprocess that uses Playwright in headed mode inside Xvfb to bypass Cloudflare's bot challenge. This will NOT work on:

- Serverless platforms with read-only filesystems (Vercel functions, Netlify, Cloudflare Workers)
- Containers without Xvfb

**For production**: deploy on a Linux VPS (e.g. DigitalOcean, Hetzner, AWS EC2) with:

```bash
sudo apt-get install -y xvfb python3-pip
pip3 install playwright
playwright install chromium
```

The API route automatically manages a singleton Xvfb on display `:99`.

---

## 📝 How the download flow works

1. User taps **FLAC** on a track
2. Frontend POSTs the track object to `/api/download`
3. API route:
   - Ensures Xvfb is running on display `:99` (singleton)
   - Spawns `python3 scripts/flac_download_worker.py`
   - Sends JSON payload via stdin: `{ track, output_path }`
4. Python worker:
   - Launches persistent Chromium context (headed, in Xvfb)
   - Visits `flacdownloader.com/en`
   - Sets `localStorage["dl_track"]` with the track JSON (mirrors the original script)
   - Navigates to `/en/download`
   - Clicks the FLAC button
   - Awaits the browser download event
   - Saves the file to `output_path`
   - Prints a JSON status line to stdout
5. API route streams the file back to the client as `audio/flac` with `Content-Disposition: attachment`
6. Frontend creates a blob URL and triggers a download

---

## ⚠️ Legal note

This project wraps `flacdownloader.com` for personal use. Respect copyright laws in your country and the terms of service of the upstream site. Only download music you have the legal right to obtain.

---

Built with ❤️ using Next.js, Playwright, and shadcn/ui.
