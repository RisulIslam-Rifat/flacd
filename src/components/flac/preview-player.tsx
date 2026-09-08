'use client'

import { useEffect, useRef, useState } from 'react'
import { Pause, Play, X, Volume2, Volume1, VolumeX } from 'lucide-react'
import type { Track } from '@/lib/types'

interface PreviewPlayerProps {
  track: Track | null
  previewUrl: string | null
  onClose: () => void
}

export function PreviewPlayer({ track, previewUrl, onClose }: PreviewPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(true)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)

  // Reset state when the track changes — only side-effects on the audio element
  useEffect(() => {
    if (!previewUrl || !audioRef.current) return
    const audio = audioRef.current
    audio.src = previewUrl
    audio.currentTime = 0
    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
  }, [previewUrl])

  // Apply volume / muted to the audio element
  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.muted = muted
    audioRef.current.volume = volume
  }, [muted, volume])

  if (!track || !previewUrl) return null

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play().catch(() => setPlaying(false))
      setPlaying(true)
    }
  }

  const pct = duration ? (current / duration) * 100 : 0

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 px-3 safe-pb"
      role="region"
      aria-label="Audio preview player"
    >
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-xl overflow-hidden">
        <audio
          ref={audioRef}
          onTimeUpdate={(e) => {
            const a = e.currentTarget
            setCurrent(a.currentTime)
            if (a.duration) setProgress((a.currentTime / a.duration) * 100)
          }}
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration || 0)
            // Reset display state for the freshly loaded track.
            setCurrent(0)
            setProgress(0)
          }}
          onEnded={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
        {/* progress bar across the top */}
        <div className="h-1 w-full bg-muted">
          <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${pct}%` }} />
        </div>

        <div className="flex items-center gap-3 p-3">
          {/* Album art */}
          <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted flex-none">
            {track.cover ? (
              <img src={track.cover} alt={track.title} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full grid place-items-center text-muted-foreground text-xs">
                ♪
              </div>
            )}
          </div>

          {/* Title / time */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate text-foreground">{track.title}</p>
            <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5 tabular-nums">
              {fmt(current)} / {fmt(duration)} · preview
            </p>
          </div>

          {/* Volume (hidden on very small screens) */}
          <div className="hidden sm:flex items-center gap-2 px-1">
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Unmute preview' : 'Mute preview'}
              className="p-2 rounded-full hover:bg-muted"
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : volume < 0.5 ? (
                <Volume1 className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                setMuted(false)
                setVolume(Number(e.target.value))
              }}
              aria-label="Preview volume"
              className="w-20 accent-primary h-1"
            />
          </div>

          {/* Play / pause */}
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? 'Pause preview' : 'Play preview'}
            className="h-11 w-11 rounded-full bg-primary text-primary-foreground grid place-items-center flex-none shadow-md"
          >
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview player"
            className="h-9 w-9 rounded-full hover:bg-muted grid place-items-center text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function fmt(sec: number): string {
  if (!sec || !isFinite(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
