# Competition Rules — Generally Applicable (all contest types)

**Parent document.** Distils the rules that are common to **F3B, F3J, F3K, F5J,
F5K, F5L** and drive the scoring/running software. Child documents
([F3 general](f3-general-rules.md), [F5 general](f5-general-rules.md), and the
per-class docs) reference this file where a rule is common, and state only their
differences.

**Scope.** Only material that the competition-management software must act on:
how pilots are assigned to groups (the draw), what a timer/helper records (and to
what precision), and how group / round / final scores are computed. Construction,
wingspan, wind limits, flying-site geometry, roles and re-flight mechanics are out
of scope.

**Sources.** FAI Sporting Code Section 4: *CIAM General Rules* (2026, refs `C.x`);
*Volume F3 Soaring* (2025 v2, refs `F3x.x`); *Volume F5 Electric* (2026 ed.2, refs
`5.5.x`). The truly cross-class rules below come from the CIAM General Rules; there
is **no** single shared scoring chapter — each class restates its own scoring, so
the per-class docs are authoritative on numbers.

---

## 1. Pilot assignment to groups (the draw)

Common structure across all six classes:

- A contest is a sequence of **qualifying rounds**. Each round is subdivided into
  **groups** (a.k.a. flight groups / heats). All pilots in a group fly a shared
  **working time** and are scored against each other ("man-on-man").
- **Initial starting order** is set by a **random draw before the contest**
  (`C.16.2.6`). For most classes, frequency must *not* follow frequency in the
  order; **F3B, F3J and F3K are the exception** — they are grouped *by* frequency
  to maximise simultaneous flights.
- **Group composition changes every round**, arranged so that any two pilots meet
  as few times as possible (a matrix/anti-repeat draw).
- **Team separation:** as far as possible no two members of the same team/nation
  fly in the same group; for F3B/F3J/F3K same-team pilots should also not be drawn
  into the *immediately following* group (`C.16.2.6`).
- **Frequency assignment:** unless a class allows more, each competitor is allotted
  **one** frequency for the contest (`C.16.2.4c`). Spread-spectrum (2.4 GHz)
  transmitters are not impounded and need no frequency management (`C.16.2.3`).
- **Preparation time** precedes each group's working time (typically 5 minutes).
- **Fly-offs:** most classes finish with a fly-off flown as a single group of the
  top qualifiers (composition and size are per-class).

Per-class specifics (group size, matrix rules, fly-off cut, frequency count) live
in the per-class docs.

---

## 2. Data the timer / helper collects

Common to every class (precision and extra fields are per-class):

| Field | Notes |
|---|---|
| **Flight time** | Timed from launch/release to first ground contact or end of working time. **Precision differs by class** — see child docs (F3J/F3K = 0.1 s; F5J/F5K/F5L and F3B-duration = whole seconds; F3B-speed = 1/100 s). |
| **Landing result** | Distance from model nose (at rest) to the allocated landing spot, converted to bonus points via a table. Not used by all tasks (e.g. F3K, F5K score flight time only). |
| **Number of flights / launches** | For multi-task classes (F3K, F5K) and last-flight tasks: how many launches were made and which flight(s) count. |
| **Target-time calls** | For Poker/ladder tasks: the target time the pilot nominates before each launch, and whether it was achieved. |
| **Launch / start height** | **F5 only** — recorded by the on-board AMRT (whole metres). F3 classes capture no launch height. |
| **Penalties / infringements** | Listed on the score sheet of the round in which they occurred; cumulative; deducted from the **final** score. |

- **Timekeeping equipment:** quartz electronic stopwatch or a system of equal/greater
  accuracy, unless a class specifies otherwise (`C.16.1 k`).
- **Score card sign-off:** the competitor and timekeeper sign the round result; the
  signed card is the authoritative record (explicit in F3K/F5K/F5L; general practice
  elsewhere). An unsigned card scores zero for the round in classes that require it.

---

## 3. Group score (normalisation)

The universal principle: within each group the **best raw result is worth 1000
points**, and everyone else is scaled to it.

```
normalised score = (competitor's raw score / group winner's raw score) × 1000
```

- "Raw score" is the class-specific total (flight points ± landing ± launch-height ±
  penalties). Where **lower is better** (speed tasks), the ratio is inverted
  (`winner / competitor`).
- **F3B is the exception**: it normalises each of its three tasks *separately* into
  a partial score, rather than producing one group score — see [f3b.md](f3b.md).
- Rounding of the normalised score differs by class (whole points, 0.1 point, etc.).

---

## 4. Round score

For the man-on-man classes (F3J, F3K, F5J, F5K, F5L) the **round score = the
normalised group score** for that round. For **F3B** the round score is the **sum of
the three per-task partial scores** (Duration + Distance + Speed).

---

## 5. Final classification (common)

- **Aggregate** = sum of the competitor's round scores.
- **Drop-worst:** once more than a class-specific number of rounds is flown, the
  lowest-scoring round is discarded (threshold and unit — round vs task — are
  per-class; F3J qualifying has *no* discard).
- **Penalties** are deducted from the final aggregate and are **retained even if the
  round they occurred in is dropped**.
- **Fly-off:** where flown, final placing among qualifiers is determined by fly-off
  aggregate alone; qualifying scores break fly-off ties.
- **Team classification** (`C.15.6.2`): add the final scores of the three best team
  members. Tie → team with the lower sum of place numbers (three best, from the top);
  if still equal, the best individual placing decides.
- **Results output** must be presented in final-classification order, winner first
  (`C.13.7 h`), and each round's results displayed as the contest proceeds
  (`C.16.1 g`).

---

## 6. Penalties (common)

- The Contest Director may impose penalties up to disqualification for rule
  infringements, dangerous flying, cheating or unsporting behaviour (`C.19.1`).
- Point penalties defined by a class are recorded per round, are cumulative, and are
  subtracted from the final score. A score that would go negative is recorded as
  **zero** (penalties still stand).

---

## Source references

Deep-links into the verbatim extracted rule text (see [source-docs/](source-docs/)). The official FAI PDFs remain authoritative.

- Draw / starting order: [CIAM General Rules C.16.2.6](source-docs/ciam-general-rules-2026.md#c1626-starting-order)
- Frequency & transmitter control: [CIAM General Rules C.16.2](source-docs/ciam-general-rules-2026.md#c162-requirements-for-radio-control)
- Timekeeping, results display: [CIAM General Rules C.16.1](source-docs/ciam-general-rules-2026.md#c161-general-requirements)
- Publishing results: [CIAM General Rules C.13.7](source-docs/ciam-general-rules-2026.md#c137-results-of-international-events)
- Team classification: [CIAM General Rules C.15.6.2](source-docs/ciam-general-rules-2026.md#c1562-national-team-classification)
- Penalties: [CIAM General Rules C.19.1](source-docs/ciam-general-rules-2026.md#c191-penalties-imposed-by-the-contest-director)
