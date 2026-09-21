import { useEffect, useState } from 'react'
import { fileObjectUrl } from './pod'

/** Pod file paths → URLs an `<img>` can actually load.
 *
 *  Every image in this app lives in the pod and needs the bearer token to
 *  fetch, which an `<img src>` cannot send — so a minted API URL 401s and the
 *  browser draws a broken-image icon. Downloading through the SDK and wrapping
 *  the blob keeps the fetch authenticated and the file private, with no public
 *  link and no hit cap.
 *
 *  Shared by the brand kit's logos and the intake's evidence, because both had
 *  the same problem and only one of them had been given the workaround.
 */
export function usePodImages(paths: string[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})
  // The array identity changes on every render; its contents are what matter.
  const key = JSON.stringify(paths)

  useEffect(() => {
    const wanted = JSON.parse(key) as string[]
    let live = true
    const minted: string[] = []

    void Promise.all(
      wanted.map(async (path) => {
        try {
          const url = await fileObjectUrl(path)
          minted.push(url)
          return [path, url] as const
        } catch {
          return [path, ''] as const
        }
      }),
    ).then((pairs) => {
      if (live) setUrls(Object.fromEntries(pairs))
      else minted.forEach((url) => URL.revokeObjectURL(url))
    })

    return () => {
      live = false
      minted.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [key])

  return urls
}
