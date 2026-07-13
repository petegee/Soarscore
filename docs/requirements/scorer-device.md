# Soarscore — Scorer Device Requirements

**Status: draft for review.** Commissioned from the
[blind-spots report](../../blindspots-report.md) (items A1–A6, C5, D). Where a
decision is still the owner's to make it is marked **OPEN** with a proposed
default; everything else is a requirement. The device is being **prototyped
by a separate person** — the [Open items](#open-items) section at the end is
the handoff checklist of what still needs clarity, split between owner
decisions and prototype validations. Companion to
[high-level-requirements.md](high-level-requirements.md) (Areas 5 and 6) and
[decisions.md](decisions.md) (especially
[D2](decisions.md#d2--scorer-device-dedicated-esp32-stopwatch-style-handheld),
[D5](decisions.md#d5--end-of-working-time-does-not-stop-the-device-stopwatch),
[D6](decisions.md#d6--offline-first-buffer-and-sync-publish-when-connected)).

The device is a **dedicated ESP32 stopwatch-style handheld** with custom
firmware — the device *is* the Scorer's stopwatch (D2). One device → one
Scorer → one competitor per group ([Area 5](high-level-requirements.md#area-5--scoring)).

---

## 1. Capture model — what a Scorer records

*(Owner-confirmed 2026-07-07: this list is what a scorer physically writes on
paper today, task dependent, per flight.)*

Per **flight**, one or more of, depending on the task:

| Field | Notes |
|---|---|
| **Flight time** | Timed **on the device** — start/stop is the stopwatch (D2). Precision is per class (0.1 s F3J/F3K; whole s F5J/F5K/F5L and F3B-A; 1/100 s F3B-C). |
| **Landing tape reading** | The **numbered landing point read off the tape** — usually not metres; tapes are marked with point numbers, and the same reading is interpreted differently per task, so the raw reading is what's captured and the system maps it through the task's landing table. |
| **Number of laps** | F3B Task B: completed 150 m legs. |
| **Launch height** | F5 classes: read as a number off the **AMRT** after the flight ([f5-general §2](rules/f5-general-rules.md#2-data-the-timer--helper-collects)). Entered **on the device**, at flight or group end, like the landing reading (§2). |
| **Target flight time** | Poker/ladder-style tasks: the nominated target for this flight (see §2 for where it's entered). |
| **Flight number** | Which flight this record belongs to — see the multi-flight principle below. *(Number of launches is **not** a field — it is inferred from the flight numbers.)* |
| **Task-integral penalties** | Land-out, model hits a person, etc. — a fixed **enumeration of allowed types**; the task metadata selects which are appropriate for the group's task ([Scorer story 5.2.3](../user-stories/03-scorer.md#523--record-task-integral-deductions-the-flight-incurs)). Discretionary disciplinary penalties remain the Contest Director's ([5.9](high-level-requirements.md#area-5--scoring)) and are never entered on the device. |

Fields are **nullable per task**: a per-flight record need not carry every
field — the task metadata states which fields are **required** for the
group's task and which are optional (Appendix A.3).

**The raw-capture principle.** *(Owner-confirmed 2026-07-07.)* The Scorer
records **raw metrics only and makes no interpretation before entering
them**: the tape reading, not the landing bonus; the stopwatch time, not the
capped/scored time; the AMRT number, not the height deduction; what was
flown, not which flight counts. **All interpretation and calculation is the
system's**, applied consistently from the raw data — scoring rules, caps,
bonus tables, and derived judgements (e.g. an over-working-time flight is
detected by the base from the raw flight timestamps (D9), never decided by
the Scorer). This also keeps the device UI to plain observations and makes
every computed score reproducible from the event log (D4).

**The timestamp principle.** *(Owner-decided 2026-07-08,
[D9](decisions.md#d9--per-flight-timestamps-on-the-base-clock).)* Every
per-flight record carries **automatic start/stop timestamps on the base's
shared clock**, stamped by the firmware at the Scorer's start/stop actions —
the Scorer never enters them. The Scorer times through to the model's
**first ground contact, even after the horn** (D5 as amended): the system —
not the Scorer — applies the working-time cap and derives overfly (and its
magnitude) and launch-before-working-time from the stamps. Offline captures
stamp against the device's mirrored clock and reconcile on sync (D6); stamps
that cannot be reconciled within the §7 bound are flagged, never presented
as exact.

**The multi-flight principle.** A pilot can fly **more than one flight per
group** — in most classes this is routine (unlimited attempts with
last-flight-official, or a task that *consists* of several flights). The
device therefore records a **list of per-flight records within the group**,
not a single score: each flight gets its own time (and task fields), the
flight number orders them, and **which flight(s) count is a scoring rule
applied afterwards** (last, best-N, sum, targets achieved) — the Scorer
captures what happened; the system computes what counts.

### Per-class capture matrix

Derived from the [rule docs](rules/); those remain authoritative on numbers.

| Class / task | Per-flight fields | Flights per group |
|---|---|---|
| **F3B A** Duration | flight time (whole s); landing tape reading | unlimited attempts; **last flight official** |
| **F3B B** Distance | **laps** (completed legs) | unlimited attempts; last official |
| **F3B C** Speed | course time (1/100 s — course judges, not the shoulder Scorer) | unlimited attempts |
| **F3J** | flight time (0.1 s); landing tape reading — overfly is derived by the base from the flight timestamps (D9) | unlimited attempts; **last flight official** |
| **F3K** (tasks A–N) | flight time (0.1 s, truncated); poker/ladder **target call + achieved?** — launch count inferred from flight numbers | **many** — the defining case (e.g. 3-of-6, five longest) |
| **F5J** | flight time (whole s); **AMRT launch height** (m); landing tape reading | **one attempt only** |
| **F5K** (tasks A–E) | flight time (whole s); **AMRT launch altitude** (m); target **Y/N** (Task E); landed-in-pilot-area? — launch count inferred from flight numbers | up to 3–4 launches per task |
| **F5L** | flight time (whole s); landing tape reading | unlimited attempts; **last flight official** |

**F3B laps and course times — source of the reading** *(owner-noted
2026-07-08)*: the local F3B scene already runs a custom wireless lap/speed
timing rig with its own Raspberry-Pi base station. In the MVP the Scorer
**reads those values off that system and cross-enters them on the
hand-held** — ordinary raw capture, no link between the systems. Direct
base-to-base ingestion is a future enhancement
([physical architecture §9](../architecture/physical-architecture.md#9-adjacent-system--the-local-f3b-lapspeed-timing-rig)).

**Descriptor-driven capture** *(owner-confirmed 2026-07-07)*: there is no
single "first discipline" — any of the six classes could be run first. At
**competition start the Base Station instructs the device which class it is
servicing and pushes metadata describing the data to be collected** (the
fields, per the matrix above, with their precision and multi-flight shape).
The device renders its capture flow from that **task descriptor** rather
than hard-coding per-class screens — consistent with
[Scorer story 5.2.1](../user-stories/03-scorer.md#521--capture-the-metrics-the-task-requires)
("driven by the configured task rules ([3.7](high-level-requirements.md#area-3--competition-setup--configuration)),
not hard-coded per class"). The base↔device **descriptor contract** is
therefore a first-order design artifact — see Open items.
The report recommends prototyping the **F3K multi-launch flow** regardless —
it is the hardest case; if the device handles F3K, everything else fits.

**Descriptor updates reach the fleet at group boundaries** *(owner-decided
2026-07-08,
[D11](decisions.md#d11--the-devices-scope-is-the-current-group))*: a
CD-authorised mid-contest change that alters the descriptor
([Area 3](high-level-requirements.md#area-3--competition-setup--configuration))
re-issues it, and the **group-context push carries the current descriptor**
— a device applies it at its next group entry, **never mid-group**. Group
entry **requires that push**: an offline device that missed it cannot
capture for the new group until it syncs (pen and paper, D3, covers the
meanwhile); a device that received the push and then dropped offline
continues normally, buffering (D6). Every capture is thus made under the
descriptor current at its group's start.

---

## 2. On-device vs base-side split (A3, C5)

Not everything belongs on a ~1.3-inch round screen. Proposed split:

**On-device (per flight, at the pilot's shoulder):**

- Flight timing — physical **start/stop control**; no-look, stopwatch-grade
  ([users.md §3](users.md#3-scorer)); each start/stop is stamped on the
  mirrored base clock
  ([D9](decisions.md#d9--per-flight-timestamps-on-the-base-clock)).
- **Flight number** — advanced automatically per start/stop cycle.
- **Launch count** — implied by the flight records; no separate entry.
- Poker/ladder **target achieved? (Y/N)** — single binary per flight.
- **Landing tape reading** — a short number (the landing point off the
  tape), entered right after the measurement while still at the spot.
- **F5 AMRT launch height** (C5) *(owner decision 2026-07-08)* — read as a
  number off the AMRT and **entered on the device**, at flight or group end,
  in the same calm-moment slot as the landing reading.
- **Laps** (F3B B) — an increment-per-leg counter.
- Task-integral **penalty quick-flags** — land-out, hit-a-person; one action
  each, confirmed. Over-working-time needs **no** Scorer action: the Base
  Station derives overfly from the flight timestamps automatically (D9;
  [6.1](high-level-requirements.md#area-6--display-timer--audio-field-aids)).

**Base-side (entered at the Base Station):**

- **Poker/ladder target times** (the nominated value, not the Y/N) — rare,
  multi-digit, announced to the timekeeper; the device shows the nominated
  target, the base records it. **OPEN:** on-device nomination may prove
  workable in the F3K prototype.
- Anything **rare or corrective** — manual entry and paper-fallback
  reconciliation stay base-side ([5.8](high-level-requirements.md#area-5--scoring)).

---

## 3. Interaction requirements (A3)

- **Pilot selection is a short-list problem:** the base pushes only the
  **current group's pilots** (≤ 10 at MVP scale, D7) to the device; the
  Scorer picks from that list, never from the roster.
- **Confirmation is a deliberate physical action** (e.g. long-press), not a
  tap that can fire in a pocket — it feeds the pre-group confirmation guard
  and prep gate ([5.0](high-level-requirements.md#area-5--scoring)).
- **Confirmation is an exclusive claim, arbitrated by the base:** the gate's
  unit is the **pilot** (each group pilot needs exactly one confirming
  device), and the base **rejects a second device confirming an
  already-claimed pilot** — the rejecting device tells its Scorer "pilot
  already claimed" so they pick the right one. Re-selecting away frees the
  claim; the base's group view — displayed on a companion client
  ([companion-app.md §3.2](companion-app.md#32-run-control--contest-director-65)) —
  shows which device holds which pilot
  ([5.0](high-level-requirements.md#area-5--scoring)).
- **No-look operation for the time-critical path:** start/stop must be
  operable by feel with eyes on the model. Everything else (landing entry,
  flags) happens in calm moments between flights.
- The device **mirrors round / group / phase / countdown** from the base
  ([Area 6](high-level-requirements.md#area-6--display-timer--audio-field-aids)); see
  Section 7 for the staleness bound.
- A **mistyped value must be obvious at once and correctable on the device**
  while its group is still current — **up to the start of the next group**
  ([D11](decisions.md#d11--the-devices-scope-is-the-current-group)). After
  that, changes to a flown group's data are base-side score administration
  ([Area 5](high-level-requirements.md#area-5--scoring)) — the device only
  ever focuses on the current group.
- **Prototype the F3K multi-launch flow first** — the hardest task
  descriptor (see Open items).

---

## 4. Prep-gate vs an offline device (A1)

The prep confirmation gate ([5.0](high-level-requirements.md#area-5--scoring) /
[6.5](high-level-requirements.md#area-6--display-timer--audio-field-aids))
pauses the countdown at T−1:00 until every pilot has exactly one confirming
device (Section 3). An offline device
(D6) cannot deliver its confirmation, and *no confirmation received* must not
be conflated with *pilot cannot fly*.

**Requirements** *(owner-approved 2026-07-07; 6.5/5.7 amended accordingly)*:

1. The CD override splits in two:
   - **"Release gate — device offline":** no no-score; the device's buffered
     confirmation reconciles on sync (D6).
   - **"Release gate — pilot unconfirmed":** no-score, as today
     ([5.7](high-level-requirements.md#area-5--scoring)).
2. Every device shows a **sync-state indicator**, and the Base Station's
   group view shows each device's state, so the field can tell "offline"
   from "not confirmed" at a glance.
3. A **buffered confirmation reconciling on sync passes the same exclusive
   claim arbitration** (Section 3): if the pilot was claimed by another
   device in the meantime, the late confirmation is **rejected and surfaced
   on the group view**, not silently merged — the affected Scorer re-selects.

---

## 5. Sync and conflict policy (A2)

- Devices **buffer captures offline and sync on reconnect** (D6).
- **Never auto-resolve a conflict:** if the same pilot/flight ends up with
  two captures (e.g. base-side manual entry after a paper fallback, plus a
  late-syncing device), the event log (D4) records **both**, the conflict
  surfaces as an **anomaly in the CD validation pass**
  ([2.3](high-level-requirements.md#area-2--competition-lifecycle)), and a
  human picks. No timestamp-based last-writer-wins.
- **A re-flight result is not a conflict:** a re-flight gives the pilot a
  **second working-time result for the same round**
  ([5.3](high-level-requirements.md#area-5--scoring);
  [general-rules §7](rules/00-general-rules.md#7-re-flights-common-pattern)).
  The data model keeps *capture of a second working-time* distinct from
  *second capture of the same flight*: the former is stored as its own
  result and resolved by the scoring rules (better-of, or the re-flight
  itself for the entitled competitor); only the latter is conflict-flagged.
- **Captures for an annulled group run are not applied:** when a group run
  is aborted — by the CD (6.5) or because the base failed while it ran
  ([physical architecture §3](../architecture/physical-architecture.md)) —
  buffered captures from that run still sync in and are **event-logged, but
  not applied**; the re-run's captures are the live ones.
- **A late correction is rejected, not applied:** a buffered on-device
  correction that syncs after its group has closed
  ([D11](decisions.md#d11--the-devices-scope-is-the-current-group)) is
  **rejected and surfaced** (event-logged, visible on the group view) —
  applying it from there is base-side score administration, never a silent
  merge.

---

## 6. Transport and range (A4)

The requirement is a **range number, not a technology**: *(owner-confirmed
2026-07-07)* a scorer would typically **never be beyond 100 m from the base
station**, so the base↔device link must be **reliable at 100 m
line-of-sight outdoors**, with D6 tolerating fringe dropouts beyond that.

- **Proposed default:** Base Station as **Wi-Fi AP** (~50–100 m realistic
  outdoors, simplest firmware story) — note this sits at the **top of
  Wi-Fi's comfortable range**, so the field range test is the deciding
  evidence; **ESP-NOW** is the fallback if Wi-Fi can't hold 100 m reliably
  on the actual hardware. Decide **after a field range test** with the
  actual dev boards at a real site.

---

## 7. Countdown staleness bound (A6)

The mirrored countdown must be **within ±0.5 s of the base clock**
*(owner-tightened 2026-07-08 from the proposed ±1 s)*; when the
device cannot hold that, it **hides the countdown and shows its offline
indicator** (a 10 s-stale countdown is worse than none). The horn remains the
timing authority (D5) — no more precision than this is required.

The bound now also serves **scoring**, not just display: the per-flight
**start/stop timestamps**
([D9](decisions.md#d9--per-flight-timestamps-on-the-base-clock)) must hold
the same ±0.5 s against the base clock — including captures buffered offline
and reconciled on sync (D6) — and stamps that cannot be reconciled within it
are **flagged** for the CD validation pass, never presented as exact.

---

## 8. Fleet logistics (A5)

- **Ownership** *(owner-confirmed 2026-07-08)*: the **Organiser(s) own the
  Base Station and a communal pool of hand-held devices** — pre-built,
  **pre-bound to the base**, and ready to use at all times. A competitor is
  **never expected to provide their own device** at this stage (consistent
  with D2's no-BYOD).
- **Fleet size follows max group size, not pilot count:** at ≤ 20 pilots
  flying in groups, ~**10 devices + 2 spares**.
- **Full-day battery** (≈ 8 h active) and **overnight recharging of the whole
  fleet** at a two-day event (D7).
- Devices are **pre-bound to the base** (done once, at build time), so
  "join this contest" at the field reduces to power-on plus the base's
  competition-start push (§1) — no field-side pairing ceremony.
- **Firmware updates without internet** — the Base Station serves updates
  (consistent with D6).
- A **device health view**, computed by the base and displayed on a
  companion client ([companion-app.md §3.8](companion-app.md#38-fleet-support-scorer-devicemd-8)):
  battery level, sync state, firmware version, currently-selected pilot
  (also serves Section 4's indicator).

---

## 9. Environment envelope (D)

- **Daylight-readable display**; operable with **cold fingers**;
  **light-rain tolerance**.
- Base Station power at a field (generator/battery); after an unplanned
  reboot mid-contest the base **resumes into the correct contest state** from
  the event log (D4).

---

## Open items

The device is being **prototyped by a separate person**; this section is the
running list of everything still needing clarity, split by who owes the
answer. Resolve an item by writing the answer into the relevant section above
and striking it here.

### Needed from the owner

1. ~~Which discipline first?~~ — **resolved 2026-07-07**: no first
   discipline; the device is **descriptor-driven** (Section 1) — the base
   instructs it at competition start which class it services and what data
   to collect.
2. ~~Field layout / range figures~~ — **resolved 2026-07-07**: a scorer is
   typically never beyond **100 m** from the base station; the requirement
   is a reliable link at 100 m line-of-sight (Section 6).

*(All owner inputs are resolved; what remains is prototype validation.)*

### Needed from the device prototyper

Each proposed default above holds until a prototype finding overturns it;
findings feed back into this doc.

1. **Task-descriptor contract** (Section 1) — the base→device metadata
   format: which fields to collect, their precision/units, and the
   multi-flight shape, pushed at competition start. Firmware and base share
   this contract, so it needs defining **first**, jointly — **a derived
   draft to start from is in [Appendix A](#appendix-a--task-descriptor-derived-draft)**.
   *Prove:* one descriptor format can express every row of the §1 capture
   matrix.
2. **F3K multi-launch flow** (Sections 1, 3) — the hardest descriptor: many
   timed launches inside one working time, per-flight records,
   target-achieved Y/N. If the device handles F3K, everything else fits.
   *Prove:* a full task-F/G-style group can be captured no-look, records
   ordered and intact.
3. **No-look start/stop** (Section 3) — physical control operable by feel
   with eyes on the model. *Prove:* start/stop without looking, no
   accidental triggers in a hand or pocket.
4. **Long-press pilot confirmation** (Section 3) — deliberate action for the
   prep gate ([5.0](high-level-requirements.md#area-5--scoring)); short-list
   selection from the pushed group list. *Prove:* cannot fire accidentally;
   comfortable with cold fingers.
5. **On-device numeric entry** (Section 2) — landing tape readings, lap
   counting, and **F5 AMRT launch height** (owner-decided on-device,
   2026-07-08) on the round screen. *Prove:* multi-digit entry is
   comfortable at flight/group end. If it is, the base-side default for
   **poker/ladder target nomination** can be revisited too — until then
   that one stays base-side.
6. **Radio range test** (Section 6) — with the actual dev boards at a real
   site. *Prove:* reliable link at **100 m line-of-sight** (Wi-Fi AP first —
   it sits at the top of Wi-Fi's comfortable range, so this test is the
   deciding evidence; ESP-NOW if it falls short); confirm buffer-and-sync
   (D6) rides out fringe dropouts.
7. **Countdown mirror** (Section 7) — *prove:* mirrored countdown holds
   ±0.5 s of the base clock, and the device hides it and shows the offline
   indicator when it can't.
8. **Sync-state indicator** (Sections 4, 8) — visible at a glance on the
   device and reported to the base's device health view; the split CD gate
   release (owner-approved) depends on it being trustworthy.
9. **Battery & environment** (Sections 8, 9) — *prove:* ≈ 8 h active on a
   charge; readable in full daylight; usable with cold fingers; survives
   light rain.
10. **Pairing / join-this-contest** (Section 8) — devices are **pre-bound**
   to the Organiser's base at build time. *Prove:* a pre-bound device joins
   a contest at power-on with no field-side ceremony, and firmware can be
   updated from the Base Station without internet.
11. **Flight timestamps** (Sections 1, 7;
   [D9](decisions.md#d9--per-flight-timestamps-on-the-base-clock)) —
   *prove:* start/stop stamps hold ±0.5 s of the base clock, including
   flights captured while offline and reconciled on sync; unreconcilable
   stamps are flagged, not silent.

---

## Appendix A — Task descriptor: derived draft

A first cut of the base→device metadata (Open item 1), **derived from** the
requirements, user stories and rule docs. Illustrative, not final — the
contract is defined jointly with the prototyper; but every element below
traces to something already required, and the two worked examples show one
format expressing both the simplest and the hardest row of the §1 matrix.

**Derivation principle.** The descriptor is the **device-facing projection
of the [3.7](high-level-requirements.md#area-3--competition-setup--configuration)
task-rules configuration**: it is *generated from* what the Organiser
configures, never hand-authored, and it carries only the **collect** half of
3.7. The **score** half — points-per-second, landing-bonus tables, caps,
height deductions, which-flight-counts, normalisation — is deliberately
absent (the raw-capture principle, §1): a device that never sees the scoring
rules cannot pre-interpret with them.

### A.1 Competition-level (pushed at competition start)

| Element | Traces to |
|---|---|
| `competition` — id, name | 3.1 |
| `class` — F3B / F3J / F3K / F5J / F5K / F5L | 3.2 |
| `tasks[]` — one task descriptor per task type in use (single-task classes have exactly one; F3B three; F3K/F5K per catalogue selection) | 3.7; [rules/](rules/) task catalogues |

### A.2 Task descriptor (one per task type)

| Element | Meaning | Traces to |
|---|---|---|
| `id`, `name` | e.g. `f3k-E`, "Poker" | task catalogues ([f3k.md](rules/f3k.md), [f5k.md](rules/f5k.md), [f3b.md](rules/f3b.md)) |
| `working_time_s` | default; per-round override arrives with the group push (A.4) | 3.7 |
| `flights` | `{ mode: single \| multiple, max_launches: n \| unlimited }` — shapes the per-flight record list | §1 multi-flight principle; per-class matrix |
| `fields[]` | the per-flight capture fields — see A.3 | 5.2.1 story; §1 matrix |
| `event_flags[]` | observable occurrences the Scorer may flag — drawn from a **fixed system-wide enumeration** of task-integral penalty types (e.g. `land_out`, `model_contacts_person`); the descriptor selects the subset **appropriate to this task**, and derived conditions (over-time) are **not** in this list | 3.7 penalty/deduction types; 5.2.3 story |

### A.3 Field definition

Each entry in `fields[]`:

| Attribute | Values | Notes |
|---|---|---|
| `key` | `flight_time`, `landing_tape`, `laps`, `launch_height`, `target_nominated`, `target_achieved`, `landed_in_pilot_area`, … | one per §1 matrix cell — note there is **no launch-count key**: it is inferred from the flight numbers |
| `kind` | `stopwatch` \| `counter` \| `number` \| `flag` | the four capture widgets the descriptor-rendered engine needs (§1) |
| `unit`, `resolution` | e.g. `s @ 0.1` (F3J/F3K), `s @ 1` (F5x, F3B-A), `m @ 1` (AMRT); the landing tape has **no unit** — it is a raw point reading the system maps per task | 3.7 timing precision; [general-rules §2](rules/00-general-rules.md#2-data-the-timer--helper-collects) |
| `scope` | `per_flight` \| `per_group` | multi-flight principle |
| `entry` | `device` \| `base` | the §2 split — target nomination is `base` (AMRT height moved on-device 2026-07-08); the device may *display* a base-entered value but never collects it |
| `required` | whether a flight record is complete without it — **fields are nullable**; this is how the metadata says which are mandatory for the group's task | round-completeness gate (Area 5) |

> Every per-flight record also carries **automatic start/stop timestamps on
> the base clock**
> ([D9](decisions.md#d9--per-flight-timestamps-on-the-base-clock)) —
> firmware-stamped record metadata, not a `fields[]` entry, so the
> descriptor does not list them.

### A.4 Per-group push (companion runtime state, not the descriptor)

Round number, group number, **task reference for this round** with any
per-round working-time override (3.7), the **pilot short-list** (id, name,
pilot number — §3), the prep-gate state, and the mirrored phase/countdown
stream (§7). Traces to 5.0 and Area 6.

### A.5 Worked examples *(illustrative sketch)*

The simplest row (F5J) and the hardest (F3K Poker):

```
task f5j-duration:
  working_time_s: 600
  flights: { mode: single }
  fields:
    - { key: flight_time,   kind: stopwatch, unit: s, resolution: 1,
        scope: per_flight, entry: device, required: true }
    - { key: launch_height, kind: number,    unit: m, resolution: 1,
        scope: per_flight, entry: device, required: true }
    - { key: landing_tape,  kind: number,    # raw point reading, no unit
        scope: per_flight, entry: device, required: false }
  event_flags: [land_out, model_contacts_person]

task f3k-E-poker:
  working_time_s: 600
  flights: { mode: multiple, max_launches: unlimited }
  fields:
    - { key: flight_time,      kind: stopwatch, unit: s, resolution: 0.1,
        scope: per_flight, entry: device, required: true }
    - { key: target_nominated, kind: number,    unit: s, resolution: 1,
        scope: per_flight, entry: base,   required: true }
    - { key: target_achieved,  kind: flag,
        scope: per_flight, entry: device, required: true }
  event_flags: [model_contacts_person]
```

Note what is *absent* from `f3k-E-poker`: nothing says "up to 3 targets,
only achieved targets count, summed" — that is the scoring rule
([f3k.md](rules/f3k.md) Task E), applied by the system to the raw records.

### A.6 Deliberately excluded (system-side only)

Points-per-second, landing-bonus tables, launch-height deduction/bonus
maths, flight-time caps, which-flight-counts selection, drop-worst,
normalisation, penalties arithmetic — all of [rules/](rules/) scoring. The
device collects; the system interprets (§1, raw-capture principle).

## Appendix B — Per-class deduction/penalty classification *(derived 2026-07-08)*

Derived from the [rule digests](rules/) to pin down the descriptor
contract's event-flag set (Open item 1). Every task-integral deduction or
zeroing condition in the six classes, classified three ways:

- **Scorer event-flag** — observed at the line; needs a device quick-flag.
- **System-derived** — computed by the base from raw captures (timestamps
  D9, AMRT heights, launch counts) plus configuration; **no** Scorer action.
- **CD-imposed** — administrative penalties entered base-side under
  [5.9](high-level-requirements.md#area-5--scoring) / manual entry; never on
  the device.

Items marked *(borderline)* are judgement calls on who realistically
observes the event — confirm with the owner before the descriptor freeze.

| Class | Event / condition | Effect | Classification |
|---|---|---|---|
| all | CD penalties for infringements, dangerous flying, cheating (up to DSQ) | per 5.9 | CD-imposed |
| all | Land-out (model at rest off the defined area) → flight/bonus zeroed | 0 flight or 0 bonus per class | Scorer event-flag (existing `land_out`) |
| all | Model contacts a person | per class (−1000 / 0 round …) | Scorer event-flag (existing `model_contacts_person`); CD validates severity |
| F3J | Overfly ≤ 1 min −30; > 1 min 0; any overfly kills landing bonus | per digest | System-derived (D9) |
| F3J | Towline not cleared within 30 s | −100 | Scorer event-flag *(borderline — may be a line official's call)* |
| F3J | Non-conforming winch; unauthorised transmission | −1000; −300 | CD-imposed |
| F3B A | Time over 600 s −1 pt/s; > 630 s kills landing bonus | per digest | System-derived (D9) |
| F3B B/C | Task B partial legs; Task C incomplete/early landing → 0 | per digest | Base-side manual entry — Tasks B/C are **manual-run** (D10), Task C course-judged, not the shoulder Scorer |
| F3B C | Safety-plane crossing | −300 | Base-side (course judges) → CD-imposed path |
| F3B | Non-conforming winch | −1000 | CD-imposed |
| F3K | Launch before working time → that flight 0 | per digest | System-derived (D9 — named in the decision) |
| F3K | Scored time capped at task target/max | cap | System-derived (descriptor `cap`) |
| F3K | Flying outside the assigned window | −100 | Scorer event-flag *(borderline — airspace call)* |
| F3K | Unsigned score card → round 0 | waived | N/A — consciously waived (D1) |
| F5J | Wrong launch direction; motor before signal; launch not straight 3 s | −100 each | Scorer event-flag *(borderline — launch-marshal territory; MVP has only the shoulder Scorer)* |
| F5J | Launch outside ±2 m corridor → flight 0 | 0 | Scorer event-flag |
| F5J | Motor runs past the 30 s motor-run period → flight 0 | 0 | Scorer event-flag *(borderline — AMRT data may show it)* |
| F5J | AMRT records no start height → flight 0 | 0 | System-derived (missing AMRT capture) |
| F5J | Overfly > 1 min → 0; any overfly kills landing bonus | per digest | System-derived (D9) |
| F5J | Start-height deduction (0.5 / 3 pt per m) | deduction | System-derived (captured AMRT height) |
| F5K | Overfly landing window | −100 | System-derived (D9) |
| F5K | Motor restart in flight → flight 0 | 0 | Scorer event-flag |
| F5K | Landing outside Pilot Area (on field) | −10 per landing | Scorer event-flag |
| F5K | 2nd/3rd-launch penalties (Tasks B/E) | −10/−20/−30 | System-derived (launch count from flight records) |
| F5K | NLH launch bonus/penalty (+0.5 / −1 / −3 per m); no bonus < 30 s | per digest | System-derived (AMRT height + NLH config, 3.7) |
| F5K | Safety-zone infringement | −300 | CD-imposed |
| F5K | Hits anyone but self/timer → round 0 | 0 round | Scorer event-flag (`model_contacts_person`) + CD validation |
| F5L | Overfly > 30 s → whole task 0; time past 390 s deducted back | per digest | System-derived (D9 + cap) |
| F5L | Landing outside area → flight 0 | 0 | Scorer event-flag (`land_out`) |
| F5L | Model touches pilot/helper at landing; touched before measuring; lost part → landing 0 | 0 bonus | Scorer event-flag (one flag: `landing_invalid`, reason picked in a calm moment) |
| F5L | AMRT presets wrong (≠ 30 s / 90 m) → flight 0 | 0 | Base-side equipment check → CD-imposed path |
| F5L | Helper-timed fallback deviation > 3 s → flight 0 | waived | N/A — the device is the official time (D1/D2 waiver) |

**Descriptor impact:** the Scorer event-flag column defines the complete
per-class `flags[]` set for the task descriptor (A.3) — beyond the two
worked-example flags (`land_out`, `model_contacts_person`) it adds, at
most: F3J `towline_not_cleared`, F3K `outside_window`, F5J
`launch_infringement` (one flag, reason coded), `motor_overrun`, F5K
`motor_restart`, `outside_pilot_area`, F5L `landing_invalid`. Everything
else is system-side arithmetic (A.6) or base-side administration.
