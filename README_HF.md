---
title: FLAC Downloader
emoji: 🎵
colorFrom: amber
colorTo: orange
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# 🎵 FLAC Downloader (Free PWA on Hugging Face Spaces)

Search any artist and download their tracks as true lossless FLAC audio — installable as a mobile app on iOS & Android.

## How this Space works

- **Frontend**: Next.js 16 mobile PWA (`/`)
- **Backend API**: `/api/search` proxies flacdownloader.com, `/api/download` spawns Python + Playwright + Chromium inside Xvfb to fetch the FLAC file
- **Free tier**: HF Spaces runs this at zero cost, with 16 GB RAM and persistent storage at `/data`

## Install on your phone

1. Open this Space's URL in Safari (iOS) or Chrome (Android)
2. Tap **Share** → **Add to Home Screen**
3. The amber music-note icon launches the app full-screen

## Notes

- The Space sleeps after 48 hours of inactivity but wakes on the next request (~5 seconds)
- First request after a sleep may take ~10 seconds (Chromium cold start)
- Source: see the `Dockerfile.hf` in this repo
