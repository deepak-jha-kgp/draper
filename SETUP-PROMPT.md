# The setup prompt

Paste this into a fresh pod's chat.

```
Set this pod up from https://github.com/deepak-jha-kgp/draper: clone it and run
./setup.sh — nothing else, and nothing invented. It ends with a note addressed to
you; follow it, and keep the checkout, you will need it again.
```

Three lines, and most of them say what not to do. That is deliberate: the slow
part of setting a pod up has never been the pod. See
[PLAYBOOK.md](https://github.com/deepak-jha-kgp/gilfoyle/blob/main/PLAYBOOK.md)
for the general version and what each line is defending against.

`setup.sh` says almost nothing while it works and ends with a note addressed to
the **agent**: a draft of what to tell the person, in prose, plus the three rules
of this pod it must not discover the hard way — call `start_intake` rather than
doing an intake by hand, insert a `designs` row rather than making a piece
inline, and never invent a colour.
