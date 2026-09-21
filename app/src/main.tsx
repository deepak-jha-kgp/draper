import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthGuard } from 'lemma-sdk/react'
import { Check, Layers, Palette, Sparkles, SunMoon } from 'lucide-react'
import { lemmaClient } from './lemma-client'
import { useActiveBrand, useTable, createDesign, startIntake } from './lib/pod'
import type { Brand, BrandAsset, Design, DesignVersion, IntakeJob } from './lib/pod'
import { Intake } from './screens/Intake'
import { Kit } from './screens/Kit'
import { Library } from './screens/Library'
import { Start } from './screens/Start'
import { Studio } from './screens/Studio'
import './styles/app.css'

const queryClient = new QueryClient()

type View = { name: 'start' | 'kit' | 'library' } | { name: 'studio'; designId: string }

/** Announce work that finished while you were looking elsewhere.
 *
 *  Renders take minutes, so the moment a piece lands is almost never the moment
 *  you are watching it. Without this the library just silently gains a row. */
function useLanded(designs: Design[]) {
  const [toast, setToast] = useState<string | null>(null)
  const seen = useRef<Map<string, string> | null>(null)

  useEffect(() => {
    const now = new Map(designs.map((design) => [design.id, design.status]))
    const before = seen.current
    seen.current = now
    if (!before) return // first load is not news

    for (const [id, status] of now) {
      if (before.get(id) === 'drafting' && status === 'ready') {
        const design = designs.find((entry) => entry.id === id)
        setToast(`${design?.title ?? 'A piece'} is ready`)
        const timer = setTimeout(() => setToast(null), 5000)
        return () => clearTimeout(timer)
      }
    }
  }, [designs])

  return toast
}

function useTheme() {
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system')
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])
  return { theme, cycle: () => setTheme((t) => (t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system')) }
}

function App() {
  const { rows: brands, loading: brandsLoading } = useTable<Brand>('brands')
  const { rows: jobs } = useTable<IntakeJob>('intake_jobs')
  const { rows: designs, refresh: refreshDesigns } = useTable<Design>('designs')
  const { rows: assets } = useTable<BrandAsset>('brand_assets')
  const { rows: allVersions } = useTable<DesignVersion>('design_versions')
  const brand = useActiveBrand(brands)
  const [view, setView] = useState<View>({ name: 'start' })
  const theme = useTheme()
  const toast = useLanded(designs)

  // The newest job is the one worth showing: an intake screen that shows the
  // first job ever run would be stuck on last week.
  const job = useMemo(() => {
    const sorted = [...jobs].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    return sorted[0] ?? null
  }, [jobs])

  const brandAssets = useMemo(
    () => assets.filter((asset) => asset.brand_id === brand?.id),
    [assets, brand],
  )
  const brandDesigns = useMemo(
    () => [...designs]
      .filter((design) => design.brand_id === brand?.id)
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')),
    [designs, brand],
  )

  if (brandsLoading) return <div className="intake"><p className="muted">Loading…</p></div>

  // No brand ready means there is exactly one thing to do, so the app becomes
  // that one thing rather than showing empty shelves behind a modal.
  const ready = brand && brand.status === 'ready'
  if (!ready) {
    return <Intake job={job} onStarted={() => undefined} />
  }

  const open = (design: Design) => setView({ name: 'studio', designId: design.id })

  /** The creation journey, which until now did not exist: the prompt was
   *  discarded and the app switched to the Library.
   *
   *  Write the row, go straight to the studio, watch it build. The
   *  `design-requested` schedule wakes the assistant, so this is the same path
   *  a chat request takes — the app is not doing anything privileged. */
  const make = async (kind: Design['kind'], prompt: string) => {
    const design = await createDesign({ brand_id: brand.id, kind, prompt })
    // Read the table back before navigating. The change stream gets there
    // eventually, but "eventually" meant the studio opened on a design the list
    // did not have yet and rendered nothing at all.
    await refreshDesigns()
    setView({ name: 'studio', designId: design.id })
  }
  const current = view.name === 'studio'
    ? designs.find((design) => design.id === view.designId) ?? null
    : null

  return (
    <div className="shell">
      <nav className="rail">
        <div className="rail__head">
          <Sparkles size={18} />
          <p className="rail__title">Brand Studio</p>
        </div>
        <div className="rail__nav">
          <button
            className="rail__link"
            aria-current={view.name === 'start' ? 'page' : undefined}
            onClick={() => setView({ name: 'start' })}
          >
            <Sparkles size={17} /> Make
          </button>
          <button
            className="rail__link"
            aria-current={view.name === 'kit' ? 'page' : undefined}
            onClick={() => setView({ name: 'kit' })}
          >
            <Palette size={17} /> {brand.name}
          </button>
          <button
            className="rail__link"
            aria-current={view.name === 'library' ? 'page' : undefined}
            onClick={() => setView({ name: 'library' })}
          >
            <Layers size={17} /> Library
            {brandDesigns.length > 0 && <span className="rail__count">{brandDesigns.length}</span>}
          </button>
        </div>
        <div className="rail__foot">
          <button className="rail__link" onClick={theme.cycle}>
            <SunMoon size={17} /> {theme.theme}
          </button>
        </div>
      </nav>

      <main className="main">
        {view.name === 'start' && (
          <Start
            brand={brand}
            designs={brandDesigns}
            onMake={make}
            onOpen={open}
          />
        )}
        {view.name === 'kit' && (
          <Kit
            brand={brand}
            assets={brandAssets}
            onResync={() => {
              if (!brand.website_url) return
              void startIntake({ source_ref: brand.website_url, brand_id: brand.id })
            }}
          />
        )}
        {view.name === 'library' && <Library designs={brandDesigns} onOpen={open} />}
        {/* A design we have not loaded yet is a wait, not a blank screen. */}
        {view.name === 'studio' && !current && (
          <div className="page">
            <p className="empty">Opening the piece…</p>
          </div>
        )}
        {view.name === 'studio' && current && (
          <Studio
            design={current}
            brand={brand}
            versions={allVersions.filter((version) => version.design_id === current.id)}
          />
        )}
      </main>

      {toast && (
        <div className="toast" role="status">
          <Check size={15} style={{ color: 'var(--accent)' }} />
          {toast}
        </div>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <AuthGuard client={lemmaClient}>
      <App />
    </AuthGuard>
  </QueryClientProvider>,
)
