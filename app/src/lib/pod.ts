import { useCallback, useEffect, useMemo, useState } from 'react'
import { lemmaClient } from '../lemma-client'

/** Shapes we read off pod records. Written down rather than inferred, because
 *  the column names are the contract between this app and the bundle. */
export type Brand = {
  id: string
  name: string
  slug: string
  website_url?: string
  status: 'draft' | 'extracting' | 'ready' | 'archived'
  source_kind: 'website' | 'files' | 'manual'
  root_path?: string
  tokens?: Record<string, string> | null
  voice?: Record<string, unknown> | null
  provenance?: Record<string, unknown> | null
  is_default?: boolean
  last_synced_at?: string | null
}

export type IntakeJob = {
  id: string
  brand_id?: string
  source_kind: string
  source_ref?: string
  status: 'queued' | 'fetching' | 'reading' | 'writing' | 'ready' | 'failed'
  activity?: string | null
  evidence?: string[] | null
  error?: string | null
  created_at?: string
  updated_at?: string
}

export type Design = {
  id: string
  brand_id: string
  title: string
  kind: 'social_post' | 'deck' | 'one_pager' | 'email' | 'landing_section' | 'poster'
  status: 'drafting' | 'ready' | 'in_review' | 'approved' | 'archived'
  prompt?: string | null
  artifact_path?: string | null
  preview_path?: string | null
  working_artifact_path?: string | null
  activity?: string | null
  version?: number
  conversation_id?: string | null
  created_by?: string | null
  created_at?: string
}

export type DesignVersion = {
  id: string
  design_id: string
  version: number
  artifact_path?: string | null
  preview_path?: string | null
  prompt?: string | null
  note?: string | null
}

export type BrandAsset = {
  id: string
  brand_id: string
  kind: string
  variant: string
  label?: string | null
  file_path?: string | null
  usage?: string | null
  approved?: boolean
}

/** One table read, kept fresh by the datastore change stream.
 *
 *  `watchChanges` is a WebSocket, and it is the only real-time option on this
 *  path. Polling a table that an agent writes to once a minute is both slower
 *  to show the change and more load than the socket. */
export function useTable<T>(table: string, enabled = true) {
  const [rows, setRows] = useState<T[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const read = useCallback(async () => {
    if (!enabled) return
    try {
      const response = await lemmaClient.records.list(table, { limit: 200 })
      setRows(((response as { items?: T[] }).items ?? []) as T[])
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [table, enabled])

  useEffect(() => {
    void read()
  }, [read])

  useEffect(() => {
    if (!enabled) return
    let stop: (() => void) | undefined
    try {
      // Scope the socket to this one table. Watching the whole pod and
      // filtering in the callback would wake every screen on every write.
      const handle = lemmaClient.datastore.watchChanges({
        table,
        onChange: () => void read(),
      })
      stop = () => handle.close()
    } catch {
      // A socket that will not open is not a reason to show nothing; the read
      // above already happened. The screen is simply not live until reload.
    }
    return () => stop?.()
  }, [table, read, enabled])

  return { rows, error, loading, refresh: read }
}

/** The brand everything defaults to. */
export function useActiveBrand(brands: Brand[]) {
  return useMemo(() => {
    if (!brands.length) return null
    return brands.find((brand) => brand.is_default) ?? brands[0]
  }, [brands])
}

/** A pod file as text.
 *
 *  `download` returns the exact bytes, which is what we want for a stylesheet
 *  or a markdown guide. Reading through a minted URL would work too, and costs
 *  a round trip plus a CORS surface we do not need. */
export async function readTextFile(path: string): Promise<string> {
  const blob = await lemmaClient.files.download(path)
  return blob.text()
}

/** A pod file as something `<img src>` can actually load.
 *
 *  `files.getUrl()` mints a URL against the API, and the API wants the bearer
 *  token — which an `<img>` tag cannot send, so the browser gets a 401 and
 *  renders a broken-image icon. `createSignedUrl` would work but mints a
 *  PUBLIC, hit-capped link (50 by default) for something only members should
 *  see, and the page would break on the 51st view.
 *
 *  Downloading through the SDK and wrapping the blob keeps the fetch
 *  authenticated, keeps the file private, and has no hit cap. Callers must
 *  revoke the URL when they are done with it. */
export async function fileObjectUrl(path: string): Promise<string> {
  const blob = await lemmaClient.files.download(path)
  return URL.createObjectURL(blob)
}

/** Request a piece.
 *
 *  The app only writes the row. A `design-requested` schedule wakes the pod
 *  assistant to build it, exactly as `intake_jobs` works for acquisition — so
 *  the app needs no agent call of its own, and the app path cannot drift from
 *  what happens when someone asks in chat.
 *
 *  `created_by: "app"` is load-bearing: it is what the schedule filters on, so a
 *  row the assistant creates mid-conversation is not built twice.
 */
/** Save a pod file to the viewer's machine.
 *
 *  A logo you cannot get out of the tool is a logo you cannot use — the whole
 *  point of a kit is that people take things from it. The SDK download keeps the
 *  fetch authenticated, so this works for private assets without minting a
 *  public link.
 */
export async function downloadPodFile(path: string): Promise<void> {
  const blob = await lemmaClient.files.download(path)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = path.split('/').pop() || 'download'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function createDesign(input: {
  brand_id: string
  kind: Design['kind']
  prompt: string
}): Promise<Design> {
  const title = input.prompt.trim().replace(/\s+/g, ' ').slice(0, 80)
  const row = await lemmaClient.records.create('designs', {
    brand_id: input.brand_id,
    kind: input.kind,
    title: title || 'Untitled piece',
    prompt: input.prompt.trim(),
    status: 'drafting',
    version: 1,
    created_by: 'app',
    activity: 'Queued — waiting for the assistant',
  })
  return row as unknown as Design
}

export async function startIntake(input: {
  source_ref: string
  source_kind?: string
  name?: string
  brand_id?: string
}) {
  return lemmaClient.functions.run('start_intake', { input })
}
