# Competition Rules — Generally Applicable (all contest types)

**Parent document.** Distils the rules that are common to **F3B, F3J, F3K, F5J,
F5K, F5L** and drive the scoring/running software. Child documents
([F3 general](f3-general-rules.md), [F5 general](f5-general-rules.md), and the
per-class docs) reference this file where a rule is common, and state only their
differences.

**Scope.** Only material that the competition-management software must act on:
how pilots are assigned to groups (the draw), what a timer/helper records (and to
what precision), how group / round / final scores are computed, and how
**re-flights** are granted, placed and scored (§7). Construction, wingspan, wind
limits, flying-site geometry and roles are out of scope.

> **MVP scope note.** The MVP is **individual-only** and assumes **all
> competitors fly 2.4 GHz spread-spectrum**. Accordingly the **team** rules
> (team separation in the draw, team classification) and the
> **frequency-management** rules (per-pilot frequency allocation, and the
> frequency-based grouping that F3B/F3J/F3K use — "frequency follows frequency")
> described in this family are retained as **sport reference** but are **out of
> MVP software scope**. They return when those capabilities are built — see
> [Future Enhancements](../high-level-requirements.md#future-enhancements).

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
  per-class; every class has one — thresholds range from more-than-4 rounds
  (F5J) to more-than-7 (F3J)).
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

## 7. Re-flights (common pattern)

There is no single CIAM re-flight chapter — each class defines its own — but
five of the six classes follow one recognisable pattern. This section records
the pattern; the **per-class docs are authoritative** on which entitlements a
class grants and its exact numbers.

- A **re-flight is an entitlement to a new working time** for the affected
  competitor. It is distinct from another *attempt* within the same working
  time (classes with unlimited attempts — F3B, F5L — still define re-flights
  separately).
- **Common entitlement themes** (each class grants its own subset — see the
  class docs): a collision during launch or flight; launch-line/towline
  interference (tow classes); the attempt **not judged** by the official
  timekeeper(s); an **unexpected event outside the competitor's control**; an
  **organiser's fault** (the *only* ground in F3K, and the primary one in F5K —
  both of those classes explicitly grant **no** re-flight for an in-flight
  mid-air collision).
- **Claim discipline** (near-identical wording across classes): the competitor
  must ensure the hindering condition was **noticed/witnessed by an official**,
  and must **land as soon as possible** after the event. **Continuing to fly,
  continuing to launch, or re-launching after the event waives** the right to
  the new working time.
- **Placement priorities** (F3J, F3K, F5J, F5K; F3B has its own variant, F5L
  states none): the new working time is granted, in order of preference,
  1. in an **incomplete or following group** (or a complete group on
     additional launch spots);
  2. failing that, in a **new group of re-flyers** (minimum **4**; **6** in
     F5J), filled up by **random draw** from the other competitors;
  3. failing that, with the **original group re-flown at the end of the
     ongoing round**.
- **Which score counts** (the rule the scoring software must enforce): in
  priority cases 2 and 3, the competitor(s) **allocated the re-flight score
  the re-flight — it is their official score even if worse**. Every other
  pilot flying in that group (random-draw fillers, or the original group
  re-flying) scores the **better of** their original flight and the re-flight.
  A filler is **not entitled to a further re-flight** if the re-flight itself
  is hindered.
- **Weather interruptions:** where a class allows the Contest Director to
  interrupt for rain, the contest resumes with **the group that was flying,
  which receives a re-flight** (F3B Tasks A/B, F3K; F3B Task C resumes
  per-pilot — see [f3b.md](f3b.md)).

---

## Source references

Deep-links into the verbatim extracted rule text (see [source-docs/](source-docs/)). The official FAI PDFs remain authoritative.

- Draw / starting order: [CIAM General Rules C.16.2.6](source-docs/ciam-general-rules-2026.md#c1626-starting-order)
- Frequency & transmitter control: [CIAM General Rules C.16.2](source-docs/ciam-general-rules-2026.md#c162-requirements-for-radio-control)
- Timekeeping, results display: [CIAM General Rules C.16.1](source-docs/ciam-general-rules-2026.md#c161-general-requirements)
- Publishing results: [CIAM General Rules C.13.7](source-docs/ciam-general-rules-2026.md#c137-results-of-international-events)
- Team classification: [CIAM General Rules C.15.6.2](source-docs/ciam-general-rules-2026.md#c1562-national-team-classification)
- Penalties: [CIAM General Rules C.19.1](source-docs/ciam-general-rules-2026.md#c191-penalties-imposed-by-the-contest-director)
- Re-flights (per class): [F3B.1.5](source-docs/f3-soaring-2025.md#f3b15-definition-of-an-attempt),
  [F3J.4](source-docs/f3-soaring-2025.md#f3j4-re-flights),
  [F3K.9.6](source-docs/f3-soaring-2025.md#f3k96-re-flights),
  [F5J 5.5.11.6](source-docs/f5-electric-2026.md#55116-re-flights),
  [F5K 5.5.10.13](source-docs/f5-electric-2026.md#551013-reflight),
  [F5L 5.5.12.9](source-docs/f5-electric-2026.md#55129-re-flights)
