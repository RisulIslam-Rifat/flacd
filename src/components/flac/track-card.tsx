'use client'

import { useState } from 'react'
import { Play, Pause, Download, Loader2, CheckCircle2, XCircle, ExternalLink, Clock3, Music4 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { Track } from '@/lib/types'
import type { DownloadJob } from '@/lib/store'

interface TrackCardProps {
  track: Track
  index: number
  activePreview: string | null
  onPreview: (previewUrl: string | null, trackId: string) => void
  onDownload: (track: Track) => void
  job?: DownloadJob
  onOpenSource: (track: Track) => void
}

function statusIcon(status?: DownloadJob['status']) {
  switch (status) {
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin" />
    case 'done':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    case 'failed':
      return <XCircle className="h-4 w-4 text-destructive" />
    default:
      return <Download className="h-4 w-4" />
  }
}

export function TrackCard({
  track,
  index,
  activePreview,
  onPreview,
  onDownload,
  job,
  onOpenSource,
}: TrackCardProps) {
  const isPlaying = activePreview === track.id
  const hasPreview = Boolean(track.preview)
  const status = job?.status

  return (
    <article
      className="rounded-2xl border border-border bg-card p-3 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow"
      data-track-id={track.id}
    >
      {/* Album art + play overlay */}
      <button
        type="button"
        onClick={() => onPreview(track.preview, track.id)}
        disabled={!hasPreview}
        aria-label={isPlaying ? `Pause preview of ${track.title}` : `Play preview of ${track.title}`}
        className="relative flex-none h-14 w-14 rounded-xl overflow-hidden bg-muted grid place-items-center disabled:opacity-50"
      >
        {track.cover ? (
          <img
            src={track.cover}
            alt={`Cover of ${track.album || track.title}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <Music4 className="h-5 w-5 text-muted-foreground" />
        )}
        {hasPreview && (
          <span className="absolute inset-0 grid place-items-center bg-black/40">
            {isPlaying ? (
              <Pause className="h-5 w-5 text-white" />
            ) : (
              <Play className="h-5 w-5 text-white" />
            )}
          </span>
        )}
      </button>

      {/* Title + artist + duration */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate text-[0.95rem] leading-tight">
          <span className="text-muted-foreground/70 mr-1.5 tabular-nums text-xs">
            {(index + 1).toString().padStart(2, '0')}
          </span>
          {track.title}
        </p>
        <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground/80">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3 w-3" />
            {track.durationLabel}
          </span>
          {track.album && (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">{track.album}</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-stretch gap-1.5 flex-none">
        <Button
          type="button"
          size="sm"
          onClick={() => onDownload(track)}
          disabled={status === 'running' || status === 'queued'}
          className="h-9 px-3 rounded-full text-xs gap-1.5"
          aria-label={`Download ${track.title} as FLAC`}
        >
          {statusIcon(status)}
          {status === 'running' ? 'Working' : status === 'done' ? 'Saved' : 'FLAC'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onOpenSource(track)}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Open track source on flacdownloader.com"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Source
        </Button>
      </div>

      {/* Progress bar shown when running */}
      {status === 'running' && (
        <div className="absolute left-0 right-0 -bottom-1 h-1 px-3">
          <Progress value={job?.progress ?? 0} className="h-1.5" />
        </div>
      )}
    </article>
  )
}
