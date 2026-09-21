# Working in this repository

This is a Lemma pod as a directory. There is nothing to run: the unit of work is
the bundle — edit a file, import it, test the layer you touched.

The reasoning lives next to the thing it explains. How the pod *behaves* is in
[files/memory/AGENTS.md](files/memory/AGENTS.md) and the two playbooks beside it;
why the app looks the way it does is in
[apps/brand-studio/DESIGN.md](apps/brand-studio/DESIGN.md).

## Setting a fresh pod up

```bash
git clone --depth 1 https://github.com/deepak-jha-kgp/draper && cd draper
export LEMMA_POD_ID=<pod>     # already set inside a pod's own workspace
./setup.sh                    # ~15s, and then it is ready to be talked to
```

There is no connector to authorize and nothing to switch on afterwards. Read
[setup.sh](setup.sh) rather than reproducing it by hand: it is short, and every
line is there because doing it some other way was slower or wrong.

## Four things that will bite you

**`--with-files` is not optional.** This pod's judgement is not in an agent row.
It is in `/memory/AGENTS.md`, `/memory/acquiring-a-brand.md`,
`/memory/making-a-piece.md`, `/memory/agents/pod-default/` and the render
templates under `/templates`. Import without them and every table, function and
schedule arrives intact and the pod does *nothing*, because the part that knows
what to do is missing. `setup.sh` passes the flag; if you import by hand, pass it
too, and check `lemma files ls /memory` afterwards.

**The app under `apps/brand-studio/source/` is built output, not a project.** The
project is in [app/](app/), and `./app/build.sh` regenerates one from the other.
That split is the difference between an import that takes fifteen seconds and one
that takes a minute and then fails: the CLI builds an app source with a
`package.json` and uploads one without. A change to `app/src/` that is committed
without running `build.sh` changes nothing anybody can see.

**`build.sh` moves the `.env` files aside before it builds, and that matters.**
Vite inlines `import.meta.env.*` at build time from the process environment *and*
from any `.env` on disk — and `lemma pods export` carries `.env.local` out of a
pod's app source, so the file arrives holding the pod id it was exported from.
This repository is public. The script also refuses to write output containing a
uuid, which is how that was caught.

**There is no `pod_default` here on purpose.** Export writes an
`agents/pod_default/` directory, and importing it does nothing: the pod's
assistant has a fixed, batteries-included toolset resolved at run time and runs
with the permissions of whoever is talking to it. Its stored `toolsets` and
`instruction` columns are empty by design. Steer it through `/memory/`, never
through an agent row.

**`/memory/agents/` is deliberately not in this bundle.** That is where the
assistant's `MEMORY` toolset writes what it has learned in *one* pod — the active
brand's record ids, what a particular site turned out to contain. Exporting it
ships one pod's working notes to every pod that imports, and a fresh pod would
start believing it already has a brand. The three playbooks in `/memory/` are the
transferable part; everything under `/memory/agents/` is not.

## The two automations ship live

`intake-started` and `design-requested` both watch a table and wake the assistant.
Neither touches anything outside this pod — one acquires a brand from a URL the
person gave, the other makes a piece somebody asked for — so they arrive switched
on. Nothing here opens a pull request or sends mail on its own; if you add
something that does, ship it off and say so.

## Layout

```
pod.json                       metadata + the ${variables} an import resolves
tables/                        brands, brand_assets, designs, design_versions, intake_jobs
functions/start_intake/        opens a brand acquisition; a schedule does the work
functions/extract_site_style/  fetches a public page, ranks what it finds
schedules/                     intake-started, design-requested (both DATASTORE, both live)
surfaces/resend-assistant/     the email address the assistant answers on
files/memory/                  THE BRAIN. Playbooks the assistant reads before acting
files/templates/               one-pager and social-post render templates
apps/brand-studio/source/      BUILT output, uploaded as-is
app/                           the React + Vite project it is built from
setup.sh                       name, import, then a brief telling you what to say
```

The general version of why this is shaped this way:
[PLAYBOOK.md](https://github.com/deepak-jha-kgp/gilfoyle/blob/main/PLAYBOOK.md).
