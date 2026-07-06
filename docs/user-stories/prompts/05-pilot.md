# Prompt — Write the user stories for the **Pilot / Competitor**

You are a requirements analyst working on **Soarscore**, a scoring and running
system for radio-control glider competitions. Your single task in this session is
to write the **user stories for the Pilot / Competitor role** and nothing else.
Do not write stories for any other role.

## Step 1 — Read before you write

1. `CLAUDE.md` (repo root) — project context, house-keeping rules, domain summary.
2. `docs/requirements/users.md` — read the whole file, then focus on **§5 Pilot /
   Competitor** (key needs and task table) and the notes on why the pilot stays
   an **indirect** user.
3. `docs/requirements/high-level-requirements.md` — the Pilot's touch-points are
   **3.4** (roster entry details), **5.0/5.2** (cross-check the device, be
   scored), and **7.1 / 7.3 / 7.4** (read draw, flying order, results).
4. `docs/architecture/logical-architecture.md` — the Pilot is **indirect**: reads
   published draw & results, and cross-checks (before the group starts) that a
   Scorer's device is set to their name; **never self-scores**.
5. `docs/requirements/rules/` — `00-general-rules.md` for how results are formed
   (best raw = 1000, scaling, **drop-worst**, penalties on the aggregate) so
   "results are correct and transparent" stories are rule-accurate. **Rule docs
   are read-only authority — never contravene them.**

## Step 2 — Scope — the Pilot is an *indirect* user

Get this framing right, it shapes every story:

- In the MVP the pilot does **not operate the software** and does **not enter
  their own data**. Their flight is recorded **by the Scorer** beside them; the
  pilot **reads** the draw and results. Pilots **never self-score** — a conflict
  of interest — and this is permanent, not a Future Enhancement.
- So the Pilot's stories are **needs met *through* the system and officials**,
  not direct operations. Frame each as an outcome the system must make possible
  for the pilot, delivered via reports, the roster, and the cross-check moment.

The Pilot's needs and touch-points (from `users.md §5`):

- **Know when / in which group / which lane they fly** — via the draw & flying-
  order reports (7.1, 7.3).
- **Assurance their flight is recorded against them** — the ability to
  **cross-check, before the group begins**, that the Scorer's device is set to
  their name (5.0). The pilot cross-checks; the **Scorer** owns the binding.
- **Correct, transparent, promptly-available results** — position, round-by-round
  breakdown, drop-worst applied correctly (7.1, 7.4).
- **Confirm entry details** — class, start number — via the roster (3.4). The
  **Organiser** maintains the roster; the pilot provides/confirms their details.
- Assurance the **draw is fair** (they read it; fairness is produced by the
  Organiser/Director in Area 4).

**Role boundaries — do not cross them:**
- Do **not** write any story where the pilot operates setup, the draw, scoring
  capture, or admin — those are Organiser / Contest Director / Scorer roles. The
  pilot's active verbs are essentially **read**, **cross-check**, and
  **provide/confirm own entry details**.
- The **cross-check** at 5.0 is the pilot's; the **device binding and pre-group
  confirmation** are the **Scorer's** — write only the pilot's cross-check half
  and note the counterpart.
- This is the **MVP**. Any *remote* / self-service scoring is out of scope (and
  self-scoring is permanently out of scope).

## Step 3 — Story format

Group stories by touch-point area (3.4, 5.0, 7.x). For each story use:

```
### <area-ref> — <short title>

**As a** Pilot / Competitor, **I want** <capability>, **so that** <benefit>.

**Acceptance criteria**
- [ ] Given <context>, when <action>, then <observable outcome>.
- [ ] ...

**Traces to:** area(s) <n.n> · users.md §5 Pilot / Competitor
**Notes:** <the mediating role/report, edge cases, open questions — optional>
```

Rules for good stories here:
- **Altitude:** high-level and **implementation-agnostic** — *what outcome* the
  pilot must be able to obtain, never a specific screen, app or channel.
- **Frame indirectly:** each acceptance criterion is about what the system/report
  makes available to the pilot (e.g. "the published draw shows the pilot their
  group and lane for every round"), not the pilot pressing buttons in the app.
- **Results transparency is rule-bound:** stories about reading results must be
  consistent with the scoring rules — round-by-round breakdown, **drop-worst**
  applied correctly, penalties visible on the aggregate. Cite
  `00-general-rules.md`.
- **The cross-check moment:** write the pilot's side of 5.0 — being able, before
  the group starts, to verify the adjacent Scorer's device is set to their name —
  with testable criteria, and note that the Scorer owns the binding/guard.
- **Cross-reference** every story to its area(s) and to `users.md §5`.

## Step 4 — House-keeping (from `CLAUDE.md`)

- Rule docs track the **sport**, not the product. If a requirement appears to
  contradict the rules or another requirement, **flag it — don't silently
  reconcile** — in **Notes** and in a final **"Conflicts & questions for the
  user"** section. Prefer the rule.
- Cross-check each story against the existing requirements; don't duplicate an
  operator role's capability — the pilot only reads, cross-checks, and confirms
  their own entry.

## Step 5 — Output

Write your stories to **`docs/user-stories/05-pilot.md`**. Start with a short
intro stressing the Pilot is an **indirect** user (reads / cross-checks /
confirms own details, never self-scores), the scope, and the areas covered. Then
the stories grouped by touch-point, then the **"Conflicts & questions for the
user"** section (say "none found" if empty). Wrap prose at ~80 columns. Do not
modify any other file, and do **not** edit anything under
`docs/requirements/rules/`.

Before finishing, self-check: every Pilot task in `users.md §5` is covered; no
story has the pilot operating the software directly or self-scoring; results
stories respect drop-worst and penalty rules; the 5.0 cross-check is the pilot's
half only; no Future-Enhancement dependencies; every story cites its area.
