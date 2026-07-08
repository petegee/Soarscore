# F5K — RC Electric Thermal Duration, Multiple-Task

Multi-task electric class (tasks A–E); launch height scored as a **bonus/penalty vs a
Nominal Launch Height**. Provisional class. Inherits
[00-general-rules.md](00-general-rules.md) and
[f5-general-rules.md](f5-general-rules.md). Source refs `5.5.10.x` (Volume F5 Electric
2026 ed.2).

---

## 1. Pilot assignment to groups (the draw)

Common draw rules per parents, plus (`5.5.10`):

- Man-on-man, rounds subdivided into groups; **all pilots in a group launch
  simultaneously** at the start signal. Composition varies per round.
- **Fly-off** optional (mandatory for seniors at World/Continental Championships):
  **3–6 rounds**; if fewer than 3 complete, preliminary results stand. Junior fly-off
  max = ⅔ of the senior fly-off size.

Working time is defined **per task** (see catalogue). Preparation time ≥ 5 minutes per
round.

---

## 2. Data the timer / helper collects

| Field | Precision / rule |
|---|---|
| **Flight time** | **Whole seconds**, tenths **not** rounded (`5.5.10.6 f`). Timed from release (motor running) to first ground/object contact or end of working time. |
| **Launch altitude** | Read from the **AMRT** (fixed **60 m / 7 s**): the highest altitude from launch until **10 s after the motor stops**, in **whole metres**. Recorded on the score card; software converts it to a bonus/penalty. |
| **Number of launches** | Per task; drives launch penalties (Tasks B and E). |
| **Target-time calls** | Poker (Task E): target announced before each launch; marked **Y/N** (achieved / not). Height bonus/penalty applies **only when the target is achieved**. |
| **Landing area** | Whether the model comes to rest inside the individual "Pilot Area"; landing outside it (but on the field) = **−10 pts per landing**. |
| **Penalties** | Overfly landing window −100; motor restart in flight → 0 for that flight; landing off the field → 0 for that flight; safety-zone −300; hitting anyone but self/timer → 0 for the round. |

**Score-card sign-off:** signed by pilot and timer; the signed card is authoritative.

### Nominal Launch Height (NLH) and launch points (`5.5.10.3–10.4`)

- The **NLH** is a reference altitude set in the scoring software: **60 m** in light
  wind, **70 m** in moderate wind. The CD announces it one day before, from the mean
  wind 11:00–17:00.
- **Per-metre adjustment vs NLH:**
  - **Below** NLH: **+0.5 pt per metre** (bonus).
  - **1–10 m above** NLH: **−1.0 pt per metre**.
  - **11 m and more above** NLH: **−3.0 pt per metre**.
- No bonus for flights shorter than 30 s (penalties still apply); bonus/penalty apply
  to valid flights only.

### Task catalogue (`5.5.10.2`)

| Task | Rule (what counts) | Launches | Working time |
|---|---|---|---|
| **A** 1-2-3-4 min, any order | 4 flights to 1/2/3/4-min targets, any order; each flight counts | max 4 | 10 min (score cap 9:59) |
| **B** Last flight 5-of-7 | Only the last flight; capped at 5 min | max 3 | 7 min |
| **C** All up | 3 flights of max 4:00 each, all summed | 3 | 4:01 min each |
| **D** 3-3-4 min, any order | 3 flights to 3/3/4-min targets, any order; each counts | max 3 | 10 min (cap 9:59) |
| **E** Poker | Up to 3 self-nominated targets; only achieved (Y) targets scored | max 3 | 10 min (target ≤ 9:59) |

**Launch penalties** (Tasks B and E): 1st launch 0; 2nd launch −10; 3rd launch a
further −10 (B, total −20) or −20 (E, total −30). Applied even if the target is missed.

---

## 3. Group score (`5.5.10.15`)

**Raw task result** = `Σ flight-time seconds (1 pt/s) + launch-altitude bonus
− launch-altitude penalty − other penalties`, negative totals recorded as **0**, then
**truncated down to whole points**.

**Normalisation:** group winner (best raw) → **1000**; others =
`own raw / best raw × 1000`, **rounded to whole points**.

---

## 4. Round score

Round score = the normalised group score (one task per round).

---

## 5. Final classification (`5.5.10.16–10.18`)

- **No minimum-rounds validity rule is defined for F5K** — section `5.5.10`
  states none (extraction-checked 2026-07-08 against the source text); contest
  validity at low round counts is the Contest Director's judgement.
- Final = **sum of the normalised round scores**. If **7 or more** rounds are flown,
  the **lowest is dropped**. The signed score cards are the sole basis for results.
- **Tie:** best dropped score decides; if still tied, a one-task tie-break fly-off.
- Fly-off (if flown) replaces preliminary points.
- Team classification as in the parent.

**Common vs specific:** electric-launch + AMRT, group normalisation and the fly-off
concept are common (parents); F5K specifics are the **task catalogue A–E** with
simultaneous launches, the **NLH bonus/penalty** launch-height model (+0.5 / −1 / −3
per m), the **launch penalties**, whole-point rounding, and **drop-worst from 7
rounds**.

---

## 6. Re-flights (`5.5.10.13`)

**Mid-air collisions earn *no* re-flight and no penalty** in F5K.

**Entitlement** — the competitor is entitled to a re-flight if:

- the attempt could not be performed correctly due to the **organiser's
  fault**;
- the **launch altitude was not recorded in the AMRT**, and/or the associated
  external AMRT software could not determine the launch altitude;
- the attempt was **not judged by the timekeeper** — provided the helper/pilot
  **informed the timekeeper of the model's position** a reasonable time before
  landing, else no entitlement.

**Placement priorities** (stated for the organiser's-fault case):

1. in a **following group**;
2. failing that, in a **new group of minimum 4 re-flyers**, completed by
   random draw (re-drawn if frequency/team doesn't fit or the drawn pilot
   won't fly);
3. failing that, with the **original group at the end of the ongoing round**.

**Which score counts** (cases 2 and 3): re-flyers allocated the new attempt
score the **re-flight** (official even if worse); the other pilots in the
group score the **better of** their two results, with no further entitlement
if the re-flight is hindered by organiser's fault.

---

## Source references

Deep-links into the verbatim extracted rule text (see [source-docs/](source-docs/)). The official FAI PDFs remain authoritative.

- Re-flight: [5.5.10.13](source-docs/f5-electric-2026.md#551013-reflight)
- Task overview A–E: [5.5.10.2](source-docs/f5-electric-2026.md#55102-task-overview)
- Nominal Launch Height: [5.5.10.3](source-docs/f5-electric-2026.md#55103-nominal-launch-height-nlh)
- Launch points related to the NLH: [5.5.10.4](source-docs/f5-electric-2026.md#55104-launch-points-related-to-the-nlh)
- Scoring (normalisation): [5.5.10.15](source-docs/f5-electric-2026.md#551015-scoring)
- Final score & discard: [5.5.10.16](source-docs/f5-electric-2026.md#551016-final-score)
