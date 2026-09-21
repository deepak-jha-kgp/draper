import { useEffect, useState } from 'react'
import type { Brand, BrandAsset } from '../lib/pod'
import { Download } from 'lucide-react'
import { usePodImages } from '../lib/images'
import { downloadPodFile } from '../lib/pod'
import { contrast, verdict } from '../lib/contrast'
import '../styles/kit.css'

/** What each token is for. The scout writes the same reasons into guidelines.md;
 *  these are the short forms, so a swatch is never just a colour with a name. */
const PURPOSE: Record<string, string> = {
  '--brand-accent': 'The one colour a stranger would name as theirs',
  '--brand-ink': 'Body text',
  '--brand-surface': 'The page ground',
  '--brand-surface-2': 'Raised surfaces — cards, panels',
  '--brand-muted': 'Secondary text',
  '--brand-line': 'Hairlines and borders',
  '--brand-ok': 'Success',
  '--brand-bad': 'Error',
  '--brand-accent-ink': 'Text that sits on the accent',
}

/** What a token is, which decides what a contrast number would even mean.
 *
 *  `ink` sits ON the page, so it is measured against the surface. `surface` is
 *  the page, so what matters is the ink that lands on it. `structure` is neither
 *  — a hairline is not text, and giving it a text-contrast verdict invents a
 *  failure. Measuring surface-2 against surface returned "1.09:1 fails", which
 *  is true and meaningless: they are both grounds, and nothing reads one on the
 *  other. */
const ROLE: Record<string, 'ink' | 'surface' | 'structure'> = {
  '--brand-accent': 'ink',
  '--brand-ink': 'ink',
  '--brand-muted': 'ink',
  '--brand-ok': 'ink',
  '--brand-bad': 'ink',
  '--brand-surface': 'surface',
  '--brand-surface-2': 'surface',
  '--brand-line': 'structure',
}

const COLOR_ORDER = [
  '--brand-accent', '--brand-ink', '--brand-surface', '--brand-surface-2',
  '--brand-muted', '--brand-line', '--brand-ok', '--brand-bad',
]

export function Kit({
  brand, assets, onResync,
}: { brand: Brand; assets: BrandAsset[]; onResync: () => void }) {
  const tokens = brand.tokens ?? {}
  const urls = usePodImages(
    assets.map((asset) => asset.file_path).filter(Boolean) as string[],
  )
  const logos = assets.filter((asset) => ['logo', 'wordmark', 'mark'].includes(asset.kind))
  const fonts = assets.filter((asset) => asset.kind === 'font')

  const surface = tokens['--brand-surface'] ?? '#ffffff'
  const accent = tokens['--brand-accent'] ?? ''
  const accentInk = tokens['--brand-accent-ink'] ?? ''

  const style = Object.fromEntries(
    Object.entries(tokens).filter(([key]) => key.startsWith('--brand-')),
  ) as React.CSSProperties

  return (
    <div className="page" style={style}>
      <header className="page__head">
        <p className="meta">{brand.source_kind} · {brand.website_url ?? '—'}</p>
        <h1 className="page__title">{brand.name}</h1>
        <p className="page__sub">
          {brand.last_synced_at
            ? `Last read ${new Date(brand.last_synced_at).toLocaleString()}`
            : 'Never synced'}
          {'  ·  '}
          <button className="btn" style={{ padding: '3px 10px' }} onClick={onResync}>
            Re-sync
          </button>
        </p>
      </header>

      <section className="kit__section">
        <p className="meta kit__label">Palette</p>
        <div className="swatches">
          {COLOR_ORDER.filter((name) => tokens[name]).map((name) => {
            const value = tokens[name]
            const role = ROLE[name] ?? 'ink'
            const ink = tokens['--brand-ink'] ?? ''

            // For an ink token: this colour, read on the page. For a surface:
            // the body ink, read on this ground. For structure: no claim.
            const measured =
              role === 'ink' ? contrast(value, surface)
              : role === 'surface' ? contrast(ink, value)
              : null
            const proof = role === 'structure' ? null : verdict(measured)
            const against = role === 'surface' ? 'ink on this' : 'on surface'

            return (
              <div key={name} className="swatch">
                <div className="swatch__chip" style={{ background: value }} />
                <div className="swatch__body">
                  <p className="swatch__name">{name.replace('--brand-', '')}</p>
                  <p className="swatch__value">{value}</p>
                  {PURPOSE[name] && <p className="swatch__for">{PURPOSE[name]}</p>}
                  {proof && (
                    <p
                      className="swatch__proof mono"
                      style={{ color: proof.ok ? 'var(--ink-3)' : 'var(--bad)' }}
                    >
                      {proof.label} {against}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {accent && accentInk && (
        <section className="kit__section">
          <p className="meta kit__label">The pair people get wrong</p>
          <div className="swatch" style={{ maxWidth: 380 }}>
            <div className="kit-accent" style={{ padding: '22px 24px' }}>
              <p style={{ fontSize: 19 }}>Text on the accent</p>
            </div>
            <div className="swatch__body">
              <p className="swatch__value">{accentInk} on {accent}</p>
              <p className="swatch__proof mono">{verdict(contrast(accentInk, accent)).label}</p>
              <p className="swatch__for">
                Measured, not assumed. A pale accent takes dark ink.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="kit__section">
        <p className="meta kit__label">Type</p>
        {[
          ['Display', '--brand-font-display', 'kit-display'],
          ['Body', '--brand-font-body', 'kit-body'],
          ['Mono', '--brand-font-mono', 'kit-mono'],
        ].map(([label, token, className]) => tokens[token] && (
          <div key={token} className="specimen">
            <p className="specimen__face">{label}</p>
            <p className={`specimen__line ${className}`}>The quick brown fox</p>
            <p className="specimen__stack">{tokens[token]}</p>
          </div>
        ))}
        {fonts.length > 0 && (
          <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
            {fonts.length} font file{fonts.length === 1 ? '' : 's'} stored. A face we were not
            licensed to keep is recorded by name and stack only.
          </p>
        )}
      </section>

      {logos.length > 0 && (
        <section className="kit__section">
          <p className="meta kit__label">Logo</p>
          <div className="lockups">
            {logos.map((asset) => (
              <div key={asset.id}>
                <div
                  className="lockup"
                  style={{ background: asset.variant === 'inverse' ? tokens['--brand-ink'] : surface }}
                >
                  {asset.file_path && urls[asset.file_path]
                    ? <img src={urls[asset.file_path]} alt={asset.label ?? ''} />
                    : <span className="mono muted">no file</span>}
                </div>
                <div className="lockup__foot">
                  <p className="lockup__caption mono">{asset.label ?? asset.kind} · {asset.variant}</p>
                  {asset.file_path && (
                    <button
                      className="icon-btn"
                      title={`Download ${asset.file_path.split('/').pop()}`}
                      aria-label={`Download ${asset.label ?? asset.kind}`}
                      onClick={() => void downloadPodFile(asset.file_path!)}
                    >
                      <Download size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
