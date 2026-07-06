# F3K — RC Hand-Launch Gliders

Multi-task, hand-launched; one task per round chosen from a catalogue. Inherits
[00-general-rules.md](00-general-rules.md) and [f3-general-rules.md](f3-general-rules.md).
Source refs `F3K.x` (Volume F3 Soaring 2025 v2).

---

## 1. Pilot assignment to groups (the draw)

Common draw rules per parents, plus (`F3K.9.1`, `F3K.2.5`):

- Each round: competitors arranged into **as few groups as possible**, minimum **5**
  competitors per group. **Composition differs every round.**
- **Non-spread-spectrum** pilots nominate **at least 2 frequencies**; the organiser
  assigns one for the whole contest (may re-assign only for a separate fly-off).
- **Fly-off** (mandatory at World/Continental Championships): **3–6 rounds**; if fewer
  than 3 fly-off rounds complete, preliminary results stand.

Working time is defined **per task** (see catalogue). A 45 s flight-testing window and
a 60 s no-fly period precede each working time (organisational; not scored).

---

## 2. Data the timer / helper collects

| Field | Precision / rule |
|---|---|
| **Flight time** | Recorded to **0.1 second, truncated** (rounding up not applied) (`F3K.7`). Timed from the model leaving the hand to landing (rest / caught) or working-time expiry. Launch before the working time → that flight scores 0. |
| **Number of launches / flights** | Per task: how many launches were made and which flight(s) count (last, last-two, best-N, etc.). |
| **Target-time calls** | Poker / ladder tasks: the target time nominated **before** each launch (announced to, and written by, the timekeeper); whether it was achieved. "End of working time" call = single attempt. |
| **Scored time per flight** | Capped at the task's target/maximum single-flight time. |
| **Penalties** | e.g. flying outside the assigned window −100. Listed on the round score sheet; **retained even if that round is later dropped.** |
| **Landing height** | **None** — hand launch, no AMRT. |

**Score-card sign-off:** competitor **and** timekeeper sign the round result; **an
unsigned card scores 0 for the round** (`F3K.1.2`).

**Raw task score** = sum of the **scored** flight seconds under the task's rule (no
landing bonus in F3K).

### Task catalogue (`F3K.11`)

| Task | Rule (what counts) | Max/target single flight | Working time |
|---|---|---|---|
| **A** Last flight | Only the last flight counts | 300 s | 7 or 10 min |
| **B** Next-to-last + last | Those two flights summed | 240 s (180 s if large field) | 10 min (7 min) |
| **C** All up, last down | All (3–5) simultaneous flights summed; launch within 3 s of signal | 180 s each | = sum of the flights |
| **D** Two flights | Both flights summed | 300 s each | 10 min |
| **E** Poker | Up to 3 self-nominated targets; only achieved targets counted, summed | target ≤ working time | 10 or 15 min |
| **F** 3 out of 6 | Best 3 of ≤6 flights summed | 180 s each | 10 min |
| **G** Five longest | Best 5 flights summed | 120 s each | 10 min |
| **H** 1-2-3-4 min, any order | 4 longest flights assigned to 60/120/180/240 s targets; each capped at its target | 60/120/180/240 s | 10 min |
| **I** Three longest | Best 3 flights summed | 200 s each | 10 min |
| **J** Three last | Last 3 flights summed | 180 s each | 10 min |
| **K** Big Ladder | Exactly 5 flights to 60/90/120/150/180 s **in order**; each capped at its target | as listed | 10 min |
| **L** One flight | Single launch | 419 s or 599 s | 7 or 10 min |
| **M** Huge Ladder (fly-off) | Exactly 3 flights to 180/300/420 s **in order**; each capped | as listed | 15 min |
| **N** Best flight | Only the best flight counts | 599 s | 10 min |

---

## 3. Group score (`F3K.9.1`)

- Raw task result measured in tenths of a second; group winner (highest raw) → **1000**.
- Others: `own raw score / best raw score × 1000`, **rounded to 0.1 point**.

---

## 4. Round score

Round score = the normalised group score (one task per round).

---

## 5. Final classification (`F3K.10`)

- Minimum **5** rounds (each a different task) for a valid contest.
- Final = **sum of normalised round scores − penalties**. If **6 or more** rounds are
  flown, the **lowest round score is dropped** (penalties from a dropped round are
  retained).
- **Tie:** best dropped score decides; if still tied, a one-task tie-break fly-off.
- Fly-off (if flown) replaces preliminary scores for its participants.
- Team classification as in the parent.

**Common vs specific:** draw framework and 1000-point normalisation are common;
F3K specifics are the **0.1 s truncated** timing, the **task catalogue A–N** with
per-task scored-time rules, mandatory signed score cards, and the **drop-worst from 6
rounds**.

---

## Source references

Deep-links into the verbatim extracted rule text (see [source-docs/](source-docs/)). The official FAI PDFs remain authoritative.

- Definition of a round / groups: [F3K.9](source-docs/f3-soaring-2025.md#f3k9-definition-of-a-round)
- Groups and round scores (normalisation): [F3K.9.1](source-docs/f3-soaring-2025.md#f3k91-groups-and-round-scores)
- Scoring, discard & tie-break: [F3K.10](source-docs/f3-soaring-2025.md#f3k10-scoring)
- Task catalogue A–N: [F3K.11](source-docs/f3-soaring-2025.md#f3k11-definitions-of-tasks)
