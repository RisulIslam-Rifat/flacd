import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Long-running because Playwright download can take 1-3 minutes for large FLACs.
export const maxDuration = 300

const BASE_URL = 'https://flacdownloader.com'

// Simple in-memory cache to be polite to upstream.
const cache = new Map<string, { at: number; json: any }>()
const CACHE_TTL_MS = 60_000 // 1 minute
const CACHE_MAX_ENTRIES = 200 // Map keeps insertion order — evict oldest when full

interface RawTrack {
  id?: number | string
  title?: string
  artist?: string | { name?: string }
  cover?: string
  duration?: number
  link?: string
  preview?: string
  album?: string | { title?: string }
}

interface NormalizedTrack {
  id: string
  title: string
  artist: string
  cover: string | null
  duration: number
  durationLabel: string
  link: string | null
  preview: string | null
  album: string | null
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function normalizeArtist(a: RawTrack['artist']): string {
  if (!a) return 'Unknown Artist'
  if (typeof a === 'string') return a
  return a.name || 'Unknown Artist'
}

function normalizeAlbum(a: RawTrack['album']): string | null {
  if (!a) return null
  if (typeof a === 'string') return a
  return a.title || null
}

function normalizeTracks(raw: RawTrack[]): NormalizedTrack[] {
  return (raw || [])
    .map((t) => ({
      id: t.id != null ? String(t.id) : `${t.title}-${t.artist}`,
      title: t.title || 'Untitled',
      artist: normalizeArtist(t.artist),
      cover: t.cover || null,
      duration: Number(t.duration) || 0,
      durationLabel: formatDuration(Number(t.duration) || 0),
      link: t.link || null,
      preview: t.preview || null,
      album: normalizeAlbum(t.album),
    }))
    .filter((t) => t.title !== 'Untitled' || t.artist !== 'Unknown Artist')
}

/**
 * GET /api/search?q=<query>&page=<index>
 * Proxies flacdownloader.com search and returns a normalized, deduplicated track list.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = (searchParams.get('q') || '').trim()
  const page = Math.max(0, Number(searchParams.get('page') || '0'))

  if (!query) {
    return NextResponse.json({ ok: false, error: 'Missing query parameter "q"' }, { status: 400 })
  }

  const cacheKey = `${query.toLowerCase()}|${page}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.json)
  }

  try {
    const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}&index=${page}`
    const upstream = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: `${BASE_URL}/en`,
      },
      redirect: 'follow',
    })

    if (!upstream.ok) {
      return NextResponse.json(
        { ok: false, error: `Upstream search returned ${upstream.status}` },
        { status: 502 },
      )
    }

    const json = (await upstream.json()) as { tracks?: RawTrack[]; has_more?: boolean }
    const rawTracks = Array.isArray(json.tracks) ? json.tracks : []
    const tracks = normalizeTracks(rawTracks)
    const hasMore = Boolean(json.has_more) && rawTracks.length >= 5

    const response = {
      ok: true,
      query,
      page,
      hasMore,
      total: tracks.length,
      tracks,
    }

    cache.set(cacheKey, { at: Date.now(), json: response })
    if (cache.size > CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
    return NextResponse.json(response)
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: `Search failed: ${e?.message || 'unknown error'}` },
      { status: 500 },
    )
  }
}
