# Soarscore — User Stories: Scorer

The **Scorer** is a **per-competitor field recorder** — there is **one Scorer
per flying pilot**, not a single central operator. During a group's working time
each flying pilot has a Scorer standing beside them, recording *that pilot's*
task metrics on **one device** live into the shared contest management system.
Several Scorers therefore capture **in parallel** within a group, one at each
pilot's shoulder, and every entry is attributed **automatically to the
competitor the device is set to** — no paper cards, no later transcription.

The Scorer's needs are physical: **eyes on the flight, not the screen** — large
touch targets, minimal keystrokes, sensible defaults, and input laid out to
**match the shape of the task**. The central risk is the **wrong-pilot failure
mode**: if a device is set to the wrong competitor, a correctly-captured value
lands against the wrong person silently. Guarding that path is what most of
these stories exist to make testable.

**Scope.** MVP only. These stories flesh out the Scorer's three sub-areas from
[`users.md §3`](../requirements/users.md#3-scorer) and the
[logical architecture](../architecture/logical-architecture.md)'s
**Scorer Device ↔ Base Station** two-way link:

- **Area 5.0** — Device Assignment: select the competitor from the group's pilot
  list; show the selected pilot for pre-group confirmation; re-select between
  consecutive groups without swapping devices; the pre-group confirmation guard.
  The same per-group confirmation feeds the **prep gate**
  ([6.5](../requirements/high-level-requirements.md#area-6--display-timer--audio-field-aids)),
  and a Scorer may mark their pilot **cannot make the group** — a no-score
  ([5.7](../requirements/high-level-requirements.md#area-5--scoring)).
- **Area 5.1** — Score Entry: capture the adjacent competitor's result live, with
  immediate confirmation it landed against the **right** competitor; many
  Scorers capturing concurrently within a group.
- **Area 5.2** — Task Scoring Screens: capture the inputs each task requires
  (times, landings, laps, heights, motor runs, penalties), kept **generic** —
  discipline-specific layouts are deferred.

**Role boundaries.** Mid-contest **score administration** — corrections,
cross-round review, re-flights/group moves, outlier/missing validation
(5.3, 5.4, 5.6) — is [Organiser](01-organiser.md) oversight work under
[Contest Director](02-contest-director.md) authority, **not** the Scorer's, and
is not storied here. The **Announcer / Timekeeper** who runs the group clock and
callouts ([Area 6](../requirements/high-level-requirements.md#area-6--display-timer--audio-field-aids))
is a **different** role — the Scorer is not the group timekeeper, though the
device **mirrors that group clock read-only** (round, group, current phase and
countdown) so the Scorer can follow the timing without watching the field board.
**Pilots never self-score** (conflict of interest): the Scorer records on the
pilot's behalf; the pilot only cross-checks that the device is set to them
([`users.md §5`](../requirements/users.md#5-pilot--competitor)).

Stories are **high-level and implementation-agnostic** — they may describe
*interaction qualities* the requirements already call for (large targets, few
keystrokes, immediate confirmation, task-shaped input) but do **not** design a
specific screen, control, gesture or layout. Rule-bound stories stay consistent
with [`docs/requirements/rules/`](../requirements/rules/), which is
authoritative and read-only. Open items are collected in
[Conflicts & questions for the user](#conflicts--questions-for-the-user).

---

## Area 5.0 — Device Assignment

### 5.0.1 — Select the competitor to score from the group's pilot list

**As a** Scorer, **I want** to select, from the group's pilot list on my device,
the competitor I am about to score, **so that** everything I record is attributed
automatically to the right person without my having to look anything up.

**Acceptance criteria**
- [ ] Given my device is joined to the current round and group, when I open the
  pilot list, then it shows **only the competitors flying in that group**, so I
  cannot pick someone outside it.
- [ ] Given the group's pilot list, when I select a competitor, then that
  competitor becomes the device's active selection and is shown prominently
  (name, and start number / lane where configured) for me to check against the
  pilot beside me.
- [ ] Given a group with a single lone competitor safeguarded by a dummy
  ([5.3](../requirements/high-level-requirements.md#area-5--scoring)), when I open
  the pilot list, then the real competitor is selectable and I am never asked to
  score the dummy (the dummy is a scoring construct, not a person at the line).
- [ ] Given the base station has not yet sent this device its group context, when
  I try to select a pilot, then I am told the device is not yet joined to a
  group rather than being shown a stale or empty list.

**Traces to:** area(s) 5.0 · users.md §3 Scorer
**Notes:** The list is the *down* half of the base↔device link (pilot · group ·
round · working time) in the
[logical architecture](../architecture/logical-architecture.md).

### 5.0.2 — Confirm the selected pilot before the group starts

**As a** Scorer, **I want** the device to show the selected pilot clearly so I
and the pilot can confirm it before the working time begins, **so that** a
wrong selection is caught before any score is recorded against the wrong person.

**Acceptance criteria**
- [ ] Given I have selected a competitor, when the device is ready to score, then
  it displays that competitor unambiguously enough for the pilot to **cross-check
  it is set to their name** before the group begins
  ([`users.md §5`](../requirements/users.md#5-pilot--competitor)).
- [ ] Given the pilot beside me is **not** the selected competitor, when I notice
  during the pre-group check, then I can re-select the correct competitor
  (per [5.0.1](#501--select-the-competitor-to-score-from-the-groups-pilot-list))
  before scoring begins, with no residue of the wrong selection.
- [ ] Given confirmation is the **Scorer's responsibility** and the pilot's
  cross-check is advisory, when neither has confirmed, then the device does not
  proceed to an enterable state (see the guard,
  [5.0.4](#504--pre-group-confirmation-guard-blocks-entry-until-re-confirmed)).

**Traces to:** area(s) 5.0 · users.md §3 Scorer
**Notes:** Device–competitor binding is explicitly the **Scorer's**
responsibility; the pilot only cross-checks
([`users.md §3` device-binding call-out](../requirements/users.md#3-scorer)).

### 5.0.3 — Re-select the pilot between back-to-back groups

**As a** Scorer, **I want** to re-select the pilot on the same device between
consecutive groups, **so that** I can score back-to-back groups without stopping
to physically swap handsets.

**Acceptance criteria**
- [ ] Given I have finished scoring one group, when the next group is ready, then
  I can re-select the competitor for the new group on the **same device** without
  needing a different handset or re-joining from scratch.
- [ ] Given I re-select a competitor for the new group, when the selection is
  made, then subsequent entries attribute to the **new group and new
  competitor**, never back to the previous group's pilot or round.
- [ ] Given I re-select, when I do so, then the previous group's captured results
  are **not altered** by the new selection — re-selection changes the active
  target only. Correcting a value I captured is governed by my correction window
  ([5.1.2](#512--eyes-on-the-flight-capture-with-obvious-mistypes)); once the
  **next round** starts that window closes and any change becomes Organiser/
  Director administration ([5.3/5.4](../requirements/high-level-requirements.md#area-5--scoring)).

**Traces to:** area(s) 5.0 · users.md §3 Scorer
**Notes:** MVP is **device re-selection**, *not* device-to-device sync or
off-site scoring — those are
[Future Enhancements](../requirements/high-level-requirements.md#future-enhancements).

### 5.0.4 — Pre-group confirmation guard blocks entry until (re-)confirmed

**As a** Scorer, **I want** the device to block score entry for a group until its
pilot has been **deliberately (re-)confirmed for that group**, **so that** a
stale selection carried over from the previous group can never silently capture
scores against the wrong competitor.

**Acceptance criteria**
- [ ] Given a new group begins, when I have not yet confirmed the selected pilot
  **for that group**, then the device **blocks all score entry** and tells me a
  confirmation is required before I can capture anything.
- [ ] Given I scored a competitor in the previous group and did not change the
  selection, when the next group starts, then that carried-over selection is
  treated as **unconfirmed for the new group** — the guard re-arms every group,
  so a stale selection cannot pass silently.
- [ ] Given the guard is blocking, when I deliberately (re-)confirm the pilot for
  the current group, then and only then does score entry become enabled.
- [ ] Given I attempt to enter a value while the guard is blocking, when I do so,
  then the attempt is **refused** (nothing is recorded) and I am told to confirm
  the pilot first.
- [ ] Given confirmation is per-group, when the same competitor genuinely flies
  the next group too, then I must still re-confirm them for that group (the guard
  does not exempt an unchanged pilot).

**Traces to:** area(s) 5.0 · users.md §3 Scorer
**Notes:** This is the primary defence against the **wrong-pilot failure mode**
named in [`users.md §3`](../requirements/users.md#3-scorer) and
[5.0](../requirements/high-level-requirements.md#area-5--scoring). It is a
*per-group* arming, distinct from the one-time selection in
[5.0.1](#501--select-the-competitor-to-score-from-the-groups-pilot-list). The same
confirmation also **feeds the group's prep gate**: the preparation countdown pauses
at one minute remaining until every Scorer in the group has confirmed
([6.5](../requirements/high-level-requirements.md#area-6--display-timer--audio-field-aids)).

### 5.0.5 — Mark that the pilot cannot make the group (no-score)

**As a** Scorer, **I want** to record on my device that the pilot beside me
**cannot make this group**, **so that** the group is not held indefinitely by the
prep gate and my pilot is correctly marked as *did not fly* rather than being
scored as if they flew.

**Acceptance criteria**
- [ ] Given my pilot is not going to fly this group, when I mark them **cannot make
  the group**, then a **no-score** is recorded for them for this group — distinct
  from a **zero** (which means they flew and scored nothing)
  ([5.7](../requirements/high-level-requirements.md#area-5--scoring)).
- [ ] Given the prep gate is holding the countdown at one minute because my
  confirmation is outstanding, when I mark **cannot make the group**, then my
  device's confirmation is satisfied and the group can proceed without me having to
  confirm a pilot who is not there.
- [ ] Given I mark a no-score, when it is recorded, then it is **not** a captured
  flight result — I record no times/metrics for that pilot in this group, and the
  no-score is what the Base Station carries upstream.
- [ ] Given the pilot is a *did-not-fly*, when the round proceeds, then resolving
  the no-score (moving them to a later group, retiring, or the end-of-round
  auto-zero) is **not mine** — it is Contest-Director / Organiser oversight
  ([5.7](../requirements/high-level-requirements.md#area-5--scoring),
  [02-contest-director 5.7](02-contest-director.md#57--resolve-a-no-scored-did-not-fly-pilot)).

**Traces to:** area(s) 5.0, 5.7 · users.md §3 Scorer
**Notes:** This is one of the prep gate's release paths (all confirm · a Scorer
marks *cannot make the group* · Contest-Director override). A no-score is a
*did-not-fly* state, deliberately different from a scored zero; the Scorer only
*raises* it, they do not resolve it.

---

## Area 5.1 — Score Entry

### 5.1.1 — Capture the adjacent competitor's result live

**As a** Scorer, **I want** to record the flight result of the pilot beside me
live as it happens, **so that** the score is captured in the moment without paper
cards or later transcription.

**Acceptance criteria**
- [ ] Given the pilot is confirmed and the guard is cleared
  ([5.0.4](#504--pre-group-confirmation-guard-blocks-entry-until-re-confirmed)),
  when I capture a metric during the working time, then it is recorded **live**
  against the confirmed competitor and sent to the base station.
- [ ] Given I capture a value, when it is recorded, then the device gives
  **immediate confirmation** that it landed against the **currently confirmed
  competitor**, naming or clearly showing that competitor so I never have to
  assume it.
- [ ] Given the working time / group context supplied by the base station, when I
  record against it, then the entry carries the correct **round and group**, so a
  result cannot be misfiled to another round.
- [ ] Given the link to the base station is briefly unavailable, when I capture a
  value, then it is not silently lost — the device retains it and reflects
  whether it has been accepted upstream (MVP is on-site live capture, not
  off-site sync).

**Traces to:** area(s) 5.1 · users.md §3 Scorer
**Notes:** "task results / metrics" is the *up* half of the base↔device link in
the [logical architecture](../architecture/logical-architecture.md).

### 5.1.2 — Eyes-on-the-flight capture with obvious mistypes

**As a** Scorer, **I want** capture to work while my eyes are on the model and
the pilot — large targets, few keystrokes, sensible defaults, and instantly
visible values — **so that** I can score accurately without looking down and a
mistyped value is obvious at once.

**Acceptance criteria**
- [ ] Given I am watching the flight, when I capture a metric, then it takes
  **minimal keystrokes** and uses **large touch targets** and sensible defaults,
  so I need not study the screen (stated needs in
  [`users.md §3`](../requirements/users.md#3-scorer)).
- [ ] Given I enter a value, when it is captured, then it is **shown back
  immediately** and legibly, so an out-of-range or mistyped value is obvious in
  the moment.
- [ ] Given I spot a value I entered for my pilot is wrong, when I correct it **any
  time up to the start of the next round**, then the correction replaces the value
  with the confirmed competitor and round/group unchanged — my own capture stays
  Scorer-editable for the whole of the round it was flown in, across the group's
  own working time and any later group in the same round.
- [ ] Given the **next round has started**, when I try to change a value from a
  previous round, then it is **no longer Scorer-editable** — it has become
  mid-contest score administration for the Organiser/Director
  ([5.3/5.4](../requirements/high-level-requirements.md#area-5--scoring)). The
  round-close that ends my window is the same gate that requires **all** of a
  round's scores to be in before the next round can start (see
  [5.1.3](#513--concurrent-capture-within-a-group-without-cross-attribution)).

**Traces to:** area(s) 5.1 · users.md §3 Scorer
**Notes:** *Interaction qualities* only — the requirements call for these; no
specific control or layout is prescribed.

### 5.1.3 — Concurrent capture within a group without cross-attribution

**As a** Scorer, **I want** to capture at the same time as the other Scorers in
the group, each on our own devices, **so that** a whole group flying at once is
scored in parallel with no collision or cross-attribution between us.

**Acceptance criteria**
- [ ] Given several Scorers are scoring the same group concurrently, when each
  records against their own confirmed competitor, then entries do **not collide**
  or overwrite one another, and each lands only against that Scorer's competitor.
- [ ] Given two Scorers in the same group, when both submit at nearly the same
  moment, then both results are accepted and attributed independently (1 device →
  1 Scorer → 1 competitor).
- [ ] Given my device is one of N in the group, when I capture, then I only ever
  affect **my** confirmed competitor's record — I have no ability to edit another
  Scorer's competitor from my device.
- [ ] Given every competitor in a group must be covered, when the round's Scorers
  have captured, then each device can show **which of its confirmed competitors
  still owe a result**, so a missing capture is visible at the point of capture.
- [ ] Given a round is not fully captured, when anyone attempts to start the
  **next round**, then it is **blocked until every group in the previous round has
  all its scores in** — this both guarantees no capture is stranded and defines
  the round-close that ends the Scorer correction window
  ([5.1.2](#512--eyes-on-the-flight-capture-with-obvious-mistypes)).
  *(Owning and operating that gate — chasing the outstanding captures and deciding
  to proceed — is Organiser [5.6](../requirements/high-level-requirements.md#area-5--scoring)
  / round-progression oversight; the Scorer device only surfaces the outstanding
  items and honours the window. See
  [Conflicts & questions](#conflicts--questions-for-the-user).)*

**Traces to:** area(s) 5.1 · users.md §3 Scorer
**Notes:** Concurrent on-site multi-device capture **is** MVP core (Area 5 intro);
device-to-device sync and remote scoring are
[Future Enhancements](../requirements/high-level-requirements.md#future-enhancements).

### 5.1.4 — Follow the group's phase and clock on the device

**As a** Scorer, **I want** my device to show the group's current phase and
countdown, **so that** I know where we are — preparation, working time or the
landing window — without looking away to the field board.

**Acceptance criteria**
- [ ] Given the Base Station drives the group's shared clock
  ([Area 6](../requirements/high-level-requirements.md#area-6--display-timer--audio-field-aids)),
  when a group is running, then my device **mirrors the round, group, current phase
  (prep / working / landing) and the remaining countdown**.
- [ ] Given the phase changes (prep → working → landing), when it changes, then my
  device follows it promptly so the phase I see matches the field board and the
  audio callouts.
- [ ] Given the link to the Base Station briefly drops, when I lose sync, then the
  device **keeps counting from the last known state** and shows an **"out of sync /
  last updated"** indication, reconciling when the link returns — it does not
  silently present a frozen or wrong time as if it were live.
- [ ] Given this display is **read-only**, when it is shown, then it does not let me
  start, pause or advance the group clock — running the clock is the
  [Announcer/Timekeeper's](04-announcer-timekeeper.md), and the authority controls
  are the [Contest Director's](02-contest-director.md#65--run-control-authority-over-a-running-group).

**Traces to:** area(s) 5.1 · users.md §3 Scorer ·
[Area 6](../requirements/high-level-requirements.md#area-6--display-timer--audio-field-aids)
**Notes:** The phase/countdown is the field-aid half of the down-link the device
already receives; Area 6 adds **phase** and the **live countdown**. MVP behaviour
on sync loss is **keep local + flag**, not freeze.

---

## Area 5.2 — Task Scoring Screens

> These stories stay **generic**: they describe capturing *categories* of metric,
> not any one class's task. Discipline-specific layouts are deferred to
> per-discipline requirements
> ([5.2](../requirements/high-level-requirements.md#area-5--scoring),
> [3.7](../requirements/high-level-requirements.md#area-3--competition-setup--configuration)).
> The metrics themselves come from
> [`00-general-rules.md §2`](../requirements/rules/00-general-rules.md#2-data-the-timer--helper-collects).

### 5.2.1 — Capture the metrics the task requires

**As a** Scorer, **I want** the device to let me capture whichever metrics the
current task calls for — flight/working time, landing result, per-flight
records (launch counts are inferred from these, never entered), target-time
calls, launch/start height, and applicable
penalties/deductions — **so that** I record exactly what the flight demands and
nothing irrelevant.

**Acceptance criteria**
- [ ] Given the competition's configured discipline/task
  ([3.2](../requirements/high-level-requirements.md#area-3--competition-setup--configuration),
  [3.7](../requirements/high-level-requirements.md#area-3--competition-setup--configuration)),
  when I score a flight, then the device presents the **metric categories that
  task uses** and does not ask for metrics that task does not use (e.g. no
  launch height for an F3 class; no landing for a flight-time-only task —
  [general-rules §2](../requirements/rules/00-general-rules.md#2-data-the-timer--helper-collects)).
- [ ] Given a task that records **flight/working time**, when I capture it, then
  it is captured to the **precision that task's rules require** and the device
  neither invents nor drops precision it should keep
  ([general-rules §2](../requirements/rules/00-general-rules.md#2-data-the-timer--helper-collects):
  precision differs by class).
- [ ] Given a task that records a **landing result**, when I capture the landing,
  then I record the measured result the task defines (converted to bonus via the
  configured table downstream — the Scorer records the measurement, not the
  points maths).
- [ ] Given a multi-flight or last-flight task, when the pilot makes launches,
  then I can record **each flight as its own record** (flight number, time,
  task fields) — **which flight(s) count** (last, best-N, sum, targets
  achieved) is computed by the system from those records, never decided or
  pre-filtered by me.
- [ ] Given any metric, when I capture it, then I record the **raw
  observation only** — tape reading, stopwatch time, AMRT number, lap count —
  with **no interpretation before entry**: caps, bonus tables, deductions and
  derived judgements (e.g. an over-working-time flight) are applied by the
  system from the raw data, consistently for every pilot
  ([scorer-device.md §1](../requirements/scorer-device.md#1-capture-model--what-a-scorer-records)).
- [ ] Given a nominated-time (Poker/ladder) task, when the pilot nominates a
  target before a launch, then I can record the **target time and whether it was
  achieved**.
- [ ] Given an **F5** class, when I capture launch/start height, then I record it
  as the task requires (whole metres per
  [general-rules §2](../requirements/rules/00-general-rules.md#2-data-the-timer--helper-collects)).

**Traces to:** area(s) 5.2 · users.md §3 Scorer ·
[scorer-device.md §1](../requirements/scorer-device.md#1-capture-model--what-a-scorer-records)
**Notes:** Kept deliberately generic. Which concrete tasks map to which metrics,
and the exact precision/units, are **per-discipline** and deferred; the Scorer
device is driven by the configured task rules ([3.7](../requirements/high-level-requirements.md#area-3--competition-setup--configuration)),
not hard-coded per class. The **raw-capture principle** (record observations,
never interpretations) is owner-confirmed and recorded in
[scorer-device.md §1](../requirements/scorer-device.md#1-capture-model--what-a-scorer-records).

### 5.2.2 — Input laid out to match the shape of the task

**As a** Scorer, **I want** the inputs for a task arranged to follow the natural
order of what the pilot did, **so that** entry matches the shape of the flight
and I am not hunting across the screen while watching the model.

**Acceptance criteria**
- [ ] Given a task with an inherent order (e.g. launch → flight → landing), when I
  capture its metrics, then the inputs are presented in an order that follows how
  the flight unfolds, so capture flows without re-orienting.
- [ ] Given the current task, when the screen is shown, then only that task's
  relevant metrics are prominent, keeping keystrokes and visual search minimal
  (reinforces [5.1.2](#512--eyes-on-the-flight-capture-with-obvious-mistypes)).

**Traces to:** area(s) 5.2 · users.md §3 Scorer
**Notes:** *Interaction quality* the requirements state ("input laid out to match
the shape of the task"), not a prescribed layout — concrete per-task screens are
deferred.

### 5.2.3 — Record task-integral deductions the flight incurs

**As a** Scorer, **I want** to record the deductions/penalties that are an
**integral part of scoring the flight** as the task defines them, **so that** the
flight's raw result reflects what actually happened at the line.

**Acceptance criteria**
- [ ] Given the task defines deductions tied to the flight itself — e.g. a
  **land-out** / overshot landing, the model **contacting a person or obstacle**
  — when that condition occurs, then I can record the **observed event** as part
  of the flight result; conditions **derivable from the raw data** (e.g. an
  overflown working time, from the raw flight time vs the working time) are
  flagged by the system, not entered by me
  ([scorer-device.md §1](../requirements/scorer-device.md#1-capture-model--what-a-scorer-records)).
- [ ] Given a **discretionary disciplinary penalty** — one the Contest Director
  imposes for a rule infringement, dangerous flying, **cheating or unsporting
  behaviour** ([general-rules §6](../requirements/rules/00-general-rules.md#6-penalties-common),
  `C.19.1`) — when such a penalty is warranted, then it is **not** the Scorer's to
  impose: it is raised to the [Contest Director](02-contest-director.md#59--impose-penalties-with-correct-recompute)
  ([5.9](../requirements/high-level-requirements.md#area-5--scoring)). *(This split is confirmed with the user — see
  [Conflicts & questions](#conflicts--questions-for-the-user) item 1.)*

**Traces to:** area(s) 5.2 · users.md §3 Scorer ·
[general-rules §2, §6](../requirements/rules/00-general-rules.md)
**Notes:** `users.md §3` and Area 5.2 both list "penalties" among the Scorer's
inputs, while `general-rules §6`/`C.19.1` vest **disciplinary** penalties in the
Contest Director. This story splits the two; see the conflict item below.

---

## Conflicts & questions for the user

All three items raised in the first draft have been **resolved with the user**.
They are kept here as a record of the decision and its cross-doc consequences.

1. **"Penalties" as a Scorer input vs. Contest Director authority — RESOLVED.**
   [`users.md §3`](../requirements/users.md#3-scorer) and
   [Area 5.2](../requirements/high-level-requirements.md#area-5--scoring) list
   **penalties** among the Scorer's inputs, while
   [`general-rules §6`](../requirements/rules/00-general-rules.md#6-penalties-common)
   (`C.19.1`) vests the power to **impose penalties** in the **Contest Director**.
   **Decision:** the Scorer records only **task-integral deductions** that are part
   of scoring the flight — e.g. a **land-out**, the model **contacting a person**,
   a working-time overrun, a zero'd flight; **larger discretionary disciplinary
   penalties** (unsporting behaviour, cheating, dangerous flying, up to
   disqualification) are the **Contest Director's** and are not entered on the
   Scorer device. Applied in [5.2.3](#523--record-task-integral-deductions-the-flight-incurs).
   The rule (Director imposes) stays authoritative.
   - **Cross-doc check:** the Director side is already owned by
     [CD story 5.9](02-contest-director.md#59--impose-penalties-with-correct-recompute)
     ("infringements, dangerous flying, cheating or unsporting behaviour … up to
     disqualification"). Its **Notes** have been given a reciprocal line pointing
     at this Scorer/field-deduction boundary so the split is documented from both
     ends.

2. **Scorer correction window — RESOLVED.** The Scorer may correct a value they
   captured **for their pilot up to the start of the next round**; once the next
   round starts the value is no longer Scorer-editable and any change is
   Organiser/Director administration
   ([5.3/5.4](../requirements/high-level-requirements.md#area-5--scoring)). Applied
   in [5.1.2](#512--eyes-on-the-flight-capture-with-obvious-mistypes) and
   [5.0.3](#503--re-select-the-pilot-between-back-to-back-groups).

3. **Round-close gate — RESOLVED (ties to item 2).** The **next round cannot start
   until every group in the previous round has all its scores in.** This both
   ensures no capture is stranded and defines the round-close that ends the Scorer
   correction window. The Scorer device surfaces *which of its confirmed
   competitors still owe a result* and honours the window; **owning and operating
   the gate** (chasing outstanding captures, deciding to proceed) is Organiser
   [5.6](../requirements/high-level-requirements.md#area-5--scoring) /
   round-progression oversight. Applied in
   [5.1.3](#513--concurrent-capture-within-a-group-without-cross-attribution).

### Where the round-progression rule now lives (recorded)

The **round-close gate** (item 3) and the **round-bounded correction window**
(item 2) are a **cross-cutting round-progression rule**. Per the user's decision
it has now been recorded authoritatively so these Scorer stories *consume* it
rather than being its only home:

- [`high-level-requirements.md` Area 5](../requirements/high-level-requirements.md#area-5--scoring)
  — round completeness + the Scorer correction window (the scoring-side rule).
- [`high-level-requirements.md` Area 6.4](../requirements/high-level-requirements.md#area-6--display-timer--audio-field-aids)
  and [`users.md §4`](../requirements/users.md#4-announcer--timekeeper-field-aid-operator)
  — **operating the advance is the [Announcer / Timekeeper's](04-announcer-timekeeper.md)**,
  gated by that completeness (**not** the Organiser's, as first assumed here).
- [`04-announcer-timekeeper.md` 6.4](04-announcer-timekeeper.md#64--advance-to-the-next-round-only-when-scoring-is-complete)
  — the operator-facing story for holding the round boundary until scores are in.
