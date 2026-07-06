# F3J — RC Thermal Duration Gliders

Single-task thermal duration, winch / hand-towline launch. Inherits
[00-general-rules.md](00-general-rules.md) and [f3-general-rules.md](f3-general-rules.md).
Source refs `F3J.x` (Volume F3 Soaring 2025 v2).

---

## 1. Pilot assignment to groups (the draw)

Common draw rules per parents, plus (`F3J.6.1`, `F3J.13.3`):

- Rounds subdivided into groups arranged by transmitter frequency for maximum
  simultaneous flights. **Minimum 6, preferably 8–10** competitors per group.
- Flying order determined by a **matrix system** that minimises pilots meeting more
  than once (`F3J.12.3`). Same-team pilots kept apart as far as possible.
- Each competitor gets a **contest number derived from the matrix**, retained through
  the qualifying rounds (`F3J.10.7`).
- **Fairness floor:** if a group drops to **3 or fewer**, move a compatible pilot up
  from a later group (`F3J.13.1 c`).
- **Fly-off:** the top **≥ 9** aggregate scorers form a single group (the CD may
  raise the number).

Working time: **10 minutes** (qualifying) / **15 minutes** (fly-off).

---

## 2. Data the timer / helper collects

| Field | Precision / rule |
|---|---|
| **Flight time** | Recorded to **0.1 second** (`F3J.10.2`). Timed from release-from-launch-device to first ground/object contact or end of working time. |
| **Landing distance** | Nose-to-spot, → landing-bonus table below (`F3J.10.5`). |
| **Overfly** | Flying past end of working time: **−30 pts** for up to 1 minute over; **score 0** if over by more than 1 minute. **No landing bonus** if the model overflies the working time. |
| **Penalties** | e.g. towline not cleared within 30 s −100; non-conforming winch −1000; unauthorised transmission −300. Listed on the round score sheet. |

**Landing-bonus table** (`F3J.10.5`):

| Dist (m) | Pts | Dist (m) | Pts |
|---|---|---|---|
| ≤0.2 | 100 | 3 | 90 |
| 0.4 | 99 | 4 | 85 |
| 0.6 | 98 | 5 | 80 |
| 0.8 | 97 | 6 | 75 |
| 1.0 | 96 | 7 | 70 |
| 1.2 | 95 | 8 | 65 |
| 1.4 | 94 | 9 | 60 |
| 1.6 | 93 | 10 | 55 |
| 1.8 | 92 | 11 | 50 |
| 2.0 | 91 | 12 | 45 |
| — | — | 13 | 40 |
| — | — | 14 | 35 |
| — | — | 15 | 30 |
| — | — | over 15 | 0 |

Raw score = **flight points (1 pt/s) + landing bonus − penalties**.

---

## 3. Group score (`F3J.10.10–10.11`)

- Highest raw total in the group → **1000** (the group winner).
- Others: `own raw score × 1000 / group winner's raw score`.
- The corrected (normalised) score is **truncated to one decimal place**.

---

## 4. Round score

Round score = the normalised group score.

---

## 5. Final classification (`F3J.11`)

- **Qualifying aggregate** = sum of round scores. **No drop-worst rule is specified
  for F3J qualifying rounds** in this edition (contrast F5J / F3B / F3K).
- Top **≥ 9** qualify for the fly-off (single group, 15-min working time).
- **Final placing** among qualifiers = **fly-off aggregate only**; qualifying-round
  position breaks fly-off ties.
- Team classification as in the parent.

**Common vs specific:** draw framework and 1000-point normalisation are common;
F3J specifics are the **0.1 s** flight-time precision, this landing-bonus table, the
−30/zero overfly rule, corrected score truncated to 0.1, the top-9 single-group
fly-off, and the **absence of a qualifying drop-worst**.

---

## Source references

Deep-links into the verbatim extracted rule text (see [source-docs/](source-docs/)). The official FAI PDFs remain authoritative.

- Organisation of the flying / groups: [F3J.6](source-docs/f3-soaring-2025.md#f3j6-organisation-of-the-flying)
- Scoring: [F3J.10](source-docs/f3-soaring-2025.md#f3j10-scoring)
- Landing evaluation (bonus table): [F3J.10.5](source-docs/f3-soaring-2025.md#f3j105-landing-evaluation)
- Final classification & fly-off: [F3J.11](source-docs/f3-soaring-2025.md#f3j11-final-classification)
