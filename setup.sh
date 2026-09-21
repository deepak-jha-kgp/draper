#!/usr/bin/env bash
# Set a fresh pod up. One command, about fifteen seconds.
#
#   LEMMA_POD_ID=<pod> ./setup.sh
#
# There is nothing to connect and nothing to switch on afterwards. The two
# automations here only read and write rows in this pod, so they ship live; the
# first thing anybody says is already the whole of the setup.
set -euo pipefail
cd "$(dirname "$0")"
: "${LEMMA_POD_ID:?set LEMMA_POD_ID to the pod to set up}"
export LEMMA_POD_ID

# 1. The name, first and on its own.
#
#    First, because the email surface takes its address from the pod's name at
#    the moment it is created -- rename afterwards and the pod is `draper` while
#    its inbox still reads whatever made it.
#
#    On its own, because `--set-pod-meta` applies metadata BEFORE any resource
#    and pod names are unique per organization: a second `draper` in the same org
#    is a 409 that would take the whole import down with it. Renaming from a
#    directory holding nothing but pod.json costs four seconds and can cost
#    nothing else.
META="$(mktemp -d)"; trap 'rm -rf "$META"' EXIT
cp pod.json "$META/"
if ! lemma pods import "$META" --set-pod-meta >/dev/null 2>&1; then
  echo "note: could not name this pod 'draper' — something else in this" >&2
  echo "      organization already is. Carrying on; nothing depends on it." >&2
fi

# 2. Everything else, quietly.
#
#    --with-files is not optional. This pod's judgement is not in an agent row --
#    it is in /memory/AGENTS.md, /memory/acquiring-a-brand.md,
#    /memory/making-a-piece.md and the render templates under /templates. Import
#    without them and every table, function and schedule arrives intact and the
#    pod does nothing, because the thing that knows what to do is missing.
#
#    The app slug is named explicitly: it is globally unique across every pod on
#    the server and the CLI's fallback is the pod id's first EIGHT hex characters,
#    which two pods created in the same moment share. That 409 kills the app step
#    and takes the whole import with it. The id's tail is random; use that.
SLUG="brand-studio-$(printf '%s' "${LEMMA_POD_ID//-/}" | tail -c 12)"
LOG="$(mktemp)"
echo "setting up — about fifteen seconds"
if ! lemma pods import . --with-files --var "brand_studio_slug=$SLUG" >"$LOG" 2>&1; then
  echo "the import failed. Full output:" >&2
  cat "$LOG" >&2
  exit 1
fi

# 3. Read back what landed.
APP_URL="$(lemma apps get brand-studio --output json | python3 -c 'import json,sys; print(json.load(sys.stdin).get("url") or "")')"
MAIL="$(lemma surfaces list --output json | python3 -c '
import json, sys
d = json.load(sys.stdin)
for s in (d["items"] if isinstance(d, dict) else d):
    if s["name"] == "resend-assistant":
        print((s.get("reach") or {}).get("email") or "-")
        break
else:
    print("-")
')"
BRAINS="$(lemma files ls /memory --json 2>/dev/null | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
    rows = d["items"] if isinstance(d, dict) else d
    print(len([r for r in rows if r.get("kind") == "FILE"]))
except Exception:
    print("?")
')"

cat <<TXT

────────────────────────────────────────────────────────────────────────────
 FOR YOU, NOT FOR THEM. Say the following in your own words, as one short
 message in prose. No command, no code block, no copy of this frame. They
 are very likely on a phone, and they did not ask for a terminal.
 ($BRAINS playbooks landed under /memory — if that is 0 the import went in
  without --with-files and this pod knows nothing. Log: $LOG)

 When they answer, YOU do the thing — never hand them a command:
   they gave a URL or files -> call start_intake, then SAY it is running. A
                               schedule picks it up. Do not do the intake by hand.
   they asked for a piece   -> insert a row in `designs`; a schedule wakes you
                               with /memory/making-a-piece.md. Follow it whole.
   anything about the brand -> search /brands/<slug>/guidelines.md. Never invent
                               a colour, a typeface or a voice, not even as a
                               placeholder — a made-up brand that looks plausible
                               is worse than none, because it ships.
────────────────────────────────────────────────────────────────────────────

  Don Draper is set up. He has no brand yet, and that is the only thing missing.

  Give him a website — yours, or one you admire — and he goes and takes the brand
  off it: the palette, the typefaces, the logos, and a note on where each one came
  from. He does not guess. Anything the site does not show, he tells you he does
  not have, rather than filling it in.

  Then he makes things on it. A one-pager, a social post, whatever you ask for,
  in your own colours and your own type, handed back here.

  Try: our brand is at stripe.com

  That is all the setup there is — nothing to connect, nothing to switch on.
  There is a studio at
  $APP_URL
  for the brands and the pieces once they exist, and you can mail him at $MAIL.

TXT
