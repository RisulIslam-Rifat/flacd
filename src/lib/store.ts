'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SearchHistoryEntry {
  query: string
  at: number
}

export type DownloadStatus = 'queued' | 'running' | 'done' | 'failed'

export interface DownloadJob {
  id: string
  trackId: string
  title: string
  artist: string
  cover: string | null
  status: DownloadStatus
  progress: number // 0..100 (estimated)
  error?: string
  startedAt?: number
  finishedAt?: number
}

interface AppStore {
  // Search history
  history: SearchHistoryEntry[]
  pushHistory: (q: string) => void
  clearHistory: () => void

  // Download jobs
  jobs: Record<string, DownloadJob>
  upsertJob: (job: DownloadJob) => void
  setJobStatus: (
    id: string,
    status: DownloadStatus,
    patch?: Partial<DownloadJob>,
  ) => void
  removeJob: (id: string) => void
  clearDone: () => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      history: [],
      pushHistory: (q) =>
        set((s) => {
          const query = q.trim()
          if (!query) return s
          const next = [
            { query, at: Date.now() },
            ...s.history.filter((h) => h.query.toLowerCase() !== query.toLowerCase()),
          ].slice(0, 12)
          return { history: next }
        }),
      clearHistory: () => set({ history: [] }),

      jobs: {},
      upsertJob: (job) =>
        set((s) => ({ jobs: { ...s.jobs, [job.id]: { ...s.jobs[job.id], ...job } } })),
      setJobStatus: (id, status, patch) =>
        set((s) => {
          const existing = s.jobs[id]
          if (!existing) return s
          return {
            jobs: {
              ...s.jobs,
              [id]: { ...existing, status, ...patch },
            },
          }
        }),
      removeJob: (id) =>
        set((s) => {
          const next = { ...s.jobs }
          delete next[id]
          return { jobs: next }
        }),
      clearDone: () =>
        set((s) => {
          const next: Record<string, DownloadJob> = {}
          for (const [k, v] of Object.entries(s.jobs)) {
            if (v.status === 'running' || v.status === 'queued') next[k] = v
          }
          return { jobs: next }
        }),
    }),
    {
      name: 'flac-downloader-app',
      partialize: (s) => ({ history: s.history, jobs: s.jobs }),
    },
  ),
)
