# F3B — RC Multi-Task Gliders

Duration + Distance + Speed, winch-launched. Inherits
[00-general-rules.md](00-general-rules.md) and [f3-general-rules.md](f3-general-rules.md);
this file states F3B specifics. Source refs `F3B.x` (Volume F3 Soaring 2025 v2).

**F3B is the structural outlier:** a *round* is one flight of **each** of three tasks
(A Duration, B Distance, C Speed), and each task is normalised **separately** into a
partial score. There is no single per-group score.

---

## 1. Pilot assignment to groups (the draw)

Common draw rules per parents, plus F3B specifics (`F3B.1.8`):

- Groups drawn by radio frequency; **composition changed every round**. Same-team
  pilots not in the same group (team separation at Championships).
- **Group-size minima are per task (`F3B.1.8 b`):**
  - **Task A (Duration):** minimum **5** competitors per group.
  - **Task B (Distance):** minimum **3** competitors per group.
  - **Task C (Speed):** a group is minimum **8** competitors or all competitors.
- On a **rain interruption during Task C**, the Task-C field is divided into **3 or 4
  groups** depending on entry count, evaluated per group (`F3B.1.11 c` — a weather
  provision, not a routine draw rule).
- Flying order of groups is also set by the draw; a different starting order is used
  each round.
- A **group result is annulled if only one competitor** in it has a valid result.
- **Minimum for a valid competition (`F3B.1.8 b`):** **one (1) round and one (1)
  task**. A World/Continental Championship result is valid at **five (5) complete
  rounds**.

---

## 2. Data the timer / helper collects

| Task | Field | Precision / rule |
|---|---|---|
| **A Duration** | Flight time | Whole seconds; 1 pt per full second, from release-from-tow to rest. Max 600 pts (600 s); **−1 pt per second over 600 s**; whole flight = 0 if not landed on the defined area. |
| **A Duration** | Landing distance | Nose-to-spot, **rounded up to the nearest metre**, → landing-bonus table below. **No landing bonus if flight time > 630 s.** Task capped at 12 min total incl. tow. |
| **B Distance** | Completed legs | Integer count of full **150 m** legs, Base A↔B, within a 4-minute flight window (7-minute task). Partial legs not counted. Flight = 0 if not landed on defined area. |
| **C Speed** | Elapsed time | Time to fly **4 × 150 m** legs, recorded to **at least 1/100 second**. Model that fails to complete, or lands early, scores **0**. |
| all | Penalties | e.g. safety-plane crossing (Task C) −300; non-conforming winch −1000. Listed on the round score sheet. |

**Task A landing-bonus table** (`F3B.2.3 d`):

| Dist (m) | Pts | Dist (m) | Pts |
|---|---|---|---|
| 1 | 100 | 9 | 60 |
| 2 | 95 | 10 | 55 |
| 3 | 90 | 11 | 50 |
| 4 | 85 | 12 | 45 |
| 5 | 80 | 13 | 40 |
| 6 | 75 | 14 | 35 |
| 7 | 70 | 15 | 30 |
| 8 | 65 | over 15 | 0 |

---

## 3. Group score — three partial scores (`F3B.2.6`)

The winner of each group **in each task** receives 1000; others are scaled:

- **Partial A** = `1000 × P₁ / P_W` — P = duration points (flight + landing).
- **Partial B** = `1000 × D₁ / D_W` — D = distance (legs) flown.
- **Partial C** = `1000 × T_W / T₁` — T = speed time (**inverted**: lower time is better).

(`₁` = this competitor, `_W` = group winner for that task.)

---

## 4. Round score (`F3B.2.7`)

**Total Score for the round = Partial A + Partial B + Partial C.**

---

## 5. Final classification (`F3B.2.8`)

- Sum of round Total Scores across all rounds.
- **Discard is per task, not per round:** if more than **5** complete rounds are
  flown, the **lowest partial score of each task** (for tasks with more than five
  results) is omitted from the sum.
- **Tie:** the tied competitors fly one additional full round (all three tasks).
- Team classification as in the parent.

**Common vs specific:** draw framework and 1000-point normalisation are common
(parents); everything else here — three separate per-task partials, the inverted
speed ratio, integer leg counts, 1/100 s speed timing, and per-task discard — is F3B
specific.

---

## 6. Re-flights (`F3B.1.5`, `F3B.1.11`)

Within each task's working time the competitor already has **unlimited
attempts**; a re-flight is the stronger remedy — a **new working time**.

**Entitlement** (must be duly witnessed by a contest official):

- his model in flight collides with another model in flight, a model in the
  process of launch, or a launch cable during launching;
- his model or launch cable in the process of launch collides with another
  launching model/cable, or with a model in flight;
- his launch cable is **crossed or fouled** by another competitor's at the
  point of launch;
- the flight was **not judged** by the fault of the judges/timekeepers (Task
  A: pilot/helper must have told the timekeeper the model's position a
  reasonable time before landing, else no entitlement);
- an **unexpected event outside the competitor's control** hindered or
  aborted the flight.

**Claim / waiver:** after a collision the competitor must **land as soon as
possible**; continuing to fly, continuing to launch, or re-launching waives
the right.

**Placement & scoring** (`F3B.1.5 e`, Tasks A and B): those entitled fly
**within an incomplete group or in one or more newly formed groups**; if that
is not possible, **their original group flies again**. Everyone else in that
group scores the **better of** their two results; for the entitled
competitor(s) the **repetition is the official score**.

**Rain interruption** (`F3B.1.11`): Tasks A/B — on resumption the group that
was flying **receives a re-flight**. Task C — resumption is **per pilot** (the
pilot flying receives a re-flight); the Task-C field is pre-divided into 3–4
groups, and an interruption longer than 15 minutes restarts the interrupted
group with per-group evaluation.

---

## Source references

Deep-links into the verbatim extracted rule text (see [source-docs/](source-docs/)). The official FAI PDFs remain authoritative.

- Attempts & re-flights: [F3B.1.5](source-docs/f3-soaring-2025.md#f3b15-definition-of-an-attempt)
- The draw / organisation of starts: [F3B.1.8](source-docs/f3-soaring-2025.md#f3b18-organisation-of-starts)
- Weather conditions / interruptions (Task-C rain split): [F3B.1.11](source-docs/f3-soaring-2025.md#f3b111-weather-conditions--interruptions)
- Task A – Duration: [F3B.2.3](source-docs/f3-soaring-2025.md#f3b23-task-a---duration)
- Task B – Distance: [F3B.2.4](source-docs/f3-soaring-2025.md#f3b24-task-b---distance)
- Task C – Speed: [F3B.2.5](source-docs/f3-soaring-2025.md#f3b25-task-c---speed)
- Partial scores (per-task normalisation): [F3B.2.6](source-docs/f3-soaring-2025.md#f3b26-partial-scores)
- Total score (round): [F3B.2.7](source-docs/f3-soaring-2025.md#f3b27-total-score)
- Classification & discard: [F3B.2.8](source-docs/f3-soaring-2025.md#f3b28-classification)
