# Soarscore — Recorded Decisions

Durable, cross-cutting decisions that shape the requirements but are not
derivable from the rule docs or the area index. Each is a settled position —
revisit deliberately, don't re-litigate session by session. Decided
**2026-07-07** with the project owner.

---

## D1 — Trust model: small, known, trusted group

The system is intended, initially, for local use in New Zealand among a small
group of well-known, well-trusted individuals, and operates on individual
integrity and honesty. There is no intention at this stage to allow other
groups access.

**Consequences**
- No user authentication, no Scorer identity capture, and no physical or
  electronic score sign-off in the MVP.
- The FAI signed-score-card rule
  ([general-rules §2](rules/00-general-rules.md#2-data-the-timer--helper-collects)
  — an unsigned card scores zero in classes that require it) is **consciously
  waived**: these are club-level contests, not FAI-sanctioned events. This is
  a scoping decision recorded here — the rule docs are unchanged, per the
  house-keeping rules.
- Auditability comes from the event log ([D4](#d4--immutable-event-log)), not
  from signatures.

## D2 — Scorer device: dedicated ESP32 stopwatch-style handheld

Scorer hand-held devices are **ESP32 dev-board, round stopwatch-type devices
running custom firmware** (to be developed and integrated as part of this
project). No other devices are catered for or permitted — no BYOD phones or
tablets. **The Scorer's device is the stopwatch** — flight timing is performed
on the device itself, not transcribed from a separate watch.

**Consequences**
- The Scorer-device interaction model must fit a small round display with
  no-look, stopwatch-style operation — not a phone-style touch UI
  ([users.md §3](users.md#3-scorer)).
- A hardware/firmware requirements document for the device is needed (see
  `blindspots-report.md` at the repo root).

## D3 — Failure policy: pen and paper, reconcile at the base

At **any point of system failure**, the field reverts to **pen and paper**;
results are manually entered into the Base Station afterwards to compute final
standings and reports. At the end of the contest the Contest Director (or
Organiser under CD authority) **validates the entered scores**, manually enters
missing scores, and overrides entered scores known to be incorrect.

**Consequences**
- Base-station **manual score entry** is a first-class MVP path
  ([5.8](high-level-requirements.md#area-5--scoring)).
- Blank **scoring sheets must be printable in advance** of any round, as the
  standing fallback kit ([7.3](high-level-requirements.md#area-7--reports)).
- A **CD end-of-contest validation pass gates Lock**
  ([2.2](high-level-requirements.md#area-2--competition-lifecycle)).

## D4 — Immutable event log

The system records **all mutations as an immutable, write-only log of events**,
so it is always possible to know what happened, when, and how the contest
evolved. This is the MVP's auditability mechanism (in place of sign-off, D1)
and its dispute/debugging record. Current state must be derivable from the
log. This constrains the domain-model design and should be decided together
with the flexible task-model NFR (`todos.md`, Non-Functional).

## D5 — End of working time does not stop the device stopwatch

There is **no requirement for the end of working time to stop the hand-held
stopwatch devices** — the Scorer stops timing on the horn sound
([6.2](high-level-requirements.md#area-6--display-timer--audio-field-aids)).
The horn, by ear, is the field authority for end of working time.

**Consequences**
- [6.1](high-level-requirements.md#area-6--display-timer--audio-field-aids) no
  longer auto-stops flight timing.
- Class rules still cap countable flight time at the end of working time, so
  the Base Station **flags any captured time exceeding the working time as an
  anomaly** for the CD validation pass (D3) rather than silently clamping it.

## D6 — Offline-first; buffer and sync; publish when connected

The system must run **entirely offline from the internet**, but be able to
**publish results when internet connectivity is available** (publishing
channel to be defined later). Hand-held devices that lose sync with the Base
Station **continue to capture data/scores/metrics and sync when the link
returns**. A live-scoring public web page for real-time contest progress is a
**future enhancement**, not MVP.

**Consequences**
- No MVP feature may depend on internet connectivity.
- Device↔base sync needs a conflict policy (open — see
  `blindspots-report.md`).

## D7 — Scale bounds and multi-day operation

A typical event is **single-day or two-day**, with **up to 20 pilots** and
**up to ~8 rounds per day**. Two-day events are routine, so **suspend at end
of day / resume next day is MVP scope**
([2.3](high-level-requirements.md#area-2--competition-lifecycle)). These
bounds size everything: device fleet ≈ max group size plus spares, report
volumes are small, draw computation is trivial at this scale.

## D8 — Physical shape: headless authoritative base, companion laptop

*(Decided 2026-07-08.)* The Base Station is a **headless embedded controller
at the flight line** that owns all contest state, the event log (D4), the
shared clock and the radio; the **field board and loudspeakers are wired to
it** (so the horn — the timing authority, D5 — can never be stale); the
**master laptop runs a companion app as a detachable client** holding no
state; **pilots' phones** may read an **MVP-optional, strictly read-only
draw/standings web page** served by the base over local Wi-Fi — no native
app. Full detail and implications:
[physical architecture](../architecture/physical-architecture.md).

**Consequences**
- A running group survives the laptop leaving, sleeping or failing; but
  run-control and round advance need a connected operator client.
- Pilot-phone and laptop traffic must not be able to degrade the
  scorer-device link.
- The base is a deliberate single point of failure — D3 is the answer.
