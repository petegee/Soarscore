# CLAUDE.md — Soarscore

Master context for all Claude sessions/agents on this repo. Keep it succinct;
grow it as the project matures. If something here goes stale, fix it.

## What this is

Soarscore is a **scoring and running system for radio-control glider
competitions** (FAI classes F3B, F3J, F3K, F5J, F5K, F5L). It manages master
data, competition setup, fair round-by-round draws, live on-device score
capture, mid-contest adjustments, and results reporting.

The current scope is an **MVP** — the minimum to run a basic contest. Anything
not needed for that lives under "Future Enhancements" in the requirements.

## Project status

**Requirements/design phase — no application code yet.** The repo is currently
documentation only. When code lands, update this file with the stack, layout,
build/test commands, and conventions.

## Repository map

```
docs/architecture/
  logical-architecture.md      Logical view: parts, links, roles.
  physical-architecture.md     Deployment view: headless Base Station (authoritative),
                               scorer fleet, wired board+speakers, companion-app
                               laptop, optional pilot-phone results page.
docs/requirements/
  high-level-requirements.md   Areas 1–7 (epics/features). The backbone index.
  users.md                     Roles, needs, tasks; cross-refs the areas.
  decisions.md                 Recorded cross-cutting decisions (D1–D8). Settled;
                               don't re-litigate per session.
  scorer-device.md             Scorer handheld requirements (capture model,
                               on-device/base split, sync, fleet). Draft with
                               OPEN questions.
  rules/                        Scoring/running rules the software must enforce
    00-general-rules.md         Cross-class rules (draw, timing, scoring, penalties)
    f3-general-rules.md         F3 family shared rules
    f5-general-rules.md         F5 family shared rules
    f3b.md f3j.md f3k.md         Per-class specifics (authoritative on numbers)
    f5j.md f5k.md f5l.md
    source-docs/                Verbatim extracts from official FAI PDFs
```

Rule docs are layered: **general → family (F3/F5) → per-class**. A child states
only its *differences*; per-class docs are authoritative on the actual numbers.
The FAI PDFs (source-docs) remain the ultimate authority.

## Domain in one screen

- **Roles:** Organiser (setup/admin), Contest Director (authority/decisions),
  Scorer (per-competitor field recorder), Announcer/Timekeeper (field aids),
  Pilot (indirect — reads draw/results, never self-scores).
- **Contest shape:** a sequence of **rounds**; each round split into **groups**
  that fly a shared **working time** and are scored man-on-man.
- **Draw:** random initial order, anti-repeat matrix across rounds. (MVP assumes
  all competitors are on 2.4 GHz and has no teams, so frequency and team-
  separation constraints are out of scope.)
- **Scoring is concurrent and device-based:** **one Scorer per competitor**, one
  device each, recording live into a shared system — no paper cards, no later
  transcription. Several Scorers capture in parallel within a group. A pre-group
  confirmation guards against a stale pilot selection scoring the wrong pilot.
- **Group score:** best raw result = 1000 points; others scaled to it (inverted
  for speed tasks). **F3B is the exception** — three tasks normalised separately.
- **Final:** sum of round scores, with class-specific **drop-worst**; penalties
  deducted from the final aggregate and retained even if their round is dropped.

## Key constraints (recorded in docs/requirements/decisions.md)

- **Trust model:** club-level tool for a small, trusted NZ group. No auth, no
  score sign-off; an **immutable event log of all mutations** provides
  auditability instead.
- **Scorer devices:** dedicated **ESP32 stopwatch-style handhelds** with custom
  firmware — the device *is* the stopwatch. No BYOD.
- **Offline-first:** runs entirely without internet; devices buffer captures and
  sync on reconnect; publish results only when connectivity exists.
- **Failure policy:** any system failure → **pen and paper**, manual entry at
  the Base Station afterwards; the CD validates/overrides scores before Lock.
- **Timing:** end of working time does **not** auto-stop device stopwatches —
  the Scorer stops on the horn; over-working-time captures are flagged.
- **Scale:** ≤ 20 pilots, ≤ 8 rounds/day, 1–2 day events; overnight
  suspend/resume is MVP.

## Working conventions

- These are **high-level, implementation-agnostic** requirements — they describe
  *what a scoring system must do*, not any specific UI or codebase. Preserve that
  altitude in the requirements docs.
- Docs cross-reference by **area number** (e.g. 5.0, 4.3) so stories trace back
  to a requirement and a user. Keep those links intact when editing.
- Prose is wrapped at ~80 columns. Match the existing markdown style.
- When fleshing out a discipline, do it **one class at a time**; put shared
  material in the general/family doc and only the delta in the per-class doc.
- **Area 6 (Display/Timer/Audio)** is **confirmed and in MVP scope**: a bright
  field board + loudspeakers, driven by the Base Station from one shared clock,
  running an automatic phased group sequence (prep → working → landing →
  inter-group gap) with Contest-Director run control.

## House-keeping rules

1. **`docs/requirements/rules/` is derived from the official FAI rules and is
   read-only to the software process.** Do **not** edit it to fit new software
   requirements or MVP-scoping decisions — it tracks the sport, not the product.
   Any requirement or software we generate **must not contravene** these rules;
   if a proposed requirement conflicts with them, the requirement is wrong, not
   the rule. (Scoping something *out* of the MVP is fine — record that in the
   requirements docs / Future Enhancements, never by changing the rule docs. It
   only updates when the underlying FAI source docs change.)
2. **Every new requirement must be cross-referenced against the existing
   requirements before it lands.** Check `high-level-requirements.md`,
   `users.md`, and the rule docs for anything the addition contradicts or
   duplicates. If you find an inconsistency, **flag it and propose a fix, then
   ask the user before applying it** — surface the conflict with a recommended
   resolution rather than silently reconciling it yourself.

## Pointers

- Start any domain question at `docs/requirements/high-level-requirements.md`.
- "Who needs this / why" → `docs/requirements/users.md`.
- "What's the actual rule / number" → `docs/requirements/rules/` (class doc first,
  then family, then general).
