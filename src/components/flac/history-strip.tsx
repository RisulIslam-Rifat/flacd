'use client'

import { Clock, Trash2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HistoryStripProps {
  history: { query: string; at: number }[]
  onPick: (q: string) => void
  onClear: () => void
}

export function HistoryStrip({ history, onPick, onClear }: HistoryStripProps) {
  if (!history.length) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Recent searches
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={onClear}
          aria-label="Clear search history"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Clear
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {history.map((h) => (
          <button
            key={`${h.query}-${h.at}`}
            type="button"
            onClick={() => onPick(h.query)}
            className="group inline-flex items-center gap-1.5 px-3 h-9 rounded-full bg-secondary text-secondary-foreground text-sm hover:bg-accent transition-colors"
          >
            {h.query}
            <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>
    </div>
  )
}
