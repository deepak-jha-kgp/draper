import { useMemo, useState } from 'react'
import type { Design } from '../lib/pod'

const DOT: Record<Design['status'], string> = {
  drafting: 'working', ready: 'ready', in_review: '', approved: 'approved', archived: '',
}

const FILTERS: { key: string; label: string; match: (design: Design) => boolean }[] = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'building', label: 'Building', match: (d) => d.status === 'drafting' },
  { key: 'ready', label: 'Ready', match: (d) => d.status === 'ready' || d.status === 'in_review' },
  { key: 'approved', label: 'Approved', match: (d) => d.status === 'approved' },
]

/** Everything the team has made. Shared on purpose — this is the difference
 *  between a brand tool and a per-person generator: the fourth launch post can
 *  look like it came from the same company as the first three. */
export function Library({ designs, onOpen }: { designs: Design[]; onOpen: (design: Design) => void }) {
  const [filter, setFilter] = useState('all')
  const active = FILTERS.find((entry) => entry.key === filter) ?? FILTERS[0]
  const shown = useMemo(() => designs.filter(active.match), [designs, active])

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">Library</h1>
        <p className="page__sub">{designs.length} piece{designs.length === 1 ? '' : 's'}, shared with everyone in this pod.</p>
      </header>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {FILTERS.map((entry) => (
          <button
            key={entry.key}
            className="btn"
            style={{ padding: '5px 12px', ...(entry.key === filter ? { borderColor: 'var(--ink-3)' } : {}) }}
            onClick={() => setFilter(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="empty">Nothing here yet.</p>
      ) : (
        shown.map((design) => (
          <button key={design.id} className="row" onClick={() => onOpen(design)}>
            <span className={`row__dot row__dot--${DOT[design.status]}`} />
            <span className="row__name">{design.title}</span>
            <span className="row__meta">{design.kind.replace('_', ' ')}</span>
            <span className="row__meta">v{design.version ?? 1}</span>
            <span className="row__meta">
              {design.status === 'drafting' ? (design.activity ?? 'building') : design.status}
            </span>
          </button>
        ))
      )}
    </div>
  )
}
