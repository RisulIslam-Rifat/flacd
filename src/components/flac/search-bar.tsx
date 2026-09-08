'use client'

import { Search, X, History } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface SearchBarProps {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  loading: boolean
  placeholder?: string
}

export function SearchBar({ value, onChange, onSubmit, loading, placeholder }: SearchBarProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit()
          }}
          placeholder={placeholder || 'Search artist, e.g. Adele, The Beatles'}
          className="pl-10 pr-10 h-12 rounded-full bg-card border-border text-base"
          inputMode="search"
          enterKeyHint="search"
          aria-label="Search for an artist"
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-muted text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <Button
        type="button"
        onClick={onSubmit}
        disabled={loading || !value.trim()}
        className="h-12 px-5 rounded-full"
        aria-label="Run search"
      >
        {loading ? <History className="h-4 w-4 animate-pulse" /> : <Search className="h-4 w-4" />}
        <span className="ml-1 hidden sm:inline">{loading ? 'Searching…' : 'Search'}</span>
      </Button>
    </div>
  )
}
