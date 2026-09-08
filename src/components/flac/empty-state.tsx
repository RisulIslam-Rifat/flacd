'use client'

import { Music4, Loader2, AlertCircle } from 'lucide-react'

interface EmptyStateProps {
  loading: boolean
  error: string | null
  hasQuery: boolean
}

export function EmptyState({ loading, error, hasQuery }: EmptyStateProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
        <p className="text-sm">Searching flacdownloader.com…</p>
        <p className="text-xs mt-1">This usually takes a moment.</p>
        <div className="flex items-end gap-1 mt-6 h-10">
          <div className="eq-bar w-1.5 h-6 bg-primary/60 rounded-sm" style={{ animationDelay: '0s' }} />
          <div className="eq-bar w-1.5 h-10 bg-primary/60 rounded-sm" style={{ animationDelay: '0.15s' }} />
          <div className="eq-bar w-1.5 h-8 bg-primary/60 rounded-sm" style={{ animationDelay: '0.3s' }} />
          <div className="eq-bar w-1.5 h-10 bg-primary/60 rounded-sm" style={{ animationDelay: '0.45s' }} />
          <div className="eq-bar w-1.5 h-6 bg-primary/60 rounded-sm" style={{ animationDelay: '0.6s' }} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-6">
        <AlertCircle className="h-10 w-10 text-destructive mb-3" />
        <p className="font-medium text-foreground">Search failed</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">{error}</p>
      </div>
    )
  }

  if (!hasQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <div className="relative h-28 w-28 mb-4">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 grid place-items-center">
            <Music4 className="h-12 w-12 text-primary" />
          </div>
          <div className="absolute -inset-1 rounded-full border border-dashed border-primary/30 animate-spin-slow" />
        </div>
        <h3 className="font-semibold text-lg text-foreground">Find lossless FLAC music</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          Search any artist — Adele, The Beatles, Billie Eilish — then download every track as high-quality FLAC. Tap a song to play a 30-second preview first.
        </p>
      </div>
    )
  }

  // query submitted, no error, no tracks
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Music4 className="h-10 w-10 mb-3 opacity-50" />
      <p className="text-sm">No tracks found.</p>
      <p className="text-xs mt-1">Try a different spelling or another artist.</p>
    </div>
  )
}
