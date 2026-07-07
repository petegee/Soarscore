# Soarscore — Blind-Spots Report

**Date:** 2026-07-07. Produced by an adversarial "unknown unknowns" pass over
the requirements, users, rules, architecture and user-story docs, then updated
after the owner's clarifications (now recorded in
[docs/requirements/decisions.md](docs/requirements/decisions.md), D1–D7).

Items **resolved** by those decisions — trust/auth/sign-off, the failure
philosophy, offline operation, device-is-the-stopwatch, scale bounds,
multi-day operation, the event log, the 6.1 horn change, the CD validation
gate, the paper-fallback kit — have been written into the requirement docs and
are **not repeated here**. What remains below is genuinely open: each item has
context, suggested fixes (usually with a recommendation), and, where a
decision is the owner's to make, **what's needed from you**.

---

## A. The Scorer device front (ESP32 stopwatch handhelds)

Deciding on dedicated custom hardware (D2) opened the largest cluster of new
unknowns. Most of these belong in a new
`docs/requirements/scorer-device.md` — hardware, firmware, interaction and
sync requirements — which does not exist yet and is the single most valuable
next document.

### A1. Prep-gate vs an offline device

**Context.** The prep confirmation gate ([5.0](docs/requirements/high-level-requirements.md#area-5--scoring) /
[6.5](docs/requirements/high-level-requirements.md#area-6--display-timer--audio-field-aids))
pauses the countdown at T−1:00 until every Scorer confirms. A device that is
offline (D6: buffer-and-sync) *cannot deliver* its confirmation, so the group
blocks on a comms fault — and the CD's current override wrongly punishes the
pilot with a **no-score** for a network problem, conflating *no confirmation
received* with *pilot cannot fly*.

**Suggested fixes**
1. *(Recommended)* Split the CD override in two: **"release gate — device
   offline"** (no no-score; the buffered confirmation reconciles on sync) vs
   **"release gate — pilot unconfirmed"** (no-score as today).
2. Let the Announcer/Timekeeper record a **verbal confirmation on the pilot's
   behalf** at the Base Station when the device is visibly offline.
3. Show a **sync-state indicator** on each device and on the Base Station's
   group view, so the field can tell "offline" from "not confirmed" at a
   glance (complements either fix above).

### A2. Sync conflict policy

**Context.** With buffer-and-sync (D6) plus base-station manual entry (5.8),
the same pilot/flight can end up with two captures: one keyed manually after a
paper fallback, one arriving later when the device reconnects.

**Suggested fixes**
1. *(Recommended)* Never auto-resolve: the event log (D4) records both, the
   conflict is surfaced as an **anomaly in the CD validation pass** (2.2), and
   a human picks.
2. Rule of authority: **manual/base entry always outranks a syncing device**,
   with the losing value retained in the event log and flagged.
3. Timestamp-based last-writer-wins — *not* recommended; silent, and clock
   trust across devices is exactly what you don't have during a partition.

### A3. Interaction design on a small round screen — and the on-device /
### base-side split

**Context.** Requirements written with a phone in mind now have to fit a
~1.3-inch round display: scrolling a group's pilot list for selection (5.0),
the deliberate pre-group confirmation, and task entry (5.2) — landing
distances, F5 launch heights read off the AMRT, multi-launch F3K tasks,
penalties. Not everything should live on the device.

**Suggested fixes**
1. Draft the split per class: **on-device** = flight times (start/stop),
   launch counts, probably landing distance (a small number); **base-side** =
   AMRT launch height, penalties, anything multi-digit or rare.
2. Make pilot selection a **short-list problem**: the base pushes only the
   current group's pilots (≤ 10 at your scale) to the device; confirmation is
   a distinct physical action (long-press), not a tap that can happen by
   accident in a pocket.
3. Prototype the F3K multi-launch flow first — it is the hardest case
   (many timed launches inside one working time, last-/best-flight selection);
   if the device handles F3K, everything else fits.

**Needed from you:** a per-class walkthrough of what a scorer *physically
writes down today* on paper, in order, for each task you actually fly — that
list is the device's input spec. Also: which class will you run first with the
system? Design the device flow for that one, additively for the rest (your
todos.md NFR).

### A4. Transport choice and flight-line range

**Context.** Base↔device link is undefined: Wi-Fi (base as AP), ESP-NOW, or
BLE. Range along a flight line varies by class — winch/tow lines and F3B
courses can spread people out well beyond BLE comfort. The choice interacts
with buffer-and-sync (a flaky-but-recoverable link is acceptable given D6, a
dead one isn't) and with how the countdown mirror stays fresh.

**Suggested fixes**
1. *(Recommended)* Base station as **Wi-Fi AP** — simplest firmware story,
   ~50–100 m realistic outdoors, and D6 tolerates fringe dropouts.
2. **ESP-NOW** — longer effective range and connectionless (fits
   buffer-and-sync naturally), at the cost of a custom protocol layer.
3. Decide *after* a field range test with the actual dev boards at a real
   site; write the requirement as a **range number** (e.g. "reliable at 100 m
   line-of-sight"), not a technology.

**Needed from you:** rough physical layout at your usual field(s) — how far
from a central base station can the farthest scorer stand, per class you fly?

### A5. Fleet logistics

**Context.** Nobody has stated how many devices exist, how they charge, how
firmware gets updated, or how a device joins a contest.

**Suggested fixes**
1. Size the fleet from **max group size, not pilot count**: at ≤ 20 pilots
   flying in groups, ~10 devices + 2 spares covers it.
2. Requirements for the scorer-device doc: full-day battery (≈ 8 h active),
   overnight recharging of the whole fleet at a two-day event, a pairing step
   ("join this contest") simple enough to do at the field, and a firmware
   update path that doesn't need the internet (base station serves updates —
   consistent with D6).
3. A **device health view** on the base: battery level, sync state, firmware
   version, currently-selected pilot — this also serves A1's fix 3.

### A6. Countdown staleness bound

**Context.** Devices mirror phase/countdown from the base. The horn is now the
timing authority (D5), so precision pressure is off — but a device showing a
countdown 10 s stale is worse than no countdown.

**Suggested fix.** State one loose number in the NFRs (e.g. "mirrored
countdown within ±1 s of the base clock; device hides the countdown and shows
an offline indicator when it can't hold that") and move on. Not worth more
design than that.

---

## B. Rules-and-scoring gaps

### B1. Re-flight entitlement rules are missing from `rules/`

**Context.** The rules digest explicitly scoped out "re-flight mechanics", yet
5.3 requires the software to execute re-flights. Which score counts when a
re-flight pilot flies as a filler in another group (better-of? re-flight
stands?) is a per-class FAI rule the software must enforce — currently
unsourced, so 5.3 stories can't be finished without guessing.

**Suggested fixes**
1. *(Recommended)* Run an extraction pass over `rules/source-docs/` for each
   class's re-flight provisions and add a re-flight section to the family and
   per-class rule docs (this is tracking the sport, so it is a legitimate
   `rules/` update).
2. Until then, mark 5.3's scoring outcome **"pending rules extraction"** in
   the story docs rather than inventing behaviour.

### B2. Normalisation degenerate cases

**Context.** `score = raw / winner × 1000` has undefined corners the
requirements never touch: every raw score in the group is zero (divide by
zero); ties for group winner; a penalty driving a final score negative (the
rules floor it at zero, but no *requirement* says so).

**Suggested fixes**
1. Add acceptance criteria to the scoring stories: all-zero group → all score
   0 (not an error); tied winners → both 1000; negative final → recorded as 0
   with penalties still logged (mirrors
   [general-rules §6](docs/requirements/rules/00-general-rules.md#6-penalties-common)).
2. Fold these into the eventual per-discipline scoring specs as shared test
   cases — they are exactly the cases a future test suite should start from.

### B3. Penalties have no sub-area (internal inconsistency)

**Context.** `users.md` cross-references "Area 5 — penalties" for the Contest
Director, but Area 5 has no penalties sub-area — imposition, per-round
recording, deduction from the final aggregate, and survival of drop-worst are
requirements with no home. Flagged per house-keeping rule 2; **not yet
applied, awaiting your approval**.

**Suggested fix.** Add **5.9 Penalties** (5.8 is now Manual Entry): CD imposes
a penalty against a pilot and round; cumulative; deducted from the final
aggregate; retained when the round is dropped; floor at zero (B2); every
imposition in the event log (D4). Repoint the `users.md` reference. Say the
word and I'll add it.

---

## C. Contest-operation edges

### C1. Mid-contest running results, offline

**Context.** FAI requires each round's results displayed as the contest
proceeds (`C.16.1 g`). The live web page is post-MVP and internet-dependent
(D6). Between rounds, at the field, offline — how do pilots see standings?

**Suggested fixes**
1. *(Recommended, simplest)* **Print cumulative standings after each round**
   (Area 7 already has round-range reports; make "after each round" a stated
   use, pinned to the clubhouse table).
2. A results page on the Base Station screen pilots can walk up and read.
3. Base station serves a **local-Wi-Fi results page** to pilots' phones — no
   internet needed, but it drags in scope; park as a future enhancement
   alongside the public page.

**Needed from you:** what do you do today at your club events? Match that.

### C2. Contest abandoned early / minimum valid rounds

**Context.** Weather kills day two after round 3. Classes have
minimum-rounds-for-validity notions; drop-worst thresholds also depend on
rounds flown. Nothing says the system can finalise a truncated contest.

**Suggested fixes**
1. Requirement: **Lock is legal at any round count**; final reports state
   rounds flown, and drop-worst applies only when the class threshold is met
   (the per-class docs carry the thresholds).
2. Add a story for "contest ends early": CD locks after round N, reports are
   correct and honest about it.

**Needed from you:** do your club events follow the FAI minimum-round
conventions, or is "whatever we flew counts" the local practice?

### C3. Mid-contest configuration change

**Context.** Wrong target time discovered in round 3. What recomputes, what is
frozen, whose authority? Silent recompute of already-flown rounds would be a
scandal generator even in a trusting club.

**Suggested fixes**
1. *(Recommended)* Config changes after round 1 require **CD authority**, are
   event-logged (D4), and the system states which rounds' scores recompute as
   a consequence before applying.
2. Per-round config snapshots: a change applies **from the next round
   onward** unless the CD explicitly opts to recompute flown rounds.
3. Freeze all task config at first-round start; only manual score override
   (5.8) can touch the past — simplest, bluntest.

### C4. Multi-day resume semantics

**Context.** Suspend/resume is now MVP (2.3), but one detail interacts with
the round-completeness gate: can day one end **mid-round** (some groups flown,
scores incomplete), and does the correction-window rule ("edit until next
round starts") stretch overnight?

**Suggested fixes**
1. *(Recommended)* Allow suspend at any group boundary; on resume the round
   simply continues, and the Scorer correction window (bounded by
   next-round-start, not by wall-clock) naturally spans the night.
2. Encourage-but-don't-force round boundaries: warn the Announcer when
   suspending mid-round.

### C5. F5 launch-height entry path

**Context.** F5J/F5K/F5L launch height comes from the on-board AMRT, read as a
number after the flight. Where is it keyed — the round-screen device or the
base? (Sub-case of A3, called out because it's per-family, not per-task.)

**Suggested fix.** Base-side entry alongside landing verification, unless the
device flow in A3 proves multi-digit entry is comfortable. Decide with A3.

---

## D. Environment envelope (for the scorer-device doc)

Not blind spots so much as unstated numbers the device doc should pin down:
daylight-readable display, operation with cold fingers, light-rain tolerance,
full-day battery (A5), and base-station power at a field (generator/battery,
recovery after an unplanned reboot mid-contest — the event log D4 makes this
tractable, but "resumes into the correct contest state after power loss"
should be a written requirement.

---

## Suggested order of attack

1. Commission **`docs/requirements/scorer-device.md`** (covers A1–A6, C5, D) —
   written as questions-with-proposed-defaults where your input is listed
   above.
2. Approve/adjust **B3 (5.9 Penalties)** — five-minute fix, closes a dangling
   cross-reference.
3. **B1 rules extraction** for re-flights — unblocks finishing the 5.3
   stories.
4. Fold **B2, C1–C4** into the relevant areas/stories as acceptance criteria —
   each is small once you've answered the "needed from you" questions.
