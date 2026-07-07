# Soarscore — Users

## Purpose

Identifies **who interacts with the system** and, for each, their **role**, their
**key needs**, and the **tasks** they perform. It is a companion to the
[high-level requirements](high-level-requirements.md): the requirement **areas**
describe *what the system does*; this document describes *who it does it for* and
*why*. Task columns cross-reference the areas so a story can be traced back to the
user it serves.

**Scope.** MVP only, matching the high-level requirements. In the MVP, results are
**entered directly on a device by the Scorer** — there are **no paper score cards
keyed in after the fact**. *Remote* electronic scoring (pilots entering their own
results on their own devices, and sync between devices) remains a
[future enhancement](high-level-requirements.md#future-enhancements).

---

## User at a glance

| User | Software role | Interaction | Primary areas |
|---|---|---|---|
| Organiser | Administrator / setup | Direct, hands-on | 1, 2.1, 2.3, 3, 4.1, 4.2, 4.4, 5.3, 5.4, 5.6, 7 |
| Contest Director | Officiating authority | Direct, decisions | 2.2, 3 (mid-contest changes), 4.3, 5.3, 5.5, 5.7, 5.9, 6.5, 7 |
| Scorer | Per-competitor field recorder | Direct, device-based, one per pilot | 5.0, 5.1, 5.2, 5.7 *(reads 6 on device)* |
| Announcer / Timekeeper | Field-aid operator | Direct, on-field | 6 |
| Pilot / Competitor | Subject & results consumer | Indirect | 3.4, 5, 7 |

> **One person may wear several hats — but not the Scorer.** At a small contest the
> Organiser, Contest Director and Announcer can be the same individual; most
> obviously the **Organiser** (who sets the contest up) and the **Contest
> Director** (who has authority over how it is run) are one person at many events
> but distinct roles. The **Scorer** is different: because a whole group flies at
> once, scoring is inherently **one Scorer per competitor**, several working in
> parallel. The MVP must not *force* separation of the administrative roles — a
> single operator should be able to set up and run a contest — while supporting
> many concurrent Scorers during flying.

---

## Direct users

People who operate the software themselves.

### 1. Organiser

The person who prepares the event and owns the competition data. Responsible for
getting a competition **set up correctly** before flying starts. Administrative
rather than officiating: the Organiser builds the contest, but decisions about how
it is *run* belong to the Contest Director.

**Key needs**
- Get a competition configured **correctly and quickly**, ideally from a reusable
  template, without needing to understand the scoring maths.
- Reusable **master data** (pilots, landing tables, templates) so setup is not
  repeated from scratch each event.
- Confidence that the generated **draw is fair** and defensible.

**Tasks**

| Task | Area |
|---|---|
| Maintain reusable master data (pilots, landing tables, templates) | [1](high-level-requirements.md#area-1--master-data-management) |
| Create, open and delete competitions | [2.1](high-level-requirements.md#area-2--competition-lifecycle) |
| Suspend the competition at end of day and resume it the next day, state intact | [2.3](high-level-requirements.md#area-2--competition-lifecycle) |
| Configure a competition — identity, discipline, entry options, roster, draw/scoring/task rules | [3](high-level-requirements.md#area-3--competition-setup--configuration) |
| Specify, generate and adjust the draw | [4.1](high-level-requirements.md#area-4--draw--rounds-generation), [4.2](high-level-requirements.md#area-4--draw--rounds-generation), [4.4](high-level-requirements.md#area-4--draw--rounds-generation) |
| Administer scores — corrections, cross-round review, group moves/re-flights, outlier/missing validation | [5.3](high-level-requirements.md#area-5--scoring), [5.4](high-level-requirements.md#area-5--scoring), [5.6](high-level-requirements.md#area-5--scoring) |
| Ensure no group scores with a single pilot — prefer avoiding it in the draw, else insert a random dummy for the lone pilot to be normalised against (not auto-1000); where a class annuls instead (e.g. F3B) the override is the Contest Director's to approve | [4.2](high-level-requirements.md#area-4--draw--rounds-generation), [5.3](high-level-requirements.md#area-5--scoring) |
| Produce draw and results reports | [7](high-level-requirements.md#area-7--reports) |

### 2. Contest Director

The official with **authority over the running of the competition** and over the
**key decisions** during it. Where the Organiser sets the contest up, the Contest
Director decides how it proceeds and makes the rulings that change results —
penalties, re-flights, retirements, accepting the draw, and locking the final
result. Highest privilege; often the same person as the Organiser in practice.

**Key needs**
- Authority to make **mid-contest interventions** — penalties, re-flights,
  retirements — and have results recompute correctly and consistently.
- Confidence the **draw is fair** and defensible if challenged, with the ability
  to reject it and re-draw.
- **Trustworthy, final** results they can lock, publish and stand behind.

**Tasks**

| Task | Area |
|---|---|
| Authorise mid-contest configuration changes — stated recompute consequences, next-round-onward by default, explicit opt-in to recompute flown rounds | [3](high-level-requirements.md#area-3--competition-setup--configuration) |
| Validate the draw's fairness and accept or re-draw | [4.3](high-level-requirements.md#area-4--draw--rounds-generation) |
| Impose penalties for infringements | [5.9](high-level-requirements.md#area-5--scoring) |
| Approve re-flights and group changes | [5.3](high-level-requirements.md#area-5--scoring) |
| Move a pilot from one group to another for pilot readiness (does **not** change the draw) | [5.3](high-level-requirements.md#area-5--scoring) |
| Approve the per-contest override to insert a dummy where a class rule would annul a lone-pilot group instead (e.g. F3B) | [5.3](high-level-requirements.md#area-5--scoring) |
| Retire and reinstate pilots | [5.5](high-level-requirements.md#area-5--scoring) |
| Exercise run-control authority over a running group — pause/resume preparation and the inter-group gap, fast-forward or add preparation time, release the prep confirmation gate (**pilot unconfirmed** → no-score; **device offline** → no no-score, reconciles on sync), and abort/restart a group | [6.5](high-level-requirements.md#area-6--display-timer--audio-field-aids), [5.7](high-level-requirements.md#area-5--scoring) |
| Lock the competition against further changes | [2.2](high-level-requirements.md#area-2--competition-lifecycle) |
| Publish official results | [7](high-level-requirements.md#area-7--reports) |

### 3. Scorer

**One Scorer per competitor**, not a single central operator. During a group's
working time each flying pilot has a Scorer standing beside them who records that
pilot's task metrics on a device — times, landings, laps, heights, motor runs,
penalties. The device is a **dedicated stopwatch-style handheld** and **is the
Scorer's stopwatch** — flight timing happens on the device itself
([decisions.md D2](decisions.md#d2--scorer-device-dedicated-esp32-stopwatch-style-handheld)). Each entry is recorded **automatically against that competitor** in the
contest management system, so there are no paper cards and no later transcription.
A group in the air therefore has several Scorers working in parallel, one at each
pilot's shoulder.

**Key needs**
- **Eyes on the flight, not the screen** — capture must work while watching the
  model and the pilot. The device is a stopwatch-style handheld
  ([decisions.md D2](decisions.md#d2--scorer-device-dedicated-esp32-stopwatch-style-handheld)),
  so this means **no-look, stopwatch-grade operation**: a physical start/stop
  control, minimal interactions, sensible defaults — not a phone-style touch UI.
- **Scoped to one competitor and task** — the Scorer only ever records for the
  pilot beside them, in the current group; no hunting for the right entry.
- **Immediate confirmation** the metric was captured **against the right
  competitor**, with live feedback so a mistyped value is obvious at once.
- **Set their device to the right pilot themselves** — the Scorer selects, from
  the group's pilot list on the device, the competitor they are about to score, and
  confirms it before the group starts. A Scorer often scores **back-to-back across
  consecutive groups** and has no time to physically swap devices, so the device
  must let them **re-select the pilot** rather than requiring a different handset.
- Input laid out to **match the shape of the task**, so entry follows the natural
  order of what the pilot did.
- **Record raw metrics only — no interpretation at the point of capture.** The
  Scorer enters what they observed (stopwatch time, tape reading, AMRT number,
  lap count, one record per flight — launch counts are inferred from the
  flight records, never entered); the system applies the scoring
  rules — caps, bonus tables, which flight counts, over-time detection —
  consistently from the raw data
  ([scorer-device.md §1](scorer-device.md#1-capture-model--what-a-scorer-records)).
- **See the group's live clock on their own device** — the device mirrors the
  round, group, current phase (prep / working / landing) and countdown from the
  Base Station, so the Scorer follows the group's timing without looking away to
  the field board ([Area 6](high-level-requirements.md#area-6--display-timer--audio-field-aids)).

**Tasks**

| Task | Area |
|---|---|
| Select the competitor to score from the group's pilot list on the device, and confirm before the group starts | [5.0](high-level-requirements.md#area-5--scoring) |
| Record the adjacent competitor's flight result on a device, live | [5.1](high-level-requirements.md#area-5--scoring) |
| Capture task-specific inputs (times, landings, laps, heights, motor runs, penalties) | [5.2](high-level-requirements.md#area-5--scoring) |
| Mark that the adjacent pilot **cannot make the group** — yielding a no-score — so the group can proceed | [5.0](high-level-requirements.md#area-5--scoring), [5.7](high-level-requirements.md#area-5--scoring) |

> **Device–competitor binding (MVP).** It is the **Scorer's responsibility** to
> ensure their device is set to the correct pilot — selected from the group's pilot
> list — before recording; the [Pilot](#5-pilot--competitor) should **cross-check
> this before the group begins**. Because a Scorer may run consecutive groups
> without swapping handsets, the device supports **re-selecting the pilot** between
> groups rather than a fixed one-device-per-pilot handout. A wrong selection
> silently scores the wrong competitor, so the pre-group confirmation matters. See
> [5.0 Device Assignment](high-level-requirements.md#area-5--scoring).

> Mid-contest **score administration** — corrections, cross-round review,
> re-flights/group moves, and outlier/missing validation ([5.3](high-level-requirements.md#area-5--scoring),
> [5.4](high-level-requirements.md#area-5--scoring), [5.6](high-level-requirements.md#area-5--scoring)) —
> is oversight work done by the [Organiser](#1-organiser), under the
> [Contest Director's](#2-contest-director) authority, not by the per-competitor
> Scorer.

### 4. Announcer / Timekeeper (field-aid operator)

The person at the flight line who runs each group: starts the group and drives
its **automatic phased sequence** (preparation → working time → landing window)
on the shared clock, with the audio callouts and the field board that go with it.
Operates **Area 6** in real time while a group is in the air, and **advances the
contest from one round to the next** once the previous round's scores are all in.
The **Contest Director** holds the run-control *authority* actions within a group
— pausing/fast-forwarding preparation, overriding the prep confirmation gate,
aborting a group ([6.5](high-level-requirements.md#area-6--display-timer--audio-field-aids));
at a small contest one person may hold both roles.

> **Naming caution.** This "Timekeeper" *operates the group clock and callouts for
> the whole group*. It is **not** the per-competitor [Scorer](#3-scorer), of whom
> there is one beside each pilot recording that pilot's flight metrics. One
> Announcer/Timekeeper runs the group; many Scorers record within it. This split
> is **confirmed under Area 6** and the role name is kept as-is; the two remain
> deliberately distinct.

**Key needs**
- A **big, glanceable** display and timer readable from the flight line, in
  daylight.
- **Reliable, correctly-timed** audio callouts tied to the working-time window.
- **Zero fuss** to start/stop/reset for the next group — hands are busy, attention
  is on the field, not the screen.

**Tasks**

| Task | Area |
|---|---|
| Run the group's automatic phased timer — preparation, working time, landing window — on the shared clock | [6.1](high-level-requirements.md#area-6--display-timer--audio-field-aids) |
| Drive the audio callouts tied to the clock — round/group and pilot announcements, per-minute and final-30 s working-time calls, the end-of-working-time horn, and the landing / all-down calls | [6.2](high-level-requirements.md#area-6--display-timer--audio-field-aids) |
| Show the current round, group and phase countdown on the field board | [6.3](high-level-requirements.md#area-6--display-timer--audio-field-aids) |
| Start groups and hold/adjust progression between them (Contest-Director authority over prep pause / fast-forward / add-time, gate override and abort) | [6.5](high-level-requirements.md#area-6--display-timer--audio-field-aids) |
| Advance to the next round only once the previous round's scores are all in (gates the [Scorer's](#3-scorer) correction window) | [6.4](high-level-requirements.md#area-6--display-timer--audio-field-aids) |

---

## Indirect users

People whose needs shape the system but who do **not operate it directly** in the
MVP.

### 5. Pilot / Competitor

The reason the contest exists. In the MVP the pilot does **not enter their own
data** — their flight result is recorded on a device by the Scorer beside them, and
the pilot *reads* the draw and results. Pilots do **not** self-score (a conflict of
interest), so they remain an indirect user by design.

**Key needs**
- To know **when and in which group** they fly, and in which lane.
- To **hear the group and pilot-name announcements** and read the field board
  (round, group, current phase, remaining time), so they know whether they are in
  the current group and how the working time is running
  ([Area 6](high-level-requirements.md#area-6--display-timer--audio-field-aids)).
- **Assurance their flight is being recorded against them** — the ability to
  cross-check, before the group begins, that the Scorer's device is set to their
  name.
- Results that are **correct, transparent and promptly available** — position,
  round-by-round breakdown, and drop-worst applied correctly.
- Assurance the **draw is fair** and their entry details (e.g. class, start
  number) are right.

**Tasks (mediated through officials and reports)**

| Task | Area |
|---|---|
| Provide/confirm entry details (e.g. class, start number) via the roster | [3.4](high-level-requirements.md#area-3--competition-setup--configuration) |
| Cross-check the Scorer's device is set to their name before the group begins | [5.0](high-level-requirements.md#area-5--scoring) |
| Hear the round / group / pilot announcements and read the field board to know when they fly | [6.2](high-level-requirements.md#area-6--display-timer--audio-field-aids), [6.3](high-level-requirements.md#area-6--display-timer--audio-field-aids) |
| Fly; result entered on their behalf by the Scorer | [5.2](high-level-requirements.md#area-5--scoring) |
| Read the draw, flying order and results | [7.1](high-level-requirements.md#area-7--reports), [7.3](high-level-requirements.md#area-7--reports), [7.4](high-level-requirements.md#area-7--reports) |

---

## Deferred beyond the MVP

Not needed for a basic contest; captured so the roles are not lost.

- **Team Manager** — a non-flying official consuming team classification results.
  Deferred with team-oriented reporting.
- **Jury** — a panel adjudicating protests and auditing that scoring followed the
  rules. Deferred; its needs (auditable, traceable results) are already partly
  served by [Area 7](high-level-requirements.md#area-7--reports).

## Notes for future work

- **Announcer vs. per-pilot timekeeper — resolved.** With Area 6 confirmed, the
  two roles are kept **deliberately distinct**: the **Announcer / Timekeeper** runs
  the *group* clock, callouts and board (one per group); the **Scorer** records one
  pilot's metrics (one per flying pilot). The role name is retained; the "one runs
  the group, many record within it" split stands.
- **Pilots do not self-score** — a conflict of interest — so the Pilot stays an
  *indirect* user even as scoring goes electronic. Any future *remote* scoring is
  for officials (e.g. off-site Scorers), not for pilots recording their own
  flights.
- **Organiser vs. Contest Director** — kept as distinct roles for authority even
  though one person often fills both. Any future permissions model should preserve
  the solo-operator case.
