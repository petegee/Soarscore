# F5J — RC Electric Powered Thermal Duration Gliders

Single-task electric thermal duration; launch height scored as a **deduction**.
Inherits [00-general-rules.md](00-general-rules.md) and
[f5-general-rules.md](f5-general-rules.md). Source refs `5.5.11.x` (Volume F5
Electric 2026 ed.2).

---

## 1. Pilot assignment to groups (the draw)

Common draw rules per parents, plus (`5.5.11.8`):

- Rounds subdivided into frequency-compatible groups; **minimum 6** competitors per
  group. Prefer the **fewest groups per round with the most competitors** each.
- Group composition minimises repeat matchups. **Team protection is mandatory at
  World/Continental Championships, not permitted at Open International / World Cup.**
  Junior pilots get team protection for their nominated helper.
- **Fairness floor:** if a group falls to 5 or fewer (or 4 or fewer in contests ≤30
  pilots) move a competitor up from a later group or cancel and refill (`5.5.11.14.1`).
- **Fly-off:** the top **30 % (rounded down)** of qualifiers, as a **single group of
  minimum 6, maximum 14** (the CD may set a lower maximum).

Working time: **10 minutes** (qualifying) / **15 minutes** (fly-off).

---

## 2. Data the timer / helper collects

| Field | Precision / rule |
|---|---|
| **Flight time** | **Truncated to the whole second** (`5.5.11.12 b`). Timed from **motor ON** to first ground/object contact or end of working time. |
| **Start height** | Read from the **AMRT**, **truncated to the whole metre** (`5.5.11.12 d`). AMRT initialised on the ground before launch, observed by the timekeeper. Flight = 0 if the AMRT records no start height. |
| **Landing distance** | Nose-to-spot, → landing-bonus table below (`5.5.11.12 h`). |
| **Motor run** | AMRT-limited; the flight is **zeroed** if the propeller keeps turning after the 30-second motor-run period (`5.5.11.7 g`). |
| **Penalties** | e.g. wrong launch direction / motor before start signal / launch not straight-ahead for 3 s −100 each (`5.5.11.10 b, c, e`); safety-area −300; contact in access corridor −1000. Launch outside the ±2 m corridor is a **zero score**, not a −100 penalty (`5.5.11.10 d`). Listed on the round score sheet. |

**Overfly:** score 0 if the model overflies the end of working time by more than 1
minute; no landing bonus if it overflies at all.

**Landing-bonus table** (`5.5.11.12 h`) — note this is a **different, coarser** table
than F3J/F5L:

| Dist (m) | Pts |
|---|---|
| ≤1 | 50 |
| 2 | 45 |
| 3 | 40 |
| 4 | 35 |
| 5 | 30 |
| 6 | 25 |
| 7 | 20 |
| 8 | 15 |
| 9 | 10 |
| 10 | 5 |
| over 10 | 0 |

---

## 3. Group score (`5.5.11.12`)

**Raw score** per competitor:

```
raw = flight points + landing bonus − start-height deduction
```

- **Flight points:** 1 pt per full second, capped at **600** (qualifying) / **900**
  (fly-off).
- **Start-height deduction:** **0.5 pt per metre up to 200 m**, **3 pt per metre above
  200 m**.
- If the raw total is negative it is recorded as **0** (penalties still apply).

**Normalisation:** highest raw total in the group → **1000**; others =
`own raw × 1000 / group winner's raw`.

---

## 4. Round score

Round score = the normalised group score.

---

## 5. Final classification (`5.5.11.13`)

- Minimum **4** qualifying rounds for a valid contest.
- **Qualifying aggregate:** if **4 or fewer** rounds, sum all; if **more than 4**, the
  **lowest round score is dropped**.
- Top **30 %** → fly-off; fly-off scored as above; **final placing = fly-off aggregate
  only**, qualifying position breaks ties.
- Penalties are cumulative, deducted at the end of the qualifying rounds, and are
  **not** carried into the fly-off.
- Team classification as in the parent.

**Common vs specific:** electric-launch + AMRT, group normalisation and the fly-off
concept are common (parents); F5J specifics are the **whole-second** flight time, the
**start-height deduction (0.5 / 3 pt per m)**, the **50→0 landing table**, the
**600 / 900** flight-point caps, **drop-worst beyond 4 rounds**, and the **top-30 %**
fly-off.

---

## Source references

Deep-links into the verbatim extracted rule text (see [source-docs/](source-docs/)). The official FAI PDFs remain authoritative.

- Organisation of the flying / groups & fly-off: [5.5.11.8](source-docs/f5-electric-2026.md#55118-organisation-of-the-flying)
- Scoring (flight, height deduction, landing table): [5.5.11.12](source-docs/f5-electric-2026.md#551112-scoring)
- Final classification & fly-off (top 30%): [5.5.11.13](source-docs/f5-electric-2026.md#551113-final-classification)
