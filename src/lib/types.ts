export interface Track {
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

export interface SearchResponse {
  ok: boolean
  query?: string
  page?: number
  hasMore?: boolean
  total?: number
  tracks?: Track[]
  error?: string
}
