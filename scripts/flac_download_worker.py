"""
FLAC Download Worker (server-side helper for the Next.js mobile app)
=====================================================================
Invoked by the Next.js /api/download route via subprocess.

Input  : a single JSON line on stdin describing the track
Output : writes the downloaded FLAC file to <output_path>, then prints
         a single JSON line to stdout with the result.

Schema of stdin:
    {"track": {...}, "output_path": "/tmp/abc.flac"}

Schema of stdout (success):
    {"ok": true, "file": "/tmp/abc.flac", "size": 12345678}
Schema of stdout (failure):
    {"ok": false, "error": "human-readable message"}
"""

import asyncio
import json
import os
import sys
import re
import tempfile
from pathlib import Path

# Force UTF-8 stdout (we use it to emit JSON to the parent Node process)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)

# Playwright is provided by the system Python venv at /home/z/.venv
from playwright.async_api import async_playwright

BASE_URL = "https://flacdownloader.com"
DOWNLOAD_TIMEOUT_MS = 180_000  # 3 minutes per track for large FLAC files


def emit(obj):
    """Emit a single JSON line to stdout and flush."""
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def sanitize_filename(name: str) -> str:
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', name)
    name = name.strip('. ')
    return name or "unknown"


async def run(track: dict, output_path: str):
    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    # Use a UNIQUE profile dir per download. If we share one dir, Playwright's
    # persistent context requires exclusive access and concurrent downloads
    # will fail with "ProcessSingleton" lock errors.
    import secrets
    profile_dir = Path(tempfile.gettempdir()) / f"flacdownloader_profile_{secrets.token_hex(6)}"
    profile_dir.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        context = await p.chromium.launch_persistent_context(
            user_data_dir=str(profile_dir.resolve()),
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--host-resolver-rules=MAP *.challenges.cloudflare.com 104.18.94.41, MAP challenges.cloudflare.com 104.18.94.41",
            ],
            viewport={"width": 1280, "height": 800},
            accept_downloads=True,
        )
        page = context.pages[0] if context.pages else await context.new_page()

        try:
            # 0. Visit the base page first so we are on the correct origin
            # and have access to localStorage for flacdownloader.com.
            await page.goto(f"{BASE_URL}/en", wait_until="domcontentloaded")
            await page.wait_for_timeout(800)

            # 1. Set track state in localStorage (mirrors the original Python script)
            await page.evaluate(
                """
                (t) => {
                    localStorage.setItem("dl_track", JSON.stringify({
                        track: t,
                        source: "deezer",
                        lang: "en"
                    }));
                }
                """,
                track,
            )

            # 2. Navigate to download page
            await page.goto(f"{BASE_URL}/en/download", wait_until="domcontentloaded")
            await page.wait_for_timeout(2500)

            # 3. Locate FLAC button
            flac_btn = page.locator("button:has-text('FLAC')").first
            if not await flac_btn.is_visible(timeout=6000):
                emit({"ok": False, "error": "FLAC button not available for this track"})
                return

            # 4. Trigger download and await file delivery
            async with page.expect_download(timeout=DOWNLOAD_TIMEOUT_MS) as dl_info:
                await flac_btn.click()

            download = await dl_info.value
            suggested = download.suggested_filename
            ext = Path(suggested).suffix if suggested else ".flac"
            if not ext.lower().endswith("flac"):
                ext = ".flac"

            # Make sure final file ends with .flac and matches the requested path
            final_path = out_file if str(out_file).lower().endswith(".flac") else out_file.with_suffix(ext)
            await download.save_as(str(final_path))

            size = final_path.stat().st_size
            emit({"ok": True, "file": str(final_path), "size": size})
        except Exception as e:
            emit({"ok": False, "error": f"Download failed: {e}"})
        finally:
            try:
                await context.close()
            except Exception:
                pass
            # Clean up the per-download profile dir to avoid filling /tmp.
            try:
                import shutil
                shutil.rmtree(profile_dir, ignore_errors=True)
            except Exception:
                pass


def main():
    try:
        payload = json.loads(sys.stdin.read())
    except Exception as e:
        emit({"ok": False, "error": f"Invalid input JSON: {e}"})
        return

    track = payload.get("track")
    output_path = payload.get("output_path")
    if not track or not output_path:
        emit({"ok": False, "error": "Missing 'track' or 'output_path' in input"})
        return

    try:
        asyncio.run(run(track, output_path))
    except Exception as e:
        emit({"ok": False, "error": f"Worker crashed: {e}"})


if __name__ == "__main__":
    main()
