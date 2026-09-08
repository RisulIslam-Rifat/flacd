# =============================================================================
# FLAC Downloader — Docker image for Render (and any Docker host)
# -----------------------------------------------------------------------------
# Single-container image that ships:
#   - Node.js 20 + Next.js 16 standalone build
#   - Python 3 + Playwright (Chromium) for the FLAC download worker
#   - Xvfb for headed Chromium (Cloudflare bot-challenge bypass)
#
# Build:  docker build -t flac-downloader .
# Run:    docker run -p 3000:3000 -e PORT=3000 flac-downloader
# =============================================================================

FROM node:20-bookworm-slim AS base

# ---------------------------------------------------------------------------
# Stage 1: install OS deps (Python, Xvfb, Playwright OS libs)
# ---------------------------------------------------------------------------
FROM base AS deps

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-pip python3-venv \
        xvfb \
        # Playwright Chromium runtime deps
        libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
        libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
        libxfixes3 libxrandr2 libgbm1 libxshmfence1 libasound2 \
        libpangocairo-1.0-0 libpango-1.0-0 libcairo2 libatspi2.0-0 \
        libgtk-3-0 \
        # Misc
        fonts-liberation fonts-noto-color-emoji \
        ca-certificates curl tini \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# Stage 2: install Bun + Node deps
# ---------------------------------------------------------------------------
FROM deps AS node-deps

WORKDIR /app

# Install Bun (faster than npm; matches the project's bun.lock)
RUN curl -fsSL https://bun.sh/install | bash && \
    ln -s /root/.bun/bin/bun /usr/local/bin/bun

# Copy lockfile + package.json first for better layer caching
COPY package.json bun.lock ./

# Install deps (this includes Playwright npm package which provides the CLI)
RUN bun install --frozen-lockfile

# Install Chromium browser binary via the Playwright CLI
RUN bunx playwright install --with-deps chromium

# ---------------------------------------------------------------------------
# Stage 3: build Next.js (standalone output)
# ---------------------------------------------------------------------------
FROM node-deps AS builder

WORKDIR /app

# Copy rest of source
COPY tsconfig.json next.config.ts next-env.d.ts ./
COPY postcss.config.mjs tailwind.config.ts components.json eslint.config.mjs ./
COPY src ./src
COPY public ./public
COPY prisma ./prisma

# Prisma client generation (optional — schema is currently empty)
RUN bun run db:generate || true

# Build Next.js (produces .next/standalone + .next/static)
RUN bun run build

# ---------------------------------------------------------------------------
# Stage 4: runtime image (slim)
# ---------------------------------------------------------------------------
FROM deps AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DISPLAY=:99
# Persist the Playwright browser profile between requests
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.cache/ms-playwright
# Python venv to keep packages isolated
ENV PATH="/app/.venv/bin:${PATH}"

# Create a non-root user (Render runs as root by default, but we follow best practice)
# We DO need to run as root for Xvfb socket creation in /tmp/.X11-unix — so we stay root.
# Create writable dirs
RUN mkdir -p /app/.cache/ms-playwright /app/.venv /tmp/.X11-unix /tmp/flacdownloader_profile && \
    chmod 1777 /tmp/.X11-unix /tmp/flacdownloader_profile

# Install Python Playwright into a venv
RUN python3 -m venv /app/.venv && \
    /app/.venv/bin/pip install --no-cache-dir --upgrade pip && \
    /app/.venv/bin/pip install --no-cache-dir playwright

# Copy the standalone Next.js server + static assets from the builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy the Python worker script
COPY --from=builder /app/scripts ./scripts

# Copy the Playwright browser binary we installed earlier
COPY --from=node-deps /root/.cache/ms-playwright /app/.cache/ms-playwright

# Copy node binary (standalone build expects node in PATH)
COPY --from=node-deps /usr/local/bin/node /usr/local/bin/node

# Startup script: launch Xvfb in the background, then start Next.js
COPY scripts/render-start.sh /app/render-start.sh
RUN chmod +x /app/render-start.sh

EXPOSE 3000

# tini handles signals properly so SIGTERM works on Render's redeploy
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/app/render-start.sh"]
