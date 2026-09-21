import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { usePodImages } from '../lib/images'
import type { IntakeJob } from '../lib/pod'
import { startIntake } from '../lib/pod'

const STEPS: { key: IntakeJob['status']; label: string }[] = [
  { key: 'fetching', label: 'Fetching the site' },
  { key: 'reading', label: 'Reading its stylesheets, logos and copy' },
  { key: 'writing', label: 'Writing the theme, guide and assets' },
  { key: 'ready', label: 'Brand ready' },
]

const ORDER: IntakeJob['status'][] = ['queued', 'fetching', 'reading', 'writing', 'ready']

/** How long a run may be silent before the screen stops claiming it is fine.
 *
 *  Six was too tight and called a working run dead: the scout writes
 *  `activity` between batches, and a batch of downloads can outlast that. The
 *  agent now reports before each batch and finishes inside ten minutes, so
 *  twelve means something is genuinely wrong rather than merely slow. */
const STALL_MINUTES = 12

/** The sixty seconds of acquisition, shown.
 *
 *  This screen exists because the wait is the product's first impression. A
 *  spinner for a minute reads as broken; the same minute with the live line and
 *  the screenshots landing reads as work being done. */
export function Intake({ job, onStarted }: { job: IntakeJob | null; onStarted: () => void }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Above the early returns: a hook that only runs on one branch changes the
  // hook order between renders, which React refuses outright.
  const shots = (job?.evidence ?? []).filter((item) => /\.(jpe?g|png|svg)$/i.test(item))
  const thumbs = usePodImages(shots)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!url.trim()) return
    setBusy(true)
    setError(null)
    try {
      await startIntake({ source_ref: url.trim(), source_kind: 'website' })
      onStarted()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setBusy(false)
    }
  }

  const running = job && job.status !== 'ready' && job.status !== 'failed'

  // A job that has not moved in a while is not "still working" — it is stuck,
  // and saying "it keeps going" under a dead run is the worst of both. The
  // scout writes `activity` at every step, so silence is a real signal.
  const quietFor = job?.updated_at
    ? (Date.now() - new Date(job.updated_at).getTime()) / 60000
    : 0
  const stalled = Boolean(running) && quietFor > STALL_MINUTES
  const reached = job ? ORDER.indexOf(job.status) : -1

  if (!job || job.status === 'failed') {
    return (
      <div className="intake">
        <h1 className="intake__title">Where does your brand live?</h1>
        <p className="muted">
          Paste your website. We read the palette, type, logos and voice off it, and write
          down where each one came from.
        </p>

        <form className="intake__form" onSubmit={submit}>
          <input
            className="field"
            placeholder="yourcompany.com"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            autoFocus
            aria-label="Your website"
          />
          <button className="btn btn--primary" disabled={busy || !url.trim()}>
            {busy ? 'Starting…' : 'Get my brand'}
          </button>
        </form>

        <p className="intake__note">
          Nothing is invented. Whatever we cannot find, the guide says we could not find.
        </p>

        {job?.status === 'failed' && (
          <div className="error" style={{ marginTop: 22 }}>
            <p className="meta">Last attempt failed</p>
            <p style={{ marginTop: 6 }}>{job.error ?? 'No reason recorded.'}</p>
          </div>
        )}
        {error && <div className="error" style={{ marginTop: 22 }}>{error}</div>}
      </div>
    )
  }


  return (
    <div className="intake">
      <h1 className="intake__title">Reading {job.source_ref}</h1>
      <p className="muted">This takes about a minute. You can leave; it keeps going.</p>

      <div className="progress">
        {STEPS.map((step) => {
          const index = ORDER.indexOf(step.key)
          const state = index < reached ? 'done' : index === reached ? 'live' : 'todo'
          return (
            <div key={step.key} className={`progress__step progress__step--${state}`}>
              <span className="progress__pip" />
              <span>{step.label}</span>
            </div>
          )
        })}
      </div>

      {running && !stalled && (
        <p className="progress__live">
          <Loader2 size={13} className="spin" />
          {job.activity ?? 'Working'}
        </p>
      )}

      {stalled && (
        <div className="error" style={{ marginTop: 16 }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={15} style={{ color: 'var(--bad)' }} />
            No update for {Math.round(quietFor)} minutes.
          </p>
          {/* Say what is known, not what is guessed. This screen cannot see
              whether the run is alive — only that the row stopped changing —
              and the earlier wording asserted it had stopped, which was wrong
              while the agent was busy downloading. */}
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            Last step: {job.activity ?? 'unknown'}. It may still be working on
            something slow, or it may have stopped — this screen cannot tell.
            Starting again is safe; it overwrites rather than duplicates.
          </p>
          <button
            className="btn"
            style={{ marginTop: 10 }}
            onClick={() => { if (job.source_ref) void startIntake({ source_ref: job.source_ref }) }}
          >
            Start again
          </button>
        </div>
      )}

      {shots.length > 0 && (
        <>
          <p className="meta" style={{ marginTop: 30 }}>What it has seen</p>
          <div className="evidence">
            {shots.map((path) => (
              <figure key={path} className="evidence__item">
                <span className="evidence__shot">
                  {thumbs[path]
                    ? <img src={thumbs[path]} alt="" loading="lazy" />
                    : <span className="shimmer evidence__pending" />}
                </span>
                <figcaption className="evidence__label mono">{path.split('/').pop()}</figcaption>
              </figure>
            ))}
            {/* One placeholder that is visibly still arriving. An evidence grid
                that stops dead reads as finished; this says "and more". */}
            {running && (
              <figure className="evidence__item" aria-hidden="true">
                <span className="evidence__shot"><span className="shimmer evidence__pending" /></span>
                <figcaption className="evidence__label mono">capturing…</figcaption>
              </figure>
            )}
          </div>
        </>
      )}
    </div>
  )
}
