# [STORY-001-032] Run-Control Authority over a Running Group

> Source: `docs/user-stories/02-contest-director.md` §6.5 ·
> `docs/requirements/high-level-requirements.md` Area 6.5, Area 6.4 (round
> advance) · `docs/requirements/decisions.md` D1 (authority recorded, not
> enforced), D4 (immutable event log), D10 (operator-driven progression) ·
> `docs/requirements/rules/00-general-rules.md` §1–2 · `scorer-device.md` §4
> (prep gate vs offline device), `companion-app.md` §3.2 · relates to
> STORY-001-031 (no-score), STORY-001-028 (re-flight entitlement),
> STORY-001-026 (Lock validation pass)
> Module: 001 (Organiser MVP) · Estimated effort: **5 days**

### Background

The **operational** running of a group's clock, callouts and board is the
Announcer/Timekeeper's (Area 6.1–6.4). This story delivers the Contest Director's
**authority slice** over a running group: the holds and overrides only they may
apply. At a small contest one person may hold both hats, but the authority
actions here are the Director's, recorded as such.

The authority is deliberately bounded. It reaches **preparation** freely — the
Contest Director can **pause** prep (holding the countdown until they resume),
**fast-forward** it (each invocation removes one minute, but never below one
minute remaining) and **add time** (each invocation adds one minute) — but it may
**not** pause or shorten **working time or the landing window**, which run to
their configured durations. The one control that reaches into a running working
time is **abort**: a range hold or disruption lets the Contest Director abort the
group, which **restarts from preparation** and **annuls** any times/metrics —
raw captures **and** any facts derived from them (e.g. a resolved lone-pilot
dummy, a requested annulment override) — already recorded for that group; a
re-flight of the group starts completely clean. Abort applies **only while the
group is in working time**; once the **landing window** begins (the touchdown
phase per D5/D9), abort no longer applies and the flight runs to touchdown as
normal.

Two further authorities sit here. First, the **prep confirmation gate** (5.0.4)
is a single **group-level** hold — it pauses the countdown at one minute
whenever **any** pilot's device has not confirmed, and only releases once
**every** pilot's device has; one unconfirmed device holds the whole group's
start. For each device still blocking it, the Contest Director releases in one
of **two distinct forms** — **"device offline"** (the blocking device shows
offline on the base's group view via the companion client; the group proceeds
with **no no-score**, and the device's buffered confirmation reconciles on
sync) or **"pilot unconfirmed"** (device online, no confirmation; the group
proceeds and that pilot takes a **no-score**, STORY-001-031). The system never
converts a comms fault into a no-score on its own; the choice is the
Director's and is recorded, per blocking device. Second, the **"advance
anyway" override**: where the system has **blocked** a round advance (Area 6.4
— missing scores, unresolved no-scores or a re-flight entitlement not yet
flown, whether merely **prepared** or already **approved**), only the Contest
Director may force it through, with defined consequences — missing scores
become **flagged anomalies** for the end-of-contest validation pass
(STORY-001-026), unresolved no-scores convert to **zeros** (STORY-001-031),
and any not-yet-flown re-flight entitlement — prepared or approved — **lapses**
(the original result stands, flagged). Every action is attributable (D1/D4).

### Business Value

- Provide the Contest Director with the authority to keep the event moving —
  holding and adjusting preparation, resolving stuck confirmation gates, aborting
  a spoiled group — without breaching the fixed working-time and landing-window
  durations.
- Support an honest handling of comms faults: a device-offline hold is never
  silently turned into a pilot's no-score.
- Enable progress past a genuinely blocked round advance under explicit,
  attributable authority, with each outstanding item routed to a defined,
  recorded consequence.

### Dependencies and Assumptions

- **Prerequisites**: the Area 6 group run and phase timer (Announcer/Timekeeper —
  STORY-001-011 and Area 6 stories), the prep confirmation guard (5.0.4), the
  round-advance gate (Area 6.4), STORY-001-031 (no-score state), STORY-001-028
  (re-flight entitlement), STORY-001-026 (the end-of-contest validation pass that
  flagged anomalies feed).
- **Data assumptions**: a device's sync-state (online/offline) is shown on the
  base's group view via the companion client (companion-app §3.2); actor identity
  arrives with the request and Contest-Director authority is **recorded, not
  enforced** (D1); prep vs working-time vs landing-window phase is known from the
  running group.
- **Integration points**: pause/fast-forward/add-time act on the Area 6 prep
  timer; abort resets the group to preparation and discards its captures; the
  prep-gate release interacts with the offline device's buffered confirmation
  (scorer-device §4); "advance anyway" drives the no-score→zero (STORY-001-031),
  re-flight-lapse (STORY-001-028) and flagged-anomaly (STORY-001-026) outcomes.
- **Business constraints**: working time and the landing window are fixed
  durations, not the Director's to pause/shorten; operator-driven progression
  (D10); offline-first (D6); class-agnostic core (CLAUDE.md).

### Scope In

- **Preparation holds**: pause/resume the prep countdown; fast-forward (−1 minute
  per invocation, never below one minute remaining); add time (+1 minute per
  invocation) — all on **preparation only**.
- **The fixed-duration guard**: the Contest Director **cannot** pause or shorten
  working time or the landing window.
- **Abort**: abort a group during **working time only** (not once the landing
  window has begun) on a range hold/disruption — it restarts from preparation
  and annuls **both** raw times/metrics **and** any derived scoring facts
  (e.g. lone-pilot resolution, annulment-override requests) already recorded
  for the group; a re-flight starts clean.
- **Prep-gate release, a single group-level hold, two distinct release forms
  per blocking device**: **"device offline"** → group proceeds with **no**
  no-score (buffered confirmation reconciles on sync); **"pilot unconfirmed"**
  → group proceeds and that pilot takes a **no-score**. The gate only clears
  once every blocking device is confirmed or released. The system never
  auto-converts a comms fault to a no-score; the chosen form and the
  pilots/devices involved are recorded.
- **"Advance anyway" override** of a blocked round advance: missing scores →
  flagged anomalies for the end-of-contest validation pass; unresolved no-scores
  → zeros; any not-yet-flown re-flight entitlement — whether merely **prepared**
  or already **approved** — → lapses (original result stands, flagged). Only
  the Contest Director may issue it; it is attributed to them.
- **Audit**: every run-control authority action is attributable to the Contest
  Director (D1/D4).

### Scope Out

- **The operational start/hold of the clock, callouts and the board** — the
  Announcer/Timekeeper (Area 6.1–6.4); these authority actions are distinct from
  operating the timer.
- **The prep gate's non-Director release paths** — all Scorers confirm, or a
  Scorer marks *cannot make the group* (5.0.4); only the Director **override** is
  here.
- **What a no-score then does** (resolve via move/retire, end-of-round zero) —
  STORY-001-031; this story only *creates* a no-score via "pilot unconfirmed" and
  *converts* unresolved ones via "advance anyway".
- **The end-of-contest validation pass and Lock** that flagged anomalies feed —
  STORY-001-026.
- **The phase timer and phase sequencing** themselves (prep → working → landing) —
  Area 6 stories; this story acts on that timer's prep phase only.
- Enforcing that only a Contest Director may take these actions (authority
  recorded, not enforced, D1).

### Acceptance Criteria

#### AC1: Prep can be paused/resumed; working time and landing cannot
**Given** a group in **preparation**
**When** the Contest Director pauses it, **then** the countdown holds until they
resume; **and given** the same group later in **working time** or the **landing
window**, **when** a pause is attempted, **then** it is refused because those run
to their configured durations.

#### AC2: Fast-forward removes a minute but never below one minute remaining
**Given** a group in preparation with 4 minutes remaining and everyone ready
**When** the Contest Director fast-forwards
**Then** each invocation removes one minute (4 → 3 → 2 → 1), and a further
fast-forward at one minute remaining is refused — the countdown never drops below
one minute.

#### AC3: Add-time adds a minute to preparation
**Given** a competitor is not ready with the prep countdown running
**When** the Contest Director adds time
**Then** each invocation adds one minute to the preparation countdown.

#### AC4: A device-offline gate release applies no no-score
**Given** the prep gate has paused at one minute because one pilot's device shows
**offline** on the base's group view
**When** the Contest Director releases the gate as **"device offline"**
**Then** the group proceeds with **no** no-score for that pilot, and the device's
buffered confirmation reconciles when it next syncs (scorer-device §4).

#### AC5: A pilot-unconfirmed gate release applies a no-score
**Given** the prep gate is held because a pilot's device is **online** but has not
confirmed
**When** the Contest Director releases the gate as **"pilot unconfirmed"**
**Then** the group proceeds and that pilot takes a **no-score** (STORY-001-031);
the two release forms are distinct actions and the chosen form (with the
pilots/devices involved) is recorded — the system never converts a comms fault to
a no-score on its own.

#### AC6: Abort (working time only) restarts from preparation and annuls all captured data, raw and derived
**Given** a range hold mid-**working-time** with some times/metrics already
captured for the group, including a derived scoring fact (e.g. a resolved
lone-pilot dummy)
**When** the Contest Director aborts the group
**Then** it restarts from **preparation** and the group's already-captured
raw times/metrics **and** any derived scoring facts are **annulled**, so a
re-flight starts clean; **and given** the same group has already progressed
into the **landing window**, **when** an abort is attempted, **then** it is
refused — abort applies only during working time, and the flight runs to
touchdown as normal.

#### AC7: "Advance anyway" routes each blocked item to its defined consequence
**Given** a round advance the system has **blocked** because it lists a missing
score, an unresolved no-score and a re-flight entitlement not yet flown (Area
6.4) — whether that entitlement is merely **prepared** or already **approved**
**When** the Contest Director issues an explicit **"advance anyway"** override
**Then** the advance proceeds — the missing score becomes a **flagged anomaly**
for the end-of-contest validation pass (STORY-001-026), the unresolved no-score
converts to a **zero** (STORY-001-031), the not-yet-flown re-flight entitlement
**lapses** (prepared or approved alike) with the original result standing
(flagged) — and the override is attributed to the Contest Director; no other
role can issue it.

#### Non-Functional Expectations
- Run-control authority actions carry no knowledge of any specific competition
  class (CLAUDE.md class-model law) and operate on the base offline (D6).
- Working time and the landing window are never shortened or paused by any
  authority action — only preparation is adjustable, and only abort reaches a
  running **working time** (and only by discarding it); abort does not apply
  once the landing window has begun.
- The prep-confirmation gate is a single group-level hold: it clears only
  when every pilot's device has confirmed or been released by the Contest
  Director; one outstanding device holds the whole group's start.

### INVEST Check

Independent (an authority slice over the Area 6 group run and the Area 6.4 advance
gate) · Valuable (keeps the event moving and resolves real-world holds without
breaching fixed durations, and never silently turns a comms fault into a no-score)
· At the size limit (5 days, 3 functional points: prep holds + fixed-duration
guard + abort, the two-form prep-gate release, the "advance anyway" override) ·
Testable (each hold, each release form, abort's data annulment and each override
consequence are observable).
