# F5L — RC Electric Thermal Gliders, RES

Single-task electric RES (rudder / elevator / spoiler) class; electric motor for
launch with a **hard height cap only** (no launch-height scoring). Provisional class;
the electric-launch equivalent of F3L. Inherits
[00-general-rules.md](00-general-rules.md) and
[f5-general-rules.md](f5-general-rules.md). Source refs `5.5.12.x` (Volume F5 Electric
2026 ed.2).

---

## 1. Pilot assignment to groups (the draw)

Common draw rules per parents, plus (`5.5.12.4`):

- At least **4 qualifying rounds**; participants divided into flight groups, results
  normalised per group.
- **Fly-off:** the top normalised qualifiers, **minimum 2 rounds**; the **fly-off
  group size equals the preliminary group size**.
- Up to **2 helpers**; up to **3 models** (a model may be changed within a round only
  if the model used first is within 15 m of the landing spot).

Working time: **9 minutes (540 s)** per round.

---

## 2. Data the timer / helper collects

| Field | Precision / rule |
|---|---|
| **Flight time** | **Full seconds** (`5.5.12.11.1`). Timed from release (motor running) to first ground contact or end of working time. |
| **Landing distance** | Nose-to-spot (tape/string fixed at the spot), → landing-bonus table below. |
| **Number of attempts** | Unlimited attempts; **the last flight is the official score.** |
| **Launch height** | **Not scored.** The AMRT/e-logger enforces a hard cap — **motor run 30 s, start height 90 m**; a flight scores **0** if the AMRT settings differ from the presets. |
| **Penalties / zeros** | Landing outside the area → 0 for that flight; overfly working time by > 30 s → 0 for the whole task; model touches pilot/helper during landing → 0 landing; model touched before measuring → 0 landing; lost part → 0 landing. |

**Timekeeping fallback:** if no official timekeeper is available the pilot's helper
keeps time and the organiser samples flights; a deviation of **more than 3 seconds in
the competitor's favour** makes that flight a **zero score** (`5.5.12.4 d`).

**Landing-bonus table** (`5.5.12.11.2`) — same shape as F3J:

| Dist (m) | Pts | Dist (m) | Pts |
|---|---|---|---|
| ≤0.2 | 100 | 4 | 85 |
| 0.4 | 99 | 5 | 80 |
| 0.6 | 98 | 6 | 75 |
| 0.8 | 97 | 7 | 70 |
| 1.0 | 96 | 8 | 65 |
| 1.2 | 95 | 9 | 60 |
| 1.4 | 94 | 10 | 55 |
| 1.6 | 93 | 11 | 50 |
| 1.8 | 92 | 12 | 45 |
| 2.0 | 91 | 13 | 40 |
| 3.0 | 90 | 14 | 35 |
| — | — | 15 | 30 |
| — | — | over 15 | 0 |

---

## 3. Group score (`5.5.12.11`)

**Raw flight score** = flight-time score + landing bonus:

- **Flight-time score: 2 points per second**, capped at **6:30 (390 s)** within the
  540 s working time; time flown beyond 390 s is deducted back to 390 s.
- **+ landing bonus** from the table above.

**Normalisation:** highest raw score in the group → **1000**; others =
`own raw / best raw × 1000`.

---

## 4. Round score

Round score = the normalised group score.

---

## 5. Final classification (`5.5.12.12`)

- **Aggregate:** if **5 or fewer** rounds, sum all; if **more than 5**, the **lowest
  round score is dropped**.
- Qualifiers ranked by **fly-off** result; non-qualifiers ranked by their qualifying
  result.
- Team classification as in the parent (not separately detailed in the provisional
  rules).

**Common vs specific:** electric-launch + AMRT and group normalisation are common
(parents); F5L specifics are the **2 pt/second** rate, the **390 s / 540 s** cap, the
**90 m hard height cap with no launch-height scoring** (unlike F5J/F5K), the **100→0
landing table**, **last-flight-counts** scoring, the **helper-timing +3 s fallback**,
and **drop-worst beyond 5 rounds**.

---

## Source references

Deep-links into the verbatim extracted rule text (see [source-docs/](source-docs/)). The official FAI PDFs remain authoritative.

- Description of the competition / draw & fly-off: [5.5.12.4](source-docs/f5-electric-2026.md#55124-description-of-the-competition)
- Scoring of the flight time (2 pt/s, 390 s cap): [5.5.12.11.1](source-docs/f5-electric-2026.md#5512111-scoring-of-the-flight-time)
- Scoring of the landing (bonus table): [5.5.12.11.2](source-docs/f5-electric-2026.md#5512112-scoring-of-the-landing)
- Final classification & discard: [5.5.12.12](source-docs/f5-electric-2026.md#551212-final-classification)
