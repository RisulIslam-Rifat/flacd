'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Download as DownloadIcon, Music4, Sun, Moon, Github } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { SearchBar } from '@/components/flac/search-bar'
import { HistoryStrip } from '@/components/flac/history-strip'
import { TrackCard } from '@/components/flac/track-card'
import { PreviewPlayer } from '@/components/flac/preview-player'
import { DownloadsPanel } from '@/components/flac/downloads-panel'
import { EmptyState } from '@/components/flac/empty-state'
import { useAppStore } from '@/lib/store'
import type { DownloadJob } from '@/lib/store'
import type { Track } from '@/lib/types'

export default function Home() {
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewTrack, setPreviewTrack] = useState<Track | null>(null)
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null)

  const [showDownloads, setShowDownloads] = useState(false)

  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const { history, pushHistory, clearHistory, jobs, upsertJob, setJobStatus, clearDone } =
    useAppStore()

  // Hydration: only show theme toggle after mount
  useEffect(() => setMounted(true), [])

  // Progress timer for "running" jobs — gives a visible progress estimate
  // since the upstream doesn't report byte progress.
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    const hasRunning = Object.values(jobs).some((j) => j.status === 'running')
    if (!hasRunning) {
      if (tickRef.current) {
        clearInterval(tickRef.current)
        tickRef.current = null
      }
      return
    }
    if (!tickRef.current) {
      tickRef.current = setInterval(() => {
        const next = { ...useAppStore.getState().jobs }
        for (const [id, j] of Object.entries(next)) {
          if (j.status === 'running') {
            // Asymptotically approach 95% — a fake-but-honest estimate.
            const p = Math.min(95, (j.progress ?? 0) + Math.random() * 4)
            next[id] = { ...j, progress: p }
          }
        }
        useAppStore.setState({ jobs: next })
      }, 700)
    }
    return () => {
      if (tickRef.current && !Object.values(jobs).some((j) => j.status === 'running')) {
        clearInterval(tickRef.current)
        tickRef.current = null
      }
    }
  }, [jobs])

  const runSearch = useCallback(
    async (q: string, nextPage = 0, append = false) => {
      if (!q.trim()) return
      if (nextPage === 0) {
        setLoading(true)
        setError(null)
        setTracks([])
        setHasMore(false)
        setPage(0)
      } else {
        setLoadingMore(true)
      }
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&page=${nextPage}`)
        const data = await res.json()
        if (!data.ok) {
          throw new Error(data.error || 'Search failed')
        }
        const newTracks = (data.tracks || []) as Track[]
        // Deduplicate against what's already loaded
        if (append) {
          setTracks((prev) => {
            const seen = new Set(prev.map((t) => t.id))
            const additions = newTracks.filter((t) => !seen.has(t.id))
            return [...prev, ...additions]
          })
        } else {
          setTracks(newTracks)
        }
        setHasMore(Boolean(data.hasMore))
        setPage(nextPage)
        setSubmittedQuery(q)
        if (nextPage === 0) pushHistory(q)
      } catch (e: any) {
        setError(e?.message || 'Unknown error')
        toast.error('Search failed', { description: e?.message })
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [pushHistory],
  )

  const onSubmit = () => {
    const q = query.trim()
    if (!q) return
    runSearch(q, 0, false)
  }

  const loadMore = () => {
    if (loadingMore || !hasMore || !submittedQuery) return
    runSearch(submittedQuery, page + 1, true)
  }

  const onPreview = useCallback((previewUrl: string | null, trackId: string) => {
    if (!previewUrl) {
      toast.info('No preview available for this track.')
      return
    }
    // If the same track is playing, toggle off
    if (previewTrackId === trackId && previewUrl !== null) {
      setPreviewUrl(null)
      setPreviewTrackId(null)
      setPreviewTrack(null)
      return
    }
    setPreviewUrl(previewUrl)
    setPreviewTrackId(trackId)
    const t = tracks.find((t) => t.id === trackId) || null
    setPreviewTrack(t)
  }, [previewTrackId, tracks])

  const onDownload = useCallback(
    async (track: Track) => {
      const jobId = `dl-${track.id}-${Date.now()}`
      upsertJob({
        id: jobId,
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        cover: track.cover,
        status: 'running',
        progress: 5,
        startedAt: Date.now(),
      })
      toast.success('Download started', {
        description: `${track.artist} — ${track.title}`,
      })

      try {
        const res = await fetch('/api/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            track: {
              id: track.id,
              title: track.title,
              artist: track.artist,
              cover: track.cover,
              duration: track.duration,
              link: track.link,
              preview: track.preview,
              album: track.album,
            },
            title: track.title,
            artist: track.artist,
          }),
        })

        if (!res.ok) {
          let msg = `Server returned ${res.status}`
          try {
            const j = await res.json()
            if (j?.error) msg = j.error
          } catch {}
          throw new Error(msg)
        }

        // Convert the response into a downloadable blob URL on the client.
        const blob = await res.blob()
        if (!blob.size || blob.size < 1024) {
          throw new Error('Received empty FLAC file — the server may have been blocked.')
        }

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${track.artist} - ${track.title}.flac`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 5000)

        setJobStatus(jobId, 'done', {
          progress: 100,
          finishedAt: Date.now(),
        })
        toast.success('Download complete', {
          description: `${track.artist} — ${track.title} (${(blob.size / 1024 / 1024).toFixed(1)} MB)`,
        })
      } catch (e: any) {
        const msg = e?.message || 'Download failed'
        setJobStatus(jobId, 'failed', { error: msg, finishedAt: Date.now() })
        toast.error('Download failed', { description: msg })
      }
    },
    [upsertJob, setJobStatus],
  )

  // Return the most recently-created job for a given track, if any.
  const latestJobFor = useCallback(
    (trackId: string): DownloadJob | undefined => {
      const all = Object.values(jobs).filter((j) => j.trackId === trackId)
      if (all.length === 0) return undefined
      return all.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))[0]
    },
    [jobs],
  )

  const onOpenSource = useCallback((track: Track) => {
    if (track.link) {
      window.open(track.link, '_blank', 'noopener,noreferrer')
    } else {
      window.open('https://flacdownloader.com/en', '_blank', 'noopener,noreferrer')
    }
  }, [])

  const runningCount = Object.values(jobs).filter((j) => j.status === 'running').length
  const finishedCount = Object.values(jobs).filter((j) => j.status === 'done').length

  return (
    <div className="min-h-screen-safe bg-gradient-to-b from-background to-muted/40">
      {/* Header — mobile sticky */}
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border safe-pt">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-sm">
              <Music4 className="h-5 w-5" />
              <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
            </div>
            <div className="leading-tight">
              <h1 className="font-semibold text-foreground text-base">FLAC Downloader</h1>
              <p className="text-[10px] text-muted-foreground -mt-0.5">Lossless music · iOS · Android</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label="Toggle dark mode"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full relative"
              onClick={() => setShowDownloads(true)}
              aria-label="Open download queue"
            >
              <DownloadIcon className="h-4 w-4" />
              {runningCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] grid place-items-center font-medium">
                  {runningCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-md px-4 pb-32">
        {/* Hero / search section */}
        <section className="pt-6 space-y-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">
              Get every song in <span className="text-primary">FLAC</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              Search any artist. We&apos;ll find their tracks and let you download each one in true lossless quality — all from your phone.
            </p>
          </div>

          <SearchBar
            value={query}
            onChange={setQuery}
            onSubmit={onSubmit}
            loading={loading}
          />

          {!submittedQuery && <HistoryStrip history={history} onPick={(q) => { setQuery(q); runSearch(q, 0, false) }} onClear={clearHistory} />}
        </section>

        {/* Results */}
        <section className="mt-6">
          {loading && tracks.length === 0 ? (
            <EmptyState loading={true} error={null} hasQuery={Boolean(submittedQuery)} />
          ) : error ? (
            <EmptyState loading={false} error={error} hasQuery={Boolean(submittedQuery)} />
          ) : tracks.length === 0 ? (
            <EmptyState loading={false} error={null} hasQuery={Boolean(submittedQuery)} />
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{tracks.length}</span> track(s)
                  {submittedQuery && (
                    <>
                      {' '}for <span className="font-medium text-foreground">{submittedQuery}</span>
                    </>
                  )}
                </div>
                {runningCount > 0 && (
                  <div className="text-xs text-primary">
                    {runningCount} downloading…
                  </div>
                )}
              </div>
              <div className="space-y-2.5">
                {tracks.map((t, idx) => (
                  <TrackCard
                    key={t.id}
                    track={t}
                    index={idx}
                    activePreview={previewTrackId}
                    onPreview={onPreview}
                    onDownload={onDownload}
                    job={latestJobFor(t.id)}
                    onOpenSource={onOpenSource}
                  />
                ))}
              </div>

              {hasMore && (
                <div className="mt-5 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="rounded-full"
                  >
                    {loadingMore ? 'Loading…' : 'Load more tracks'}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-border text-center text-xs text-muted-foreground safe-pb">
          <p>
            Lossless audio for iOS &amp; Android ·{' '}
            <span className="font-medium text-foreground">{finishedCount}</span> track(s) downloaded this session
          </p>
          <p className="mt-1.5 opacity-80">
            Add this page to your home screen to use it like a native app.
          </p>
          <a
            href="https://flacdownloader.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-muted-foreground/70 hover:text-foreground"
          >
            <Github className="h-3 w-3" />
            powered by flacdownloader.com
          </a>
        </footer>
      </main>

      {/* Preview player (bottom floating) */}
      <PreviewPlayer
        track={previewTrack}
        previewUrl={previewUrl}
        onClose={() => {
          setPreviewUrl(null)
          setPreviewTrackId(null)
          setPreviewTrack(null)
        }}
      />

      {/* Downloads panel (modal) */}
      {showDownloads && (
        <DownloadsPanel
          jobs={jobs}
          onClose={() => setShowDownloads(false)}
          onClearDone={clearDone}
        />
      )}

      <Toaster position="top-center" />
    </div>
  )
}
