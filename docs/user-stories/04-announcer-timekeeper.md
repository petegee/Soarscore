# Soarscore — User Stories: Announcer / Timekeeper

> ✅ **Area 6 confirmed and in MVP scope.** The Announcer / Timekeeper operates
> **Area 6 (Display, Timer & Audio)**, now confirmed with the user and no longer a
> stub (see
> [`high-level-requirements.md` Area 6](../requirements/high-level-requirements.md#area-6--display-timer--audio-field-aids)).
> The field always has a **large, bright timer/display board** visible to everyone
> and a **loudspeaker set**, both connected to and driven by the **Base Station**
> from **one shared clock**. Once started, a duration-shaped group runs an
> **automatic phased sequence**: announce round/group → announce pilots →
> **preparation** → **working time** → **landing window**. Group and round
> boundaries are **operator actions — nothing starts itself**
> ([decisions.md D10](../requirements/decisions.md#d10--operator-driven-progression-automation-runs-only-inside-a-group)).

The **Announcer / Timekeeper** runs each flight **group** from the flight line:
starts the group, lets its phased sequence run on the shared clock, and the audio
callouts and field board that go with it — and **advances the contest from one
round to the next**. There is **one** of them per group. Their needs are physical:
**hands busy, eyes on the field, not the screen** — a big, glanceable,
daylight-readable board, reliable and correctly-timed callouts, and **zero-fuss**
control between groups.

> **Naming caution — confirmed split.** This Timekeeper runs the **group clock,
> callouts and progression for the whole group** — it is **not** the per-competitor
> [Scorer](03-scorer.md), of whom there is one beside each pilot recording that
> pilot's flight metrics. **One** Announcer/Timekeeper runs the group; **many**
> Scorers record within it. Under the confirmed Area 6 the two roles are kept
> **deliberately distinct** and the role name is retained
> ([`users.md §4`](../requirements/users.md#4-announcer--timekeeper-field-aid-operator)).

**Scope.** MVP only. These stories flesh out the Announcer/Timekeeper's Area 6
sub-areas from
[`users.md §4`](../requirements/users.md#4-announcer--timekeeper-field-aid-operator)
and the [logical architecture](../architecture/logical-architecture.md)'s
**Field Aids** node — the bright board + loudspeakers, driven by the Base Station:

- **Area 6.1** — Timer & Phases: run the group's automatic phased countdown
  (preparation → working time → landing window) on the shared clock.
- **Area 6.2** — Audio: the callout sequence — round/group and pilot
  announcements, the working-time calls and end-of-working-time horn, the landing
  and all-down calls.
- **Area 6.3** — Field Display Board: show the current round, group, phase and
  remaining time, **big, glanceable, daylight-readable** from the flight line.
- **Area 6.4** — Round Progression: advance to the next round, **gated** by the
  previous round being fully scored
  ([Area 5](../requirements/high-level-requirements.md#area-5--scoring)).
- **Area 6.5** — Group Run Control: start **every** group with one deliberate
  action ([D10](../requirements/decisions.md#d10--operator-driven-progression-automation-runs-only-inside-a-group));
  the sequence then runs itself inside the group. The **Contest Director**
  holds the authority actions (prep pause/fast-forward/add-time, prep-gate
  override, abort) and the "advance anyway" round-advance override.

**Role boundaries — not crossed here.** Live **score capture** (Area 5) is the
[Scorer's](03-scorer.md). **Setup, draw and results** (Areas 1–4, 7) belong to the
[Organiser](01-organiser.md) / [Contest Director](02-contest-director.md); the
field board **consumes** the current round/group/phase the Base Station provides.
The **authority** run-control actions within a group — pausing or fast-forwarding
preparation, overriding the prep confirmation gate, aborting a group — are the
[Contest Director's](02-contest-director.md#65--run-control-authority-over-a-running-group);
at a small contest one person may hold both roles.

Stories are **high-level and implementation-agnostic**. They state the field needs
the requirements name (glanceable, daylight-readable, correctly-timed callouts,
low-fuss control) but do **not** design the board, choose exact audio wording, or
specify hardware. Rule-bound stories stay consistent with
[`docs/requirements/rules/`](../requirements/rules/), which is authoritative and
read-only.

---

## Area 6.1 — Timer & Phases

### 6.1.1 — Run the group's phased countdown (prep → working → landing)

**As an** Announcer / Timekeeper, **I want** each group to run its phased
countdown — **preparation**, **working time**, **landing window** — automatically
on one shared clock, **so that** the whole group flies to a single visible timeline
without me driving each phase by hand.

**Acceptance criteria**
- [ ] Given a group is started, when its sequence runs, then it counts down
  **preparation**, then **working time**, then the **landing window**, with each
  phase flowing **automatically** into the next (prep → working → landing) — I do
  not have to trigger each transition.
- [ ] Given the phase durations, when the timer runs, then **preparation** and the
  **landing window** use the **per-competition** values
  ([3.8](../requirements/high-level-requirements.md#area-3--competition-setup--configuration))
  and **working time** uses the **current round's task** value
  ([3.7](../requirements/high-level-requirements.md#area-3--competition-setup--configuration)),
  which may differ round to round — not a fixed value I set by hand.
- [ ] Given the working-time countdown reaches zero, when it ends, then it clearly
  marks the **end of working time** — the point beyond which flight time no
  longer **counts** — while the Scorer devices keep timing to first ground
  contact; the system applies the cap and derives any overfly from the flight
  timestamps
  ([decisions.md D5/D9](../requirements/decisions.md#d9--per-flight-timestamps-on-the-base-clock);
  [general-rules §2](../requirements/rules/00-general-rules.md#2-data-the-timer--helper-collects)).
- [ ] Given the working time has ended, when the **landing window** runs, then all
  competitors must land within it; its overrun is **derived by the system from
  the flight's timestamps**
  ([decisions.md D9](../requirements/decisions.md#d9--per-flight-timestamps-on-the-base-clock))
  — the Scorer records observations only
  ([5.2.3](03-scorer.md#523--record-task-integral-deductions-the-flight-incurs)),
  and the field-aid timer itself scores nothing.

**Traces to:** area(s) 6.1 · users.md §4 Announcer / Timekeeper ·
[general-rules §1, §2](../requirements/rules/00-general-rules.md)
**Notes:** Working-time durations come from the per-task rules and are read, not
edited, here (editing is Area 3, the [Organiser's](01-organiser.md)). Preparation
and landing-window durations are per-competition
([3.8](../requirements/high-level-requirements.md#area-3--competition-setup--configuration)).

### 6.1.2 — One shared clock drives board, audio and devices together

**As an** Announcer / Timekeeper, **I want** the board, the callouts and the
Scorer devices to run off the **same clock**, **so that** what the field sees, what
it hears, and what each Scorer sees on their device cannot drift apart.

**Acceptance criteria**
- [ ] Given a group is running, when the phase and countdown change, then the
  **board** ([6.3](#area-63--field-display-board)), the **audio callouts**
  ([6.2](#area-62--audio)) and the **Scorer devices**
  ([5.1.4](03-scorer.md#514--follow-the-groups-phase-and-clock-on-the-device)) all
  reflect the **same** phase and remaining time.
- [ ] Given the clock is the single source, when a callout fires or a phase turns
  over, then it is **driven by that clock**, so a callout cannot fire at a time the
  board disagrees with.
- [ ] Given the group ends, when the next group begins, then the clock **resets
  cleanly** for the new group with no leftover state from the previous group's run.

**Traces to:** area(s) 6.1 · users.md §4 Announcer / Timekeeper
**Notes:** The shared clock is the field-aid feed the Base Station drives to the
board, the speakers and the devices — see the
[logical architecture](../architecture/logical-architecture.md).

---

## Area 6.2 — Audio

### 6.2.1 — Announce the round, group and its pilots

**As an** Announcer / Timekeeper, **I want** each group to be announced by name and
its pilots read out, **so that** every pilot knows whether they are in this group
and helpers can get to the line in time.

**Acceptance criteria**
- [ ] Given a group is about to run, when its sequence begins, then the speakers
  announce the **round and group** by name (e.g. "Round 1, Group A").
- [ ] Given the group is announced, when the pilots are read, then each competitor
  in the group is announced in **flying order** with **name and start number**, so
  a pilot hears whether they are in this group.
- [ ] Given the pilots have been announced, when preparation begins, then the start
  of the **preparation time** is announced.

**Traces to:** area(s) 6.2 · users.md §4 Announcer / Timekeeper
**Notes:** Pilot names are **announced by audio**, not shown on the board
([6.3](#area-63--field-display-board)). For the MVP they are voiced by
**text-to-speech in English only**
([Future Enhancements](../requirements/high-level-requirements.md#future-enhancements));
pronunciation of international names is an **accepted MVP limitation**, not a
blocker (see [Conflicts & questions](#conflicts--questions-for-the-user) item 6).

### 6.2.2 — Working-time callouts and the landing sequence

**As an** Announcer / Timekeeper, **I want** the working-time and landing callouts
to fire reliably on the shared clock, **so that** pilots and helpers get consistent
audible cues without me watching the clock and calling each one by hand.

**Acceptance criteria**
- [ ] Given the **working time** is running, when each whole minute passes, then the
  **remaining time is announced each minute on the minute**.
- [ ] Given the working time is in its **final 30 seconds**, when it counts down,
  then **every second is announced from −30 s to zero**.
- [ ] Given the working time reaches zero, when it ends, then a **loud horn**
  signals the **end of working time**
  ([general-rules §2](../requirements/rules/00-general-rules.md#2-data-the-timer--helper-collects)).
- [ ] Given the working time has ended, when the **landing window** starts and ends,
  then its **start** and its **all-down** (end) are each announced.
- [ ] Given I start / abort / restart a group, when the clock re-bases
  ([6.5](#area-65--group-run-control)), then pending callouts are **cancelled and
  re-based with the clock** — the previous run's callouts are not left queued.
- [ ] Given any additional in-working-time reminders are **configured**
  ([3.8](../requirements/high-level-requirements.md#area-3--competition-setup--configuration)),
  when enabled, then they fire on the same clock; when not, only the mandatory
  callouts above fire.

**Traces to:** area(s) 6.2 · users.md §4 Announcer / Timekeeper ·
[general-rules §1, §2](../requirements/rules/00-general-rules.md)
**Notes:** The mandatory set (round/group + pilots, prep start, per-minute, −30 s
second-by-second, end-of-working horn, landing start + all-down) is fixed; extra
reminders are configurable. No spoken wording, language or sound is prescribed here.

---

## Area 6.3 — Field Display Board

### 6.3.1 — Show round, group, phase and remaining time, glanceable from the line

**As an** Announcer / Timekeeper, **I want** a big, bright, daylight-readable board
showing the current round, group, phase and remaining time, **so that** everyone on
the field can see where the group is at a glance without crowding the
operators' companion-app screen (the Base Station itself is headless).

**Acceptance criteria**
- [ ] Given a group is current, when the board is shown, then it presents the
  **current round and group**, the **current phase** (preparation / working time /
  landing window) and the **remaining time (mm:ss)** of that phase, as driven by the
  **Base Station** from the shared clock.
- [ ] Given the board is read from the flight line in daylight, when a pilot or
  helper glances at it, then it is **large and legible enough to read at a glance**
  from the line — the stated need in
  [`users.md §4`](../requirements/users.md#4-announcer--timekeeper-field-aid-operator).
- [ ] Given the phase or group changes (via [6.1](#area-61--timer--phases) and
  [6.4](#64--advance-to-the-next-round-only-when-scoring-is-complete)), when it
  changes, then the board **follows the current phase/group** rather than showing a
  stale one.
- [ ] Given **pilot names and flying order are announced by audio**
  ([6.2](#area-62--audio)), when the board is shown, then it does **not** need to
  list them — the board carries round/group, phase and the clock only.

**Traces to:** area(s) 6.3 · users.md §4 Announcer / Timekeeper ·
[logical architecture Field Aids](../architecture/logical-architecture.md)
**Notes:** The board is **read-only** to this role — it does not edit the draw or
flying order (Area 4, the [Organiser's](01-organiser.md)). Layout, size, colours
and hardware are not designed here. Decision recorded: **flying order is
audio-only**, not on the board (contrast the earlier provisional draft).

---

## Area 6.4 — Round Progression

### 6.4 — Advance to the next round only when scoring is complete

**As an** Announcer / Timekeeper, **I want** to advance the contest to the next
round only once every group in the previous round has all its scores in, **so
that** no flight is left unscored when the contest moves on.

**Acceptance criteria**
- [ ] Given a round in which **at least one group still owes a result**, when I
  attempt to start the next round, then the advance is **blocked** and I am shown
  which group(s)/competitor(s) are still outstanding, so I know what to chase
  before proceeding ([Area 5 round completeness](../requirements/high-level-requirements.md#area-5--scoring)).
- [ ] Given a round in which a pilot holds an **unresolved no-score** (did not fly)
  and groups remain that they could still fly, when I attempt to advance, then the
  advance is likewise **held** until the no-score is resolved — moved to a later
  group, or converted to a zero at round end
  ([5.7](../requirements/high-level-requirements.md#area-5--scoring)).
- [ ] Given a **granted-but-unflown re-flight** whose placement is the end of the
  ongoing round ([5.3](../requirements/high-level-requirements.md#area-5--scoring)),
  when I attempt to advance, then the advance is likewise **blocked** — advancing
  would strand the entitlement — until the re-flight group is flown (or the
  Contest Director overrides).
- [ ] Given a round in which **every group has all its scores captured** (no
  no-score still resolvable, no re-flight still owed), when I advance, then the
  next round becomes the current round and its first group can be run.
- [ ] Given Scorer self-correction is **group-bounded** — each device's window
  closes when the **next group** starts
  ([decisions.md D11](../requirements/decisions.md#d11--the-devices-scope-is-the-current-group);
  [03-scorer 5.1.2](03-scorer.md#512--eyes-on-the-flight-capture-with-obvious-mistypes)),
  when I hold or operate the round boundary, then it is **not** what closes
  Scorer corrections — any change to a flown group's value is already
  mid-contest score administration for the
  [Organiser](01-organiser.md) / [Contest Director](02-contest-director.md)
  ([5.3](../requirements/high-level-requirements.md#area-5--scoring)/[5.4](../requirements/high-level-requirements.md#area-5--scoring)).
- [ ] Given I am the operator of the advance, when the previous round is
  incomplete, then **I do not decide the missing scores myself** — chasing /
  validating them is [Organiser 5.6](../requirements/high-level-requirements.md#area-5--scoring)
  oversight; my action is only to hold the round boundary until they are in.
- [ ] Given a blocked advance the contest nonetheless must get past (e.g. a
  lost paper record, fading daylight), when the **Contest Director** issues an
  explicit, attributed **"advance anyway" override**
  ([CD 6.5](02-contest-director.md#65--run-control-authority-over-a-running-group);
  [decisions.md D10](../requirements/decisions.md#d10--operator-driven-progression-automation-runs-only-inside-a-group)),
  then the advance proceeds: outstanding missing scores become **flagged
  anomalies** for the end-of-contest validation pass, unresolved no-scores
  convert to **zeros**
  ([5.7](../requirements/high-level-requirements.md#area-5--scoring)), and an
  unflown re-flight entitlement **lapses** (the original result stands,
  flagged) — **I cannot override it myself**.

**Traces to:** area(s) 6.4 · users.md §4 Announcer / Timekeeper ·
[Area 5 round completeness](../requirements/high-level-requirements.md#area-5--scoring)
**Notes:** The gate is defined at the **round** boundary (start of the next round).
Starting each **group** within a round is the **same operator action**
([6.5](#area-65--group-run-control), [D10](../requirements/decisions.md#d10--operator-driven-progression-automation-runs-only-inside-a-group))
but is not score-gated — only the round boundary is; group starts remain subject
to the prep confirmation gate. Assigned to the Announcer/Timekeeper per the
user's decision; at a small contest this may be the same person as the Organiser /
Contest Director.

---

## Area 6.5 — Group Run Control

### 6.5.1 — Start every group with one deliberate action

**As an** Announcer / Timekeeper, **I want** to start each group with a single
deliberate action and have its sequence then run itself, **so that** the field
moves only when I say it is ready, yet I never have to drive a running group's
phases by hand.

**Acceptance criteria**
- [ ] Given a group is ready, when I **start** it, then its sequence begins
  (announce round/group → announce pilots → preparation) with **minimal,
  unambiguous interaction**, as
  [`users.md §4`](../requirements/users.md#4-announcer--timekeeper-field-aid-operator)
  requires ("zero fuss … hands are busy").
- [ ] Given a group has finished its **landing window**, when the next group is
  due, then it does **not start itself** — I start it with the **same single
  action**, whenever the field is ready
  ([decisions.md D10](../requirements/decisions.md#d10--operator-driven-progression-automation-runs-only-inside-a-group)).
- [ ] Given the current group's task is **manual-run** (its shape does not fit
  the phased sequence — e.g. F3B Distance or Speed, F3K all-up), when I start
  it, then the group is marked **current** and the Scorer devices receive their
  group context for normal capture, but **no automated countdown, callouts or
  prep-gate hold run** — I run the field by hand; whether a task is
  sequence-driven or manual-run **derives from the task type**, and my start
  action is identical either way.
- [ ] Given the **prep confirmation gate** is holding a group's preparation at one
  minute remaining because not every pilot has a confirming device
  ([5.0.4](03-scorer.md#504--pre-group-confirmation-guard-blocks-entry-until-re-confirmed)),
  when I look at the field aids, then the **hold is visible** so I know why the
  group has not progressed and who is outstanding.
- [ ] Given the authority to hold, shorten, extend, override the gate or abort a
  group rests with the **Contest Director**
  ([6.5](02-contest-director.md#65--run-control-authority-over-a-running-group)),
  when those controls are exercised, then the running clock, board and callouts I
  operate **follow them** — e.g. a prep pause holds my countdown, an abort restarts
  the group from preparation and annuls its accumulated data.

**Traces to:** area(s) 6.5 · users.md §4 Announcer / Timekeeper ·
[00-general-rules §1](../requirements/rules/00-general-rules.md)
**Notes:** The **authority** actions (prep pause/resume, fast-forward −1 min to a
1-minute floor, add-time +1 min, prep-gate override, abort/restart) are the
[Contest Director's](02-contest-director.md#65--run-control-authority-over-a-running-group)
— storied there. **Working time and the landing window cannot be paused**; the only
control that reaches into a running working time is the Director's **abort**, which
discards the group's data and restarts from preparation. At a small contest one
person may operate the clock and hold the authority.

---

## Conflicts & questions for the user

Area 6 is now **confirmed with the user**; the items below were the open questions
in the provisional draft and are recorded here with their resolutions. Only item 6
remains as an implementation risk to watch.

1. **Area 6 confirmed — RESOLVED.** Sub-areas 6.1 Timer, 6.2 Audio, 6.3 Field
   Display are no longer inferred; the field board + loudspeakers, the automatic
   phased sequence (prep → working → landing), and the Contest-Director run
   control are confirmed and recorded in
   [`high-level-requirements.md` Area 6](../requirements/high-level-requirements.md#area-6--display-timer--audio-field-aids).
   *(Amended 2026-07-08, [D10](../requirements/decisions.md#d10--operator-driven-progression-automation-runs-only-inside-a-group):
   the inter-group gap was dropped — group starts are operator actions, so
   nothing consumes it.)*

2. **Callouts — RESOLVED.** The mandatory set is: round/group + pilot names (flying
   order, name + start number), start of preparation, remaining time **each minute
   on the minute** during working time, **every second from −30 s to zero**, a
   **loud horn** at end of working time, and the **landing-window start** and
   **all-down** calls. Additional in-working-time reminders are **configurable**
   ([3.8](../requirements/high-level-requirements.md#area-3--competition-setup--configuration)).
   Applied in [6.2](#area-62--audio).

3. **Preparation window — RESOLVED.** Preparation **is timed and announced** and is
   the first phase of every group; its duration is **per-competition** (respecting
   any class minimum, e.g. F5K ≥ 5 min). The Contest Director may **fast-forward**
   (−1 min per click, floor 1:00), **add time** (+1 min), or **pause** it. Applied
   in [6.1.1](#611--run-the-groups-phased-countdown-prep--working--landing) and
   [CD 6.5](02-contest-director.md#65--run-control-authority-over-a-running-group).

4. **Board vs timer — RESOLVED.** They are one system-driven surface: the board
   shows round/group, phase and remaining time from the shared clock, and the same
   clock drives the audio and the Scorer devices. **Flying order / pilot names are
   audio-only, not on the board.** Applied in
   [6.1.2](#612--one-shared-clock-drives-board-audio-and-devices-together) and
   [6.3](#area-63--field-display-board).

5. **Round-progression ownership — RESOLVED, kept for record.** Round progression
   is the Announcer/Timekeeper's, gated by score completeness (and now by any
   unresolved [no-score](../requirements/high-level-requirements.md#area-5--scoring)).
   Only **round** starts are gated; a blocked advance yields only to the Contest
   Director's attributed "advance anyway" override. Recorded as
   [Area 6.4](../requirements/high-level-requirements.md#area-6--display-timer--audio-field-aids)
   and [6.5](#area-65--group-run-control). *(Amended 2026-07-08,
   [D10](../requirements/decisions.md#d10--operator-driven-progression-automation-runs-only-inside-a-group):
   group starts are now operator actions too — the earlier
   automatic-after-inter-group-gap behaviour is removed; group starts are not
   score-gated but remain subject to the prep confirmation gate.)*

6. **Voicing pilot names — RESOLVED.** Pilot names are voiced by **text-to-speech,
   English only**, for the MVP. Pronunciation of international names is an **accepted
   MVP limitation** rather than a blocker; a non-English or recorded-audio approach
   is a possible future enhancement. The requirement fixes both **what** is
   announced (flying order, name + start number) and **how** (English TTS).
