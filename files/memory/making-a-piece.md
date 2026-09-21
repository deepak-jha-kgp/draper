# Playbook: making a piece

Read this before building any collateral. You do the planning *and* the building —
there is no separate renderer to hand off to.

## Planning it

1. **Look before you plan.** Search `guidelines.md` for what this piece touches, and
   check the `designs` table for a near neighbour. A fourth launch post should look like
   it came from the same company as the first three.
2. **Ask at most one question, and only when the answer changes the work.** "What's the
   headline?" changes it. "What vibe are you going for?" does not — the brand already
   answered that. Where you can reasonably decide, decide, and say what you decided.
3. Create the `designs` row (`brand_id`, `title`, `kind`, `prompt`, `status: drafting`).
5. **Do not wait for it.** Rendering takes minutes — it builds, opens a browser, looks at
   the result and fixes it. Answer the moment you have handed off: say what you briefed,
   name the design, and tell them it is building and where to watch. A chat turn that
   goes silent for ten minutes looks broken, and they cannot even see the row you made.
   The `designs` row carries `activity` and `working_artifact_path` precisely so the
   studio can show progress without you sitting on the turn.
6. If they are still here when it lands, **show it** — `display_resource` the preview
   image and the artifact. A path in a sentence is not a result someone can look at.
   If they have gone, `message_user` them rather than leaving it in a dead conversation.
7. Pass on its `brand_gaps` honestly. "Your brand has no photography, so I used the
   accent field instead" is useful. Quietly substituting something is not.

## Building it

Load the `browser` skill and follow its core loop. Use the preconfigured default
session; never create a named one and never install a browser.

1. Work in a run-scoped directory: `/workspace/brand-design/<design_id>/`. Never work in
   another run's directory.
2. Write `index.html` as one self-contained file. Link the brand's `theme.css` by
   copying it in beside the HTML — the committed artifact must render correctly on its
   own, months from now, with no pod lookup.
3. **Every colour, face, radius and logo comes from the brand.** Use the
   `--brand-*` custom properties. A literal hex in your HTML is a bug unless the brand
   guide explicitly calls for it. If the piece needs something the brand does not have,
   stop and say so in your result rather than inventing it.
4. Open it: `agent-browser open "file://$PWD/index.html"`, set the display size the piece
   is for, screenshot to `$PWD/preview.jpeg`, and **look at it with `view_image`.**
5. Judge what you see, not what you wrote. Text overflowing its box, an illegible
   accent-on-accent pairing, a logo on a ground that swallows it, a 900-weight heading
   the brand never uses — these are only visible in the picture. Fix and re-shoot.
6. Check the piece at the size it will actually be seen. A social post gets looked at on
   a phone; an email gets a 600px column.

## Committing

Upload to `/designs/<design-slug>/v<N>/`: `index.html`, `theme.css`, `preview.png`.
Then, in this order:

1. Write the `design_versions` row (`design_id`, `version`, both paths, the `prompt`).
2. Update the `designs` row: `artifact_path`, `preview_path`, `version`, `status: ready`,
   and clear `activity`.

Set `working_artifact_path` as soon as your first attempt is uploadable, **before it is
good** — that means after attempt one, not after the QA pass. The studio shows it while
you are still working, and a half-built piece someone can watch beats a spinner. Waiting
until it is finished defeats the entire point of the field.


## Iterating

"Make the headline bigger" is a new version of the same design, not a new design. Bump
the version through `renderer` so `design_versions` keeps the approved one intact.
Starting a fresh row for every tweak turns the library into a junk drawer.

## Things that are not yours to decide

- **Never invent brand values**, not as a placeholder, not to unblock yourself, not when
  asked nicely. If the brand lacks it, say so.
- **Re-syncing a brand changes it for the whole team.** Confirm before you start one.
- A second URL is usually a second brand. Ask which one they mean before writing.

## Tone

Short, concrete, no design-agency language. You are a colleague who is good at this, not
a studio pitching. When you have made something, lead with the thing, not the process.
