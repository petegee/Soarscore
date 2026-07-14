# [STORY-001-036] Capture and Correct a Live Score Entry

> Source: `docs/user-stories/03-scorer.md` §5.1.1, 5.1.2 ·
> `docs/requirements/high-level-requirements.md` Area 5.1 ·
> `docs/requirements/decisions.md` D2 (stopwatch-grade operation), D6
> (offline-first), D11 (device scope is the current group) ·
> `docs/requirements/scorer-device.md` §5 (sync and conflict policy) ·
> relates to STORY-001-034 (confirmation guard this entry depends on)
> Module: 001 (Organiser MVP) · Estimated effort: **3 days**

### Background

Once a Scorer's device is confirmed for a pilot (STORY-001-034), this story
delivers the actual capture: recording the flight result live, with immediate
on-device confirmation that it landed against the right competitor, no paper
cards and no later transcription. Capture must work **no-look, stopwatch-grade**
— minimal, deliberate interactions, sensible defaults — because the Scorer's
eyes belong on the flight, not the screen.

Mistakes happen. A Scorer may correct a value they captured for their own pilot,
but only while its group is still current — the window closes at the **start of
the next group** (D11). After that, the value is no longer Scorer-editable from
the device; any further change is mid-contest score administration elsewhere.
A correction buffered offline that only reaches the base after its group has
closed must be rejected, not silently applied.

### Business Value

- Capture happens in the moment, eliminating paper cards and later
  transcription error.
- Immediate on-device confirmation catches a mistyped value while it is still
  obvious, not after the fact.
- A bounded self-correction window lets a Scorer fix their own slip without
  Organiser involvement, while keeping the record trustworthy once a group is
  behind them.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-034 — a confirmed competitor and a cleared guard
  are a precondition for any capture.
- **Data assumptions**: an entry always carries the confirmed competitor, round
  and group supplied by the base station; "the next group has started" is an
  observable base-station fact the device can check a correction against.
- **Integration points**: a correction buffered offline that surfaces after its
  group has closed is rejected by the base and the rejection is surfaced to the
  Scorer, not silently applied (scorer-device.md §5); once the window closes,
  further changes become mid-contest score administration or the Contest
  Director's end-of-contest validation (both out of scope here, not yet their
  own stories).
- **Business constraints**: offline-first (D6) — captures buffer locally and
  reflect their acceptance status once synced; no-look, stopwatch-grade
  operation (D2) — minimal deliberate interactions only.

### Scope In

- Live capture of a metric against the confirmed competitor, round and group.
- Immediate, on-device confirmation naming the competitor the value landed
  against.
- Buffering a capture when the link is briefly unavailable, and reflecting
  whether it has since been accepted upstream.
- Self-correcting a value for the **current** group, up to the start of the
  next group.
- Rejecting a correction that reaches the base after its group has closed,
  including one buffered while offline.

### Scope Out

- The confirmation guard and pilot binding that gates entry —
  STORY-001-034.
- Which specific metrics a task calls for and how inputs are laid out —
  STORY-001-039.
- Mid-contest score administration after the correction window closes, and the
  Contest Director's end-of-contest validation pass — future stories (Area
  5.3/5.4, 5.8).

### Acceptance Criteria

#### AC1: A capture lands against the confirmed competitor
**Given** John Brown is confirmed for round 4 group 2 and the guard is cleared
**When** I capture his flight time during working time
**Then** it is recorded live against John Brown, round 4, group 2, and sent to
the base station.

#### AC2: Immediate confirmation names the competitor
**Given** I have just captured a value
**When** it is recorded
**Then** the device immediately shows it back together with John Brown's name,
so I never have to assume whose result it landed against.

#### AC3: A brief link outage does not lose a capture
**Given** the link to the base station is briefly unavailable
**When** I capture a value
**Then** the device retains it and shows whether it has since been accepted
upstream, rather than discarding it silently.

#### AC4: I can correct a value while the group is still current
**Given** I entered 187 seconds for John Brown's flight time in round 4 group
2, which is still the current group
**When** I notice it should have been 178 seconds and correct it
**Then** the value updates to 178 seconds, still against John Brown, round 4,
group 2 unchanged.

#### AC5: The correction window closes at the next group's start
**Given** round 4 group 3 has now started
**When** I try to correct a value I captured for round 4 group 2
**Then** my device no longer offers that edit — the change is no longer mine to
make from this device.

#### AC6: A late correction buffered offline is rejected, not silently applied
**Given** I corrected a value for round 4 group 2 while offline, and group 3
started before my device reconnected
**When** my device syncs the buffered correction
**Then** the base rejects it and surfaces the rejection to me, rather than
silently applying a correction to a group that has closed.

#### Non-Functional Expectations
- Capture requires minimal, deliberate interaction — a physical start/stop
  operable by feel — so a Scorer's eyes stay on the flight, not the screen.

### INVEST Check

Independent (capture and its bounded self-correction, layered on an already
confirmed device) · Valuable (live, transcription-free capture with an honest,
bounded correction path) · Small (3 days, 2 functional points: live
capture + immediate confirmation, correction window + offline rejection) ·
Testable (capture attribution, the confirmation echo, and the correction
window's open/closed boundary are all directly observable).
