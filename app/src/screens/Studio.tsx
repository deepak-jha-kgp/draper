import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useConversationMessages } from 'lemma-sdk/react'
import { lemmaClient } from '../lemma-client'

type Appearance = 'light' | 'dark'

import type { Brand, Design, DesignVersion } from '../lib/pod'
import { readTextFile } from '../lib/pod'
import '../styles/canvas.css'

/** Resolve the artifact into something an iframe can render on its own.
 *
 *  The assistant commits `index.html` beside its own `theme.css` and links it
 *  RELATIVELY, which is right for a file that has to still work months from now
 *  with no pod lookup. But `srcdoc` has no base URL, so that link resolves to
 *  nothing: no tokens, no faces, and the piece renders as browser-default serif
 *  in black on black. Inlining the stylesheet is what makes the preview the same
 *  thing the assistant looked at.
 *
 *  Fonts and logos are already data URIs inside that stylesheet, so this one
 *  substitution is enough — there is nothing else to resolve.
 */
async function resolveArtifact(path: string, appearance: Appearance): Promise<string> {
  const html = await readTextFile(path)
  const link = /<link[^>]+href=["']([^"']*theme\.css)["'][^>]*>/i.exec(html)
  if (!link) return html

  const folder = path.slice(0, path.lastIndexOf('/'))
  try {
    let css = await readTextFile(`${folder}/${link[1]}`)

    // An iframe cannot be told a different prefers-color-scheme from the page
    // that hosts it, so a brand whose theme.css carries a dark block renders
    // dark inside a light studio. Since we are already inlining the stylesheet,
    // rewrite that one query: `not all` never matches, `all` always does. The
    // declarations are untouched; only when they apply changes.
    css = css.replace(
      /@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)/gi,
      appearance === 'dark' ? '@media all' : '@media not all',
    )
    return html.replace(link[0], `<style>\n${css}\n</style>`)
  } catch {
    return html.replace(
      link[0],
      '<style>body::before{content:"theme.css missing — shown unstyled";' +
        'display:block;padding:8px;font:12px monospace}</style>',
    )
  }
}

/** A generous fixed box to measure the artifact in.
 *
 *  The document's natural size has to be read from a box big enough not to
 *  constrain it. Letting the iframe fill the stage instead is circular — the
 *  stage is sized FROM the measurement — and collapses to nothing on a re-measure
 *  (switching appearance), which rendered the piece as a thumbnail-sized smear.
 */
const MEASURE_BOX = 2400

/** The artifact at its own size, scaled to fit the space that is actually free.
 *
 *  Fitting to width alone is what made this page unusable: a 1080×1350 post in a
 *  700px column is still 875px tall, so the piece ran off the bottom and the
 *  page became a scroll with an empty rail beside it. Fitting to the smaller of
 *  the two ratios lands a square, a portrait post and an A4 sheet whole.
 *
 *  `sandbox="allow-same-origin"` WITHOUT `allow-scripts`: nothing in a generated
 *  artifact executes, but its own dimensions can be read instead of guessed.
 */
function Preview({ design, appearance }: { design: Design; appearance: Appearance }) {
  const [html, setHtml] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [scale, setScale] = useState(1)
  const boxRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)

  const path = design.artifact_path ?? design.working_artifact_path ?? null

  useEffect(() => {
    if (!path) return
    let live = true
    setFailed(false)
    setNatural(null)
    void resolveArtifact(path, appearance)
      .then((text) => live && setHtml(text))
      .catch(() => live && setFailed(true))
    return () => { live = false }
  }, [path, appearance])

  /** The artifact's own size, measured from its CONTENT.
   *
   *  Not from `documentElement`: a document is never smaller than the viewport
   *  it is in, so measuring the root inside the big measuring box just returns
   *  the box — 2400×2400 for every piece, which is why the preview went blank.
   *  The artifacts are one sized root element (a 1080×1350 post, a 794×1123
   *  sheet), so the union of the body's children is the real extent. */
  const measure = useCallback((frame: HTMLIFrameElement | null): boolean => {
    const doc = frame?.contentDocument
    if (!doc?.body) return false

    let w = 0
    let h = 0
    for (const child of Array.from(doc.body.children)) {
      if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE') continue
      const box = child.getBoundingClientRect()
      w = Math.max(w, Math.ceil(box.right))
      h = Math.max(h, Math.ceil(box.bottom))
    }
    // A piece that styles <body> itself rather than a wrapper element.
    if (!w || !h) {
      w = doc.body.scrollWidth
      h = doc.body.scrollHeight
    }
    if (w > 0 && h > 0) {
      setNatural({ w, h })
      return true
    }
    return false
  }, [])

  // `onLoad` alone is not enough: a srcdoc iframe can report load before its
  // content has laid out, and React keeps the same element across re-renders so
  // the event does not always fire again. Poll a few frames until the content
  // has a real size — that is what "measured" actually means here.
  useEffect(() => {
    if (!html) return
    let cancelled = false
    let tries = 0
    const attempt = () => {
      if (cancelled) return
      if (!measure(frameRef.current) && tries++ < 60) requestAnimationFrame(attempt)
    }
    attempt()
    return () => { cancelled = true }
  }, [html, measure])

  // The stage changes size with the window and with its own content, so observe
  // the box rather than listening for window resizes.
  useEffect(() => {
    const box = boxRef.current
    if (!box || !natural) return
    const fit = () => {
      const { width, height } = box.getBoundingClientRect()
      if (width > 0 && height > 0) {
        setScale(Math.min(1, width / natural.w, height / natural.h))
      }
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    return () => observer.disconnect()
  }, [natural])

  const note = (message: string, spinning = true) => (
    <div className="canvas" ref={boxRef}>
      <p className="canvas__note">
        {spinning && <Loader2 size={16} className="spin" />}
        {message}
      </p>
    </div>
  )

  if (!path) return note(design.activity ?? 'Waiting for the assistant to put something up')
  if (failed) return note(`Could not read ${path}`, false)
  if (html === null) return note('Loading the artifact')

  return (
    <div className="canvas" ref={boxRef}>
      <div
        className="canvas__stage"
        style={
          natural
            ? { width: natural.w * scale, height: natural.h * scale }
            : { width: 0, height: 0, overflow: 'hidden' }
        }
      >
        <iframe
          ref={frameRef}
          className="canvas__frame"
          srcDoc={html}
          title={design.title}
          sandbox="allow-same-origin"
          onLoad={(event) => measure(event.currentTarget)}
          style={
            natural
              ? { width: natural.w, height: natural.h, transform: `scale(${scale})` }
              : // Not measured yet: lay out in the big box and stay invisible,
                // so nothing flashes at full size before it is scaled down.
                { width: MEASURE_BOX, height: MEASURE_BOX, visibility: 'hidden' }
          }
        />
      </div>
      {natural && (
        <p className="canvas__readout mono">
          {natural.w} × {natural.h} · {Math.round(scale * 100)}%
        </p>
      )}
    </div>
  )
}

export function Studio({
  design, brand, versions,
}: { design: Design; brand: Brand | null; versions: DesignVersion[] }) {
  // No agentName: this pod has one agent, the pod assistant, and it has no name
  // on the wire. Omitting it resolves the scope to null, which is the assistant.
  const thread = useConversationMessages({
    client: lemmaClient,
    conversationId: design.conversation_id ?? null,
    autoLoad: true,
  })
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [appearance, setAppearance] = useState<Appearance>('light')

  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.trim() || sending) return
    const text = draft.trim()
    setDraft('')
    setSending(true)
    try {
      // sendMessage resolves only when the whole agent turn ends, which for a
      // re-render is minutes. The row's `activity` is the real progress signal;
      // this flag only stops a second submit.
      await thread.sendMessage(`About "${design.title}" (design ${design.id}): ${text}`)
    } finally {
      setSending(false)
    }
  }

  const building = design.status === 'drafting'
  // The brand's tokens scope the canvas mat, so a light piece sits on its own
  // light ground instead of floating on the tool's chrome.
  const brandStyle = Object.fromEntries(
    Object.entries(brand?.tokens ?? {}).filter(([key]) => key.startsWith('--brand-')),
  ) as React.CSSProperties

  const ordered = [...versions].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))

  return (
    <div className="studio">
      <header className="studio__bar">
        <div className="studio__ident">
          <h1 className="studio__title">{design.title}</h1>
          <p className="meta">
            {design.kind.replace('_', ' ')} · v{design.version ?? 1}
            {brand ? ` · ${brand.name}` : ''}
          </p>
        </div>

        <div className="studio__tools">
          {building && (
            <span className="studio__building mono" title={design.activity ?? undefined}>
              <Loader2 size={13} className="spin" />
              <span>{design.activity ?? 'building'}</span>
            </span>
          )}
          <div className="appearance">
            {(['light', 'dark'] as Appearance[]).map((mode) => (
              <button
                key={mode}
                className="appearance__btn"
                aria-pressed={appearance === mode}
                onClick={() => setAppearance(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="studio__stage" data-appearance={appearance} style={brandStyle}>
        <Preview design={design} appearance={appearance} />
      </main>

      <aside className="studio__rail">
        <section className="rail-block">
          <p className="meta">Details</p>
          <dl className="facts">
            <dt>Status</dt><dd>{design.status.replace('_', ' ')}</dd>
            <dt>Kind</dt><dd>{design.kind.replace('_', ' ')}</dd>
            {brand && <><dt>Brand</dt><dd>{brand.name}</dd></>}
            {design.created_by && <><dt>Made by</dt><dd>{design.created_by}</dd></>}
          </dl>
        </section>

        {ordered.length > 0 && (
          <section className="rail-block">
            <p className="meta">Versions</p>
            <ul className="versions">
              {ordered.map((version) => (
                <li
                  key={version.id}
                  className={
                    version.version === design.version ? 'version version--current' : 'version'
                  }
                >
                  <span className="version__n mono">v{version.version}</span>
                  <span className="version__note">{version.note || version.prompt || '—'}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(thread.messages.length > 0 || thread.streamingText) && (
          <section className="rail-block rail-block--grow">
            <p className="meta">Conversation</p>
            <div className="thread">
              {thread.messages.map((message, index) => (
                <div key={index} className="thread__turn">
                  <p className="meta">{String(message.role ?? '')}</p>
                  <p>{String((message as { content?: unknown }).content ?? '')}</p>
                </div>
              ))}
              {thread.streamingText && <p className="muted">{thread.streamingText}</p>}
            </div>
          </section>
        )}

        {/* Docked at the bottom, where the thing you do repeatedly belongs. */}
        <form onSubmit={send} className="rail-ask">
          <p className="rail-ask__hint">Changes become a new version. The approved one stays.</p>
          <div className="rail-ask__row">
            <input
              className="field"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Make the headline shorter"
              aria-label="Ask for a change"
              disabled={sending}
            />
            <button className="btn btn--primary" disabled={sending || !draft.trim()}>
              {sending ? 'Working' : 'Send'}
            </button>
          </div>
          {sending && (
            <p className="rail-ask__hint mono">
              It rebuilds the piece and checks it in a browser — minutes, not seconds.
            </p>
          )}
        </form>
      </aside>
    </div>
  )
}
