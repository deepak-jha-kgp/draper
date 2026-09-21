/** WCAG contrast, client-side.
 *
 *  The brand screen claims a ratio next to every pair it shows. Computing it
 *  here rather than trusting what the scout wrote means the claim is checked
 *  against the colour actually on screen — if someone edits a token in the app,
 *  the number moves with it. */

const channel = (value: number) => {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

const parse = (input: string): [number, number, number] | null => {
  const hex = input.trim().replace('#', '')
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    const [r, g, b] = hex.split('')
    return [parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16)]
  }
  // An 8-digit hex carries alpha we cannot resolve without knowing what is
  // behind it, so the first six are the honest answer for a swatch.
  if (/^[0-9a-f]{6,8}$/i.test(hex)) {
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
  }
  return null
}

const luminance = (hex: string) => {
  const rgb = parse(hex)
  if (!rgb) return null
  const [r, g, b] = rgb
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrast(ink: string, surface: string): number | null {
  const a = luminance(ink)
  const b = luminance(surface)
  if (a === null || b === null) return null
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

export function verdict(ratio: number | null): { label: string; ok: boolean } {
  if (ratio === null) return { label: 'not measurable', ok: true }
  if (ratio >= 4.5) return { label: `${ratio.toFixed(2)}:1 AA`, ok: true }
  if (ratio >= 3) return { label: `${ratio.toFixed(2)}:1 large text only`, ok: false }
  return { label: `${ratio.toFixed(2)}:1 fails`, ok: false }
}
