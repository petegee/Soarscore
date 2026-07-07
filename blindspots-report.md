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
unknowns. Most of these belong in
[`docs/requirements/scorer-device.md`](docs/requirements/scorer-device.md) —
**drafted 2026-07-07** with proposed defaults for A1–A6, C5 and D, and the
owner-confirmed capture model (per-flight fields; a pilot can fly more than
one flight per group). Items below remain until their OPEN questions in that
doc are answered/approved: **all owner inputs are now resolved
(2026-07-07)** — A1's split CD override approved and applied; A3 resolved as
**descriptor-driven capture** (no first class — the base pushes the class
and collection metadata at competition start); A4 resolved as **reliable at
100 m line-of-sight** (a scorer is never beyond 100 m of the base). What
remains across the A items is **prototype validation only**, tracked as the
checklist at the end of `scorer-device.md`.

### A1. Prep-gate vs an offline device — ✅ RESOLVED 2026-07-07

**Applied** (fixes 1 + 3, owner-approved). The CD gate release is split in
two: **"release gate — device offline"** (no no-score; buffered confirmation
reconciles on sync) vs **"release gate — pilot unconfirmed"** (no-score as
before); the system never converts a comms fault into a no-score on its own.
Devices show a **sync-state indicator** and the Base Station group view shows
each device's state. Written into 6.5/5.7, `users.md`, the CD 6.5/5.7
stories, and `scorer-device.md` §4.

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
design than that. *(Owner tightened the bound to **±0.5 s**, 2026-07-08 —
see `scorer-device.md` §7.)*

---

## B. Rules-and-scoring gaps

### B1. Re-flight entitlement rules are missing from `rules/` — ✅ RESOLVED 2026-07-07

**Context.** The rules digest had scoped out "re-flight mechanics", yet 5.3
requires the software to execute re-flights.

**Applied.** Extraction pass over `rules/source-docs/` done (a legitimate
`rules/` update — tracking the sport). Added **§7 Re-flights (common
pattern)** to `00-general-rules.md` (entitlement themes, claim/waiver
discipline, 3-priority placement, the which-score-counts rule), family notes
to `f3-general-rules.md` / `f5-general-rules.md`, and a **§6 Re-flights**
section to each of the six per-class docs. Key findings: the allocated
re-flyer scores the **re-flight even if worse**; filler pilots score the
**better of** their two flights; F3K/F5K grant **no** re-flight for a free-
flight mid-air; F5J's new-group minimum is 6 (others 4); **F5L states no
placement/scoring rule at all** (recorded as a CD decision, not invented).
The 5.3 stories (Organiser prepare, CD approve) gained acceptance criteria
enforcing the which-score-counts rule.

### B2. Normalisation degenerate cases — ✅ RESOLVED 2026-07-07

**Context.** `score = raw / winner × 1000` had undefined corners: all-zero
group (divide by zero), ties for group winner, and a penalty driving a final
score negative.

**Applied.** All three are acceptance criteria on the Organiser's **3.6
Configure scoring options** story: all-zero group → all score 0 (not an
error); tied winners → each scores 1000; negative aggregate → recorded as 0
with penalties still logged (the last also enforced by requirement 5.9 and the
CD's 5.9 story from B3). The story's Notes flag them as **shared test cases**
to carry into each per-discipline scoring spec. Note the all-zero and tie
behaviours are *requirement decisions* for corners the FAI text leaves
undefined — recorded in the story docs, not in `rules/`.

### B3. Penalties have no sub-area (internal inconsistency) — ✅ RESOLVED 2026-07-07

**Context.** `users.md` cross-referenced "Area 5 — penalties" for the Contest
Director, but Area 5 had no penalties sub-area.

**Applied.** Added **5.9 Penalties** to `high-level-requirements.md` Area 5:
CD imposes a penalty against a pilot and round; cumulative; deducted from the
final aggregate; retained when the round is dropped; floor at zero (B2); every
imposition/revocation in the event log (D4); distinct from Scorer-captured
task-integral deductions (5.2). Repointed the `users.md` references and
renumbered the CD user story ("5 (penalties)" → 5.9), including the anchors in
`03-scorer.md`.

---

## C. Contest-operation edges

### C1. Mid-contest running results, offline — ✅ RESOLVED 2026-07-07

**Applied** (fix 2, owner-chosen: no easy real-time access today, so the
base-station screen is the minimal answer). 7.1 now states: cumulative
standings and each completed round's results are **viewable on the Base
Station screen** (clubhouse table) between rounds — satisfying `C.16.1 g`
offline; printing stays available; the local-Wi-Fi phone page stays a Future
Enhancement. Pilot results story updated to match.

### C2. Contest abandoned early / minimum valid rounds — ✅ RESOLVED 2026-07-07

**Applied** (owner decision — stricter than suggested fix 1): if the contest
completes **fewer rounds than the class rules' minimum**, it is a
**no-contest** — locked with **no official results**, data and event log
retained. At or above the minimum, lock is legal at any round count, reports
state rounds flown, and drop-worst applies only past its class threshold.
Written into 2.2 and the CD's 2.2 Lock story.

### C3. Mid-contest configuration change — ✅ RESOLVED 2026-07-07

**Applied** (fixes 1 + 2 combined). Area 3 now has a **mid-contest
configuration changes** rule: after round 1 starts, changes affecting
scoring/running (3.5–3.8) require **CD authority**, are event-logged (D4),
and the system states which rounds' scores would recompute **before**
applying; changes apply **next-round-onward by default**, with recomputing
flown rounds an explicit CD opt-in — never silent. New CD story
("3 (mid-contest) — Authorise a mid-contest configuration change") and
`users.md` task row added.

### C4. Multi-day resume semantics — ✅ RESOLVED 2026-07-07

**Applied** (fixes 1 + 2 combined). 2.3 now states: suspend is allowed at any
**group boundary including mid-round** (warned, not blocked); on resume the
round simply continues; the Scorer correction window is bounded by
**next-round start, not wall-clock**, so it spans the night. Also closed a
coverage gap found along the way: **no story covered 2.3 at all** — added an
Organiser 2.3 story (including resume-after-power-loss from the event log)
and assigned 2.3 to the Organiser in `users.md`.

### C5. F5 launch-height entry path — ✅ RESOLVED 2026-07-08

**Applied** (owner decision — opposite of the suggested default): the AMRT
launch height is keyed **on the hand-held device**, at flight or group end,
like the landing tape reading. Written into `scorer-device.md` §1/§2;
on-device multi-digit entry is now a prototype validation (Open item 5).

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

1. ~~Commission **`docs/requirements/scorer-device.md`**~~ — ✅ drafted
   2026-07-07 (questions-with-proposed-defaults); its OPEN items are what
   remains of A1, A3, A4 and C5.
2. ~~Approve/adjust **B3 (5.9 Penalties)**~~ — ✅ done 2026-07-07.
3. ~~**B1 rules extraction** for re-flights~~ — ✅ done 2026-07-07.
4. ~~Fold **B2, C1–C4** into the relevant areas/stories~~ — ✅ all done
   2026-07-07.
