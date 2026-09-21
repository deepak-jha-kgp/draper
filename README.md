# draper

**Gets your brand, then makes things on it.**

Give it a website. It goes and takes the brand off the page — the palette, the
typefaces, the logos — and writes down where each one came from. Then it makes
real collateral on that brand: a one-pager, a social post, in your own colours and
your own type.

It does not guess. A colour the site never showed is recorded as missing, not
filled in with something plausible, because a made-up brand that looks right is
worse than no brand: it ships.

```bash
git clone --depth 1 https://github.com/deepak-jha-kgp/draper && cd draper
LEMMA_POD_ID=<pod> ./setup.sh
```

Fifteen seconds, nothing to connect, and the first thing you say is the setup:

> our brand is at stripe.com

## How it works

```
  you: a URL, or files
        │
        ▼
  start_intake ─────────► intake_jobs row
                               │  (a DATASTORE schedule wakes the assistant)
                               ▼
                    reads /memory/acquiring-a-brand.md
                    fetches the page · extract_site_style ranks what it finds
                               │
                               ▼
        /brands/<slug>/  guidelines.md · theme.json · theme.css
                         assets/ (logos, fonts)  ·  evidence/ (where each came from)
                               │
  you: "make me a one-pager"   │
        │                      │
        ▼                      ▼
  designs row ──────────► a schedule wakes the assistant again
                          reads /memory/making-a-piece.md
                          renders on /templates/<kind>/index.html
                               │
                               ▼
                     the piece, back in the conversation
```

The two schedules are the whole engine: a row appears, the assistant wakes with a
playbook, does the work, and writes the result back. Nothing here reaches outside
the pod on its own, which is why both ship switched on.

## What is in the pod

| | |
|---|---|
| **Tables** | `brands` (one is `is_default`), `brand_assets`, `designs`, `design_versions`, `intake_jobs` |
| **Functions** | `start_intake` opens an acquisition; `extract_site_style` fetches a public page and ranks the brand signals on it |
| **Schedules** | `intake-started`, `design-requested` — both DATASTORE, both live |
| **Files** | `/memory/` is the pod's judgement; `/templates/` is how a piece is rendered; `/brands/<slug>/` is what it learned |
| **App** | `brand-studio` — the brands, the pieces, and their versions |
| **Surface** | one email address the assistant answers on |

The assistant is the pod's own — no agent row, a fixed toolset, and your
permissions rather than grants of its own. It is steered entirely through
`/memory/`, which is why the import has to carry files.

## Setting it up by hand

```bash
lemma pods create draper
lemma pods import . --pod <pod> --set-pod-meta --with-files \
  --var brand_studio_slug=brand-studio-<something unique>
```

`--with-files` is load-bearing; `--set-pod-meta` is the pod rename and is applied
before any resource, so it fails the whole import if another pod in the
organization already has the name. [setup.sh](setup.sh) does both, in an order
that survives either going wrong. [AGENTS.md](AGENTS.md) says why.

## Working on it

Edit `app/`, then `./app/build.sh` — `apps/brand-studio/source/` is generated.
Edit the pod's judgement in `files/memory/`, then re-import with `--with-files`.

Built from the playbook at
[deepak-jha-kgp/gilfoyle](https://github.com/deepak-jha-kgp/gilfoyle/blob/main/PLAYBOOK.md).
