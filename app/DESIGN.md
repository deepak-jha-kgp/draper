# Design

The rules this app is drawn by. Where a rule has a number in it, the number was
measured rather than chosen — `node scripts/contrast.mjs` produces them, and
`node scripts/check-design.mjs` fails the build on the rest.

## The one rule that is this app's own

**The chrome never wears the customer's brand.**

This app shows arbitrary brand colour all day. The first neon-yellow or
near-black brand through the door would make a brand-tinted rail, button or
heading look broken — and the tool whose job is to prove their brand looks good
would be the thing failing. So the brand appears in exactly three places: inside
the preview canvas, in a swatch, and on the type specimens. Everywhere else is
neutral paper, which is also what lets the brand be the loudest thing on screen.

`check-design.mjs` enforces it: a `var(--brand-*)` in any stylesheet not named in
its `BRAND_SURFACES` list is a failure, and each file in that list carries the
reason it is there.

This is the one place the app departs from lemma-room, which *does* paint its
chrome from a teammate's `--field`. It can, because those colours are ours and
chosen to work together. A customer's are neither.

## Visual system

**Dark first, warm not grey.** `--chrome` is an olive-black and `--panel` sits
just above it; light is opt-in via `data-theme="light"`. Two reasons: this is a
tool you sit in for an hour, and a dark warm ground is the most forgiving thing
to show somebody else's brand against. Nothing here is a neutral `#111` — a cold
chrome makes every warm brand look dirty beside it.

This follows the Lemma Design studio deliberately. They are siblings in the same
product family, and a shared chrome language is a feature rather than a thing to
differentiate away from.

**Three faces, one job each.** Schibsted Grotesk for chrome. Newsreader for
documents read for minutes rather than glanced at — the brand guide. DM Mono for
metadata, paths, token names and every measured number.

**Weight never exceeds 500**, with no exceptions in this app. Hierarchy comes
from size and the space above it.

**One accent, about four times per screen.** Acid lime. It reads unmistakably
as *the tool*, because no company's brand is this colour — which is exactly what
lets it sit beside every company's brand without being mistaken for part of it. In
light mode it drops to an olive that still clears AA both ways; the acid that
reads on black is invisible on cream.

**Everything you press moves.** `button:active` is a 1px drop and a 2.2% scale.
It is one declaration and it is most of the difference between a tool that feels
alive and a form that feels dead.

**Work in progress is shown working.** A pulsing pip on the live intake step, a
lime spinner on the activity line, a shimmering tile where the next screenshot
will land, a toast when a render finishes while you were on another screen. The
alternative — a static line of text — is why the first version of this app read
as broken every time something took longer than a second. All of it collapses
under `prefers-reduced-motion`.

**Contrast is measured, not assumed.** Every ink-on-surface pair in `tokens.css`
carries its ratio in a comment beside it, in both appearances, and every one
clears AA for body text. A fill carries the ink paired with it — `--accent` has
`--on-accent`, and in dark mode the accent is the *light* colour with dark ink,
because nothing falls back to white.

## Screens

**Start** is a prompt, the brand it will be made on, six starting points, and what
the team made recently. The brand is named on this screen because "on whose
brand?" is the whole difference between this and a blank generator.

**Intake** replaces the entire app when no brand is ready. There is exactly one
thing to do, so there is exactly one thing on screen — not empty shelves behind a
modal. It shows the live `activity` line and the screenshots as they land,
because the wait is the first impression and a spinner reads as broken.

**Brand** shows each colour with what it is *for* and its measured ratio,
recomputed in the browser rather than trusted from the row — so if someone edits
a token the number moves with it.

**Studio** puts the artifact and the conversation that changes it side by side,
on a dotted mat tinted from the brand's own surface.

The preview inlines the artifact's `theme.css` before handing it to `srcdoc`. The
renderer links that stylesheet *relatively*, which is right — the committed file
still works standalone years later — but `srcdoc` has no base URL, so unresolved
it rendered as browser-default serif in black on black.

It also rewrites one media query. An iframe cannot be given a different
`prefers-color-scheme` from its host, so a brand shipping a dark block rendered
dark inside a light studio: a light post shown dark on a light mat. Since the
stylesheet is already being inlined, `@media (prefers-color-scheme: dark)` becomes
`@media all` or `@media not all` to follow the appearance switch. No declaration
is touched — only when it applies.

The iframe is `sandbox="allow-same-origin"` with **no** `allow-scripts`: nothing
in a generated artifact executes, but its own dimensions can be read instead of
guessed per kind, so a 1080×1350 post and a 794×1123 sheet both simply fit.

**Library** is shared, and that is the point — the fourth launch post can look
like it came from the same company as the first three.

## Dev notes

`npm run dev` needs the same-origin proxy: the API does not send CORS headers for
an arbitrary localhost port, so `LEMMA_DEV_PROXY_TARGET` + `VITE_LEMMA_BASE_URL=/api`
route through Vite. `VITE_LEMMA_API_URL` stays set because `lemma apps deploy`
checks for that exact name before it will build. Neither matters in production,
where the host injects the real config at serve time.
