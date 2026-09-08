#!/usr/bin/env bash
# render-start.sh
# -----------------------------------------------------------------------------
# Entry point for the FLAC Downloader container on Render.
# Starts Xvfb in the background (singleton), then launches Next.js.
# -----------------------------------------------------------------------------
set -e

echo "[startup] Preparing Xvfb on display :99 ..."
mkdir -p /tmp/.X11-unix
chmod 1777 /tmp/.X11-unix

# Start Xvfb as a background daemon. -ac disables access control so the
# Python worker can connect. -nolisten tcp keeps it local-only.
Xvfb :99 -screen 0 1280x800x24 -ac -nolisten tcp &
XVFB_PID=$!

# Give Xvfb a moment to come up
for i in $(seq 1 20); do
  if [ -S /tmp/.X11-unix/X99 ]; then
    echo "[startup] Xvfb is ready (pid $XVFB_PID)"
    break
  fi
  sleep 0.1
done

# Ensure Xvfb is cleaned up when the container exits
trap 'kill $XVFB_PID 2>/dev/null || true' EXIT TERM INT

echo "[startup] Starting Next.js (PORT=$PORT HOSTNAME=$HOSTNAME) ..."
# The standalone build runs `node server.js` from /app
exec node server.js
