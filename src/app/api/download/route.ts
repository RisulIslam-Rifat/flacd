import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { tmpdir } from 'os'
import { mkdtempSync, createReadStream, unlinkSync, statSync, existsSync, rmSync } from 'fs'
import { join } from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Allow up to 5 minutes for Playwright to fetch the FLAC file.
export const maxDuration = 300

// ---------------------------------------------------------------------------
// Server-side download mutex. The Python worker spawns Chromium on display
// :99 (single Xvfb instance). Running two Chromium instances on the same
// display causes X server conflicts and bot-detection. We queue downloads
// one at a time per server instance.
// ---------------------------------------------------------------------------
let downloadQueue: Promise<unknown> = Promise.resolve()
function withDownloadLock<T>(task: () => Promise<T>): Promise<T> {
  const next = downloadQueue.then(task, task)
  // Keep the chain going even if this task rejects.
  downloadQueue = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}

interface DownloadBody {
  track?: Record<string, unknown>
  title?: string
  artist?: string
}

function sanitizeFilename(name: string): string {
  return (name || 'unknown')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .trim()
    .replace(/^[. ]+|[. ]+$/g, '') || 'unknown'
}

// ---------------------------------------------------------------------------
// Singleton Xvfb manager — flacdownloader.com sits behind a Cloudflare bot
// challenge that blocks headless Chromium. The original Python script uses
// a HEADED browser, so we run Playwright inside a virtual X server. We keep
// a single Xvfb process alive on display :99 to avoid per-request startup
// latency.
// ---------------------------------------------------------------------------

let xvfbProc: ReturnType<typeof spawn> | null = null
let xvfbStartedAt = 0

function ensureXvfb(): Promise<string> {
  return new Promise((resolve) => {
    if (xvfbProc && !xvfbProc.killed) {
      resolve(':99')
      return
    }
    try {
      xvfbProc = spawn(
        'Xvfb',
        [':99', '-screen', '0', '1280x800x24', '-ac', '-nolisten', 'tcp'],
        {
          stdio: 'ignore',
          detached: false,
        },
      )
      xvfbStartedAt = Date.now()
      xvfbProc.on?.('exit', () => {
        xvfbProc = null
      })
      // Best-effort wait for Xvfb socket
      const start = Date.now()
      const tick = () => {
        if (existsSync('/tmp/.X11-unix/X99') || Date.now() - start > 2000) {
          resolve(':99')
        } else {
          setTimeout(tick, 50)
        }
      }
      tick()
    } catch {
      xvfbProc = null
      resolve(':99')
    }
  })
}

/**
 * POST /api/download
 * Body: { track: {...raw track object from search...}, title, artist }
 *
 * Spawns the Python helper at /home/z/my-project/scripts/flac_download_worker.py
 * which uses Playwright (headed, inside Xvfb) to fetch the FLAC file from
 * flacdownloader.com, then streams the file back to the client as `audio/flac`
 * with Content-Disposition.
 */
export async function POST(req: NextRequest) {
  let body: DownloadBody
  try {
    body = (await req.json()) as DownloadBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const track = body.track
  if (!track || typeof track !== 'object') {
    return NextResponse.json({ ok: false, error: 'Missing "track" in body' }, { status: 400 })
  }

  // Build a clean output path: /tmp/flac-dl-<uuid>/<Artist - Title>.flac
  const workDir = mkdtempSync(join(tmpdir(), 'flac-dl-'))
  const artist = sanitizeFilename(body.artist || (track as any).artist || 'Unknown Artist')
  const title = sanitizeFilename(body.title || (track as any).title || 'Untitled')
  const filename = `${artist} - ${title}.flac`
  const outputPath = join(workDir, filename)

  // Headed Playwright needs a virtual display only on headless Linux servers
  // (Docker/Render/HF). On dev machines with a real display (Windows/macOS)
  // Chromium can open headed directly and Xvfb doesn't exist.
  if (process.platform === 'linux') {
    await ensureXvfb()
  }

  // Resolve Python + worker from the app itself so the same code runs in dev
  // and in Docker (where /app/.venv/bin is on PATH). Override with env vars
  // when the layout differs.
  const pythonBin =
    process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3')
  const scriptPath =
    process.env.FLAC_WORKER_SCRIPT || join(process.cwd(), 'scripts', 'flac_download_worker.py')
  const payload = JSON.stringify({ track, output_path: outputPath })

  // Run the download through a per-server mutex — only one Chromium at a
  // time can use Xvfb display :99 without colliding.
  const result = await withDownloadLock(
    () =>
      new Promise<{ ok: boolean; file?: string; size?: number; error?: string }>(
        (resolve) => {
          const child = spawn(pythonBin, [scriptPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
              ...process.env,
              PYTHONUNBUFFERED: '1',
              ...(process.platform === 'linux' ? { DISPLAY: ':99' } : {}),
            },
          })

          let stdout = ''
          let stderr = ''
          let settled = false

          child.stdout.on('data', (d) => {
            stdout += d.toString()
          })
          child.stderr.on('data', (d) => {
            stderr += d.toString()
          })

          child.on('error', (err) => {
            if (settled) return
            settled = true
            resolve({ ok: false, error: `Spawn error: ${err.message}` })
          })

          child.on('close', () => {
            if (settled) return
            settled = true
            // Find the last non-empty line of stdout — that is the JSON result.
            const lines = stdout.split('\n').map((l) => l.trim()).filter(Boolean)
            const lastLine = lines[lines.length - 1]
            if (!lastLine) {
              resolve({
                ok: false,
                error: `Worker produced no output. stderr: ${stderr.slice(-400)}`,
              })
              return
            }
            try {
              const parsed = JSON.parse(lastLine)
              resolve(parsed)
            } catch {
              resolve({ ok: false, error: `Worker output not JSON: ${lastLine.slice(0, 200)}` })
            }
          })

          // Send the payload via stdin and close it.
          child.stdin.write(payload)
          child.stdin.end()
        },
      ),
  )

  if (!result.ok || !result.file) {
    // Nothing to stream — drop the temp dir so failed downloads don't fill /tmp.
    try {
      rmSync(workDir, { recursive: true, force: true })
    } catch {}
    return NextResponse.json(
      { ok: false, error: result.error || 'Download failed' },
      { status: 502 },
    )
  }

  // Stream the FLAC file back to the client.
  try {
    const stat = statSync(result.file)
    const stream = createReadStream(result.file)

    // Convert Node stream to a Web ReadableStream for Next.js Response.
    // Guard every enqueue/close call against the "Controller is already
    // closed" race — Node may emit late `data` events after the consumer
    // (browser) has cancelled the response.
    const webStream = new ReadableStream({
      start(controller) {
        let closed = false
        const cleanupDir = () => {
          try {
            rmSync(workDir, { recursive: true, force: true })
          } catch {}
        }
        const safeEnqueue = (chunk: Uint8Array) => {
          if (closed) return
          try {
            controller.enqueue(chunk)
          } catch {
            // Controller was closed by the consumer — stop reading.
            closed = true
            try { stream.destroy() } catch {}
            cleanupDir()
          }
        }
        const safeClose = () => {
          if (closed) return
          closed = true
          try { controller.close() } catch {}
          // Clean up the temp dir once streamed.
          try { unlinkSync(result.file!) } catch {}
          cleanupDir()
        }
        stream.on('data', (chunk: Buffer) => safeEnqueue(new Uint8Array(chunk)))
        stream.on('end', safeClose)
        stream.on('error', (err) => {
          console.error('stream error', err)
          safeClose()
        })
      },
      // If the browser cancels the download (e.g. user closes the tab),
      // release the Node stream and remove the temp dir.
      cancel() {
        try { stream.destroy() } catch {}
        try { rmSync(workDir, { recursive: true, force: true }) } catch {}
      },
    })

    const downloadFilename = encodeURIComponent(filename)
    return new NextResponse(webStream as any, {
      status: 200,
      headers: {
        'Content-Type': 'audio/flac',
        'Content-Length': String(stat.size),
        'Content-Disposition': `attachment; filename="${downloadFilename}"; filename*=UTF-8''${downloadFilename}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: `Failed to stream file: ${e?.message || 'unknown error'}` },
      { status: 500 },
    )
  }
}
