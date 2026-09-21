import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Brand, Design } from '../lib/pod'

const TEMPLATES: { kind: Design['kind']; label: string; hint: string }[] = [
  { kind: 'social_post', label: 'Social post', hint: '1080 square' },
  { kind: 'one_pager', label: 'One-pager', hint: 'A4 sheet' },
  { kind: 'deck', label: 'Deck', hint: 'slides' },
  { kind: 'email', label: 'Email', hint: '600px column' },
  { kind: 'landing_section', label: 'Landing section', hint: 'a block for the site' },
  { kind: 'poster', label: 'Poster', hint: 'print or screen' },
]

const STATUS_DOT: Record<Design['status'], string> = {
  drafting: 'working', ready: 'ready', in_review: '', approved: 'approved', archived: '',
}

/** "What are we making?" — the prompt, the brand it will be made on, the six
 *  kinds, and what the team made recently.
 *
 *  The kind is chosen here rather than inferred from the prompt: it decides the
 *  canvas the piece is built on, and getting it wrong wastes a whole render. The
 *  cards select it; they do not fire off a half-written request, which is what
 *  they used to do.
 */
export function Start({
  brand, designs, onMake, onOpen,
}: {
  brand: Brand
  designs: Design[]
  onMake: (kind: Design['kind'], prompt: string) => Promise<void>
  onOpen: (design: Design) => void
}) {
  const [prompt, setPrompt] = useState('')
  const [kind, setKind] = useState<Design['kind']>('social_post')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!prompt.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await onMake(kind, prompt.trim())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <header className="page__head" style={{ marginBottom: 20 }}>
        <h1 className="page__title">What are we making?</h1>
        <p className="page__sub">
          On <strong>{brand.name}</strong>'s brand — its colours, faces and voice, already read.
        </p>
      </header>

      <form onSubmit={submit}>
        <textarea
          className="field"
          rows={3}
          placeholder="A launch post for the new pricing, for LinkedIn"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
          aria-label="What to make"
          disabled={busy}
        />

        <p className="meta" style={{ marginTop: 20, marginBottom: 10 }}>As a</p>
        <div className="kinds">
          {TEMPLATES.map((template) => (
            <button
              key={template.kind}
              type="button"
              className="kind"
              aria-pressed={kind === template.kind}
              onClick={() => setKind(template.kind)}
              disabled={busy}
            >
              <span className="kind__label">{template.label}</span>
              <span className="kind__hint mono">{template.hint}</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn--primary" disabled={busy || !prompt.trim()}>
            {busy ? <><Loader2 size={14} className="spin" /> Starting</> : 'Make it'}
          </button>
        </div>
      </form>

      {error && <div className="error" style={{ marginTop: 14 }}>{error}</div>}

      <p className="meta" style={{ marginTop: 34, marginBottom: 6 }}>Recent</p>
      {designs.length === 0 ? (
        <p className="empty">Nothing yet. The first thing you make lands here for the whole team.</p>
      ) : (
        <div>
          {designs.slice(0, 8).map((design) => (
            <button key={design.id} className="row" onClick={() => onOpen(design)}>
              <span className={`row__dot row__dot--${STATUS_DOT[design.status]}`} />
              <span className="row__name">{design.title}</span>
              <span className="row__meta">{design.kind.replace('_', ' ')}</span>
              <span className="row__meta">
                {design.status === 'drafting' ? (design.activity ?? 'building') : design.status}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
