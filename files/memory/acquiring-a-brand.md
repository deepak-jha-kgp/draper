# Playbook: acquiring a brand

Read this before any brand intake. Someone has given this pod a website or a set of
files, and the job is to come back with the real thing: the palette they actually use, the faces they
actually set, their logos, how they talk — and the evidence for each.

You are woken by an `intake_jobs` row. Its id is in the message that wakes you, along
with the row itself. Everything you do hangs off that row.

## When a schedule started you, nobody is in the conversation

An intake triggered by the `intake-started` schedule is unattended. There is no person
there, and there never will be.

**Never call `request_approval` or `ask_user`.** They suspend the run waiting for an
answer that cannot come, and the job sits at whatever status it had reached, forever,
looking to everyone watching like the work simply stopped. This has already happened:
a run paused to ask permission to tidy up some files, and stayed paused.

**Do not delete pod files.** You do not have the grant, and there is no one to approve
it. When an earlier run left something wrong — a bad asset, a file in the wrong place —
**overwrite it at the same path** once you have a real replacement, and list whatever you
could not fix under **"Not found"** in the guidelines. A wrong file that is written down
as wrong is recoverable; a run that halted to ask about it is not.

If something genuinely needs a person, finish everything else first, then say so in the
job's `error` field and in the guidelines. Then close the job.

**You are the only thing standing between this pod and a plausible, invented brand.**
A made-up palette that looks fine is worse than an empty one, because it ships. When
you cannot find something, record that you could not find it. Never fill a gap.

## Keep the row moving

People are watching this run on a screen. After every meaningful step, update the job:

```
status: queued → fetching → reading → writing → ready     (or failed)
activity: one short present-tense line — "Reading stripe.com's stylesheets"
evidence: append **pod** paths as you upload them, so the screen fills in before you finish
```

`evidence` is read by a screen. A path in your sandbox (`run8/home.jpeg`) is useless
there — upload the capture to `<root_path>/evidence/` first and record *that* path.
The same goes for any URL you cite: it has to be one a browser can open.

A run that goes quiet for a minute looks broken even when it is working — and the
studio now says so out loud, so a quiet run gets reported as stalled and restarted.

**Write `activity` before every batch, not every phase.** "Downloading 8 mascots",
"Capturing 3 section screenshots", "Writing guidelines.md" — each one before you start
it, not after. Two minutes of silence is the most you may ever spend.

## Finish in ten minutes

You are a first impression, not an archive. Someone is watching a progress list.

- **Hard budget: ten minutes.** At eight, stop collecting and start writing. A brand
  with the palette, the type, one good lockup, six assets and a real guide — delivered —
  beats a perfect haul that never lands.
- **Caps per kind: at most 8 each**, and stop at 30 assets total. Take the best, not all
  of them. Twenty-one mascots is a sprite sheet, not a brand kit.
- **Do not build contact sheets, montages or composites.** You are collecting files, not
  producing artwork. If you want to see several images at once, look at them and move on.
- **Never regenerate what a previous run already uploaded.** On a re-sync, list the pod
  folder first and only fetch what is missing or known-bad.

## Website intake

**1. The fast static read.** Call the `extract_site_style` function on the URL. It
returns ranked candidates: `palette_properties` (custom properties that resolve to real
colours, under the site's own names — the most useful field), `colors`, `font_families`,
`declared_faces`, `radii`, `logo_candidates`, `icons`, and `notes`.

Read `notes` before you trust anything. If it says the page is JS-rendered, or names
unresolved custom properties, the static read is incomplete **by design** — that is your
instruction for the next step, not a failure.

**2. The browser read.** Load the `browser` skill and follow its core loop. Use the
preconfigured default session; never create a named one or install a browser.

- `agent-browser set-display-size 1440 900`, open the homepage, screenshot to
  `$PWD/home.jpeg`, and **look at it** with `view_image`. You are judging a brand; you
  have to see it.
- Resolve what the function could not. Computed styles know what static CSS does not:
  ```
  agent-browser eval "getComputedStyle(document.body).fontFamily"
  agent-browser eval "getComputedStyle(document.documentElement).getPropertyValue('--hds-font-family')"
  ```
  Ask for exactly the property names the function listed as unresolved.
- Open one interior page too — a pricing or product page. Homepages are the most
  art-directed and least representative page a company owns.

**3. The repertoire — take everything, not just the logo.** A brand is not a
palette and a wordmark. Collateral gets built from the whole kit, and the piece that
needed an illustration will get a flat coloured box instead if you did not bring one.

Walk the homepage and two interior pages and **download every brand-bearing file you
can reach**, with `curl` into your run directory, then upload what is worth keeping:

| `kind` | What to look for |
| --- | --- |
| `logo` `wordmark` `mark` | Header and footer lockups, every variant — inverse, mono, small |
| `favicon` | `/favicon.ico`, `/favicon.svg`, `apple-touch-icon`, the manifest's icons. Prefer SVG |
| `social_card` | `og:image`, `twitter:image` — usually the most deliberately art-directed asset a company owns |
| `illustration` | Mascots, characters, spot drawings, 3D renders, empty-state art |
| `photo` | Hero photography, team and office shots, product photography |
| `screenshot` | Product UI they show of themselves — this is how they present the thing |
| `icon` | The icon set in use. Name the family if you recognise it (Lucide, Phosphor, Tabler); grab a handful of inline SVGs as samples |
| `pattern` | Background textures, gradients, grain, repeating motifs |
| `font` | Licence-gated — see below |

Practical rules:

- **Prefer SVG, then the largest raster.** Many sites serve `?w=400`; strip the query
  and ask for the original. A logo captured at 96px wide is useless on a poster.
- **Skip the chrome.** Cookie-banner icons, payment-provider badges, customer logos,
  app-store buttons and stock avatars are not this brand's assets. A customer's logo on
  their wall of logos belongs to *that* customer — do not file it under this brand.
- **Look at what you downloaded** with `view_image` before you keep it. A 1×1 tracking
  pixel, a lazy-load placeholder and a real illustration are the same thing to `curl`.
- **Write `usage` on every row** — where it was on the page and what it is for. An asset
  nobody can tell the purpose of will not get used.
- Deduplicate. The same lockup at four sizes is one asset, not four.
- Be honest about a thin brand. Ten assets from a rich site is a good haul; two from a
  plain one is the right answer, and the guide's **"Not found"** section says so.

**4. Logos — capture, do not recreate.** Pick the primary lockup from what you
downloaded and note the inverse and mono variants if they exist. You are collecting the
brand's real files. **Do not redraw a mark, outline type into paths, or reconstruct a
lockup you could not download** — a rebuilt logo is a forgery, and it will end up on
real material. If you cannot get a clean file, say so in the guidelines and move on
with none.

**Fonts — read this before downloading anything.** You may always *record* a face:
family name, the full fallback stack, and where you saw it. You may only **download and
store the file** when it is openly licensed — Google Fonts, SIL OFL, or an explicit
licence on the page saying so. A commercial face (Söhne, Circular, GT America, anything
sold per-seat) gets recorded and *not* stored; write the fallback stack the site itself
declares, and say in the guidelines that the real face must be licensed separately.
Re-hosting a licensed font is not a technical decision and it is not yours to make.

**5. Voice.** Read the actual copy — headline, subhead, one product page, the footer.
Write how they talk in three or four lines, and quote three to five real phrases from
the site. Quote, never paraphrase into something that "sounds like them".

## Files intake

When `source_kind` is `files`, the source is a pod folder. Uploaded documents are
converted for you — read `<path>/document.md` for the text and `<path>/pages/page_0001.jpg`
for what the page actually looks like, and view those page images. A brand guideline PDF
is usually more authoritative than any website; when both exist and they disagree, the
document wins and you say so in the guidelines.

## What you write

Everything goes under the brand's `root_path` (`/brands/<slug>/`).

**`theme.json` and `theme.css` — the fixed contract.** Renderers and the app only ever
read these names. Emit every one; when a brand genuinely lacks a value, choose the most
defensible neighbour and record that choice in `provenance` rather than leaving a hole.

```
--brand-ink            body text on the surface
--brand-surface        the page ground
--brand-surface-2      a raised or inset surface
--brand-line           hairlines and borders
--brand-muted          secondary text
--brand-accent         the one colour a stranger would name as theirs
--brand-accent-ink     text that sits ON the accent — measured, never assumed white
--brand-ok             --brand-bad
--brand-font-display   --brand-font-body   --brand-font-mono   (full stacks, with fallbacks)
--brand-radius-sm      --brand-radius-md   --brand-radius-lg
```

`--brand-accent-ink` is the one people get wrong. Measure the contrast of your chosen ink
against the accent and pick the one that clears 4.5:1. A brand with a pale accent takes
dark ink; writing white on it because primary buttons are usually white is how a brand
kit ships something unreadable.

**`guidelines.md` — prose, because prose is what gets indexed and searched.** This is the
document a human reads and every other agent retrieves from. Cover: what the brand is,
the palette and what each colour is *for*, the type and how it is set, the logo and its
clear-space, the voice with its real quoted phrases, and a short do/don't. End with a
**"Not found"** section naming everything you looked for and could not establish. That
section is the most valuable part of the file.

**`evidence/`** — the screenshots and the captured CSS. **`assets/`** — logos and any
font you were allowed to keep.

Upload to absolute pod paths (`/brands/<slug>/evidence/homepage.jpeg`) and check the
tree once when you are done. Mixing an absolute root with a relative one is how you
get `/brands/<slug>/evidence/evidence/…`, and nothing downstream will find it there.

**The rows.** Update `brands`: `tokens` (the same values as theme.json), `voice`,
`provenance` (for every token: where it came from — a URL, a custom property name, a
screenshot path), `status: ready`, `last_synced_at`. Write a `brand_assets` row per asset.
Then close the job: `status: ready`, `completed_at`.

## When it goes wrong

Set the job to `failed` with a real `error`, and leave the brand's previous state intact
on a re-sync — a refresh that half-succeeds must not take the working brand down with it.
If the site is unreachable or behind a login, say exactly that; do not go and find a
different company with a similar name.
