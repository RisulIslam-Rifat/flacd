'use client'

import { CheckCircle2, Loader2, XCircle, Music4, X, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { DownloadJob } from '@/lib/store'

interface DownloadsPanelProps {
  jobs: Record<string, DownloadJob>
  onClose: () => void
  onClearDone: () => void
}

export function DownloadsPanel({ jobs, onClose, onClearDone }: DownloadsPanelProps) {
  const list = Object.values(jobs).sort(
    (a, b) => (b.startedAt || 0) - (a.startedAt || 0),
  )

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Download queue"
    >
      <div
        className="w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Download queue</h2>
            <span className="text-xs text-muted-foreground">({list.length})</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearDone}
              disabled={list.every((j) => j.status === 'running' || j.status === 'queued')}
              className="h-8 text-xs"
            >
              Clear finished
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
              aria-label="Close download queue"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="max-h-[60vh] overflow-y-auto scroll-area-thin p-3 space-y-2 safe-pb">
          {list.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Music4 className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No downloads yet.</p>
              <p className="text-xs mt-1">Tap “FLAC” on a track to start a download.</p>
            </div>
          ) : (
            list.map((job) => (
              <div
                key={job.id}
                className="rounded-xl border border-border p-3 flex items-center gap-3"
              >
                <div className="h-10 w-10 rounded-lg overflow-hidden bg-muted flex-none grid place-items-center">
                  {job.cover ? (
                    <img src={job.cover} alt={job.title} className="h-full w-full object-cover" />
                  ) : (
                    <Music4 className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{job.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{job.artist}</p>
                  {job.status === 'running' && (
                    <Progress value={job.progress ?? 0} className="h-1.5 mt-2" />
                  )}
                  {job.status === 'failed' && job.error && (
                    <p className="text-xs text-destructive mt-1 line-clamp-2">{job.error}</p>
                  )}
                </div>
                <div className="flex-none text-xs">
                  {job.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  {job.status === 'done' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                  {job.status === 'failed' && <XCircle className="h-5 w-5 text-destructive" />}
                  {job.status === 'queued' && (
                    <span className="text-muted-foreground text-xs">queued</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
