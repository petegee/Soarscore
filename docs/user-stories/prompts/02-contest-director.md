# Prompt — Write the user stories for the **Contest Director**

You are a requirements analyst working on **Soarscore**, a scoring and running
system for radio-control glider competitions. Your single task in this session is
to write the **user stories for the Contest Director role** and nothing else. Do
not write stories for any other role.

## Step 1 — Read before you write

Read these, in order, and treat them as authoritative:

1. `CLAUDE.md` (repo root) — project context, house-keeping rules, domain summary.
2. `docs/requirements/users.md` — **your role is defined here**; read the whole
   file, then focus on **§2 Contest Director** (its key needs and task table).
3. `docs/requirements/high-level-requirements.md` — the requirement **areas** you
   will flesh out. The Contest Director owns tasks in areas
   **2.2, 4.3, 5.3 (approval), 5.5, Area 5 penalties, and 7 (publish)**.
4. `docs/architecture/logical-architecture.md` — how the Director (on the Base
   Station) fits the wider system.
5. `docs/requirements/rules/` — the FAI-derived rules the software must enforce.
   Read `00-general-rules.md` and the **penalties / re-flight / retirement**
   material; consult family and per-class docs for class-specific penalty and
   drop-worst behaviour. **These rule docs are read-only authority — never write
   stories that contravene them.**

## Step 2 — Scope

The Contest Director is the **officiating authority**: they decide how the
contest proceeds and make the rulings that **change results**. Write stories
**only for the Director's authority and decisions**, per `users.md §2`:

- **Validate the draw's fairness** and **accept or re-draw** it (4.3).
- **Impose penalties** for infringements, with correct recompute (Area 5 —
  penalties). Penalties deduct from the **final aggregate** and are **retained
  even if their round is dropped** (see the rules — get this right).
- **Approve re-flights and group changes** (5.3) — the Organiser executes the
  mechanics; the Director authorises.
- **Retire and reinstate** pilots, triggering re-draw of remaining rounds (5.5).
- **Lock** the competition against further changes while keeping reports
  available (2.2).
- **Publish official results** (Area 7) — the authoritative, final output.

**Role boundaries — do not cross them:**
- The **Organiser** does the administrative *mechanics* — building the draw,
  entering corrections, moving pilots. Your stories cover the **decision /
  authorisation / lock / publish**, not the data entry. Where the two meet
  (e.g. a re-flight: Organiser moves the pilot, Director approves), write only
  the authority half and note the handoff.
- The **Scorer** (live capture) and **Announcer/Timekeeper** (field aids) are
  different roles — not yours.
- This is the **MVP**. Anything under *Future Enhancements* (teams, jury/protest
  workflow, series, etc.) is **out of scope**.

## Step 3 — Story format

Group stories by **requirement area**, in area order. For each story use:

```
### <area-ref> — <short title>

**As the** Contest Director, **I want** <capability>, **so that** <benefit>.

**Acceptance criteria**
- [ ] Given <context>, when <action>, then <observable outcome>.
- [ ] ...

**Traces to:** area(s) <n.n> · users.md §2 Contest Director
**Notes:** <edge cases, rule dependencies, open questions — optional>
```

Rules for good stories here:
- **Altitude:** high-level and **implementation-agnostic** — *what* authority the
  Director exercises and *what* must recompute, never a specific UI or codebase.
- **Correct recompute is central.** Penalties, re-flights and retirements must
  make results recompute **correctly and consistently**; make that observable in
  acceptance criteria (e.g. "a penalty survives the drop of its own round";
  "retiring a pilot re-draws only the remaining rounds and preserves scored
  rounds").
- **Trust & finality:** cover locking (no further change once locked, reports
  still available) and the fairness-challenge path (reject draw → re-draw).
- **Rule-bound stories** (penalties, drop-worst, retirement, draw fairness) must
  stay consistent with `docs/requirements/rules/`. Cite the rule where a
  criterion depends on it.
- **Cross-reference** every story back to its area number(s) and to
  `users.md §2`.

## Step 4 — House-keeping (from `CLAUDE.md`)

- The rule docs track the **sport**, not the product. If a requirement you are
  fleshing out appears to **contradict** the rules — or another requirement in
  `high-level-requirements.md` / `users.md` — **do not silently reconcile it**.
  Flag it in the story's **Notes**, propose a resolution, and list it in a
  **"Conflicts & questions for the user"** section at the end. Prefer the rule
  over a conflicting requirement.
- Cross-check each new story against the existing requirements before it lands;
  avoid duplicating a capability owned by the Organiser.

## Step 5 — Output

Write your stories to **`docs/user-stories/02-contest-director.md`**. Start with a
short intro (role, scope, areas covered), then the stories grouped by area, then
the **"Conflicts & questions for the user"** section (say "none found" if empty).
Wrap prose at ~80 columns. Do not modify any other file, and do **not** edit
anything under `docs/requirements/rules/`.

Before finishing, self-check: every Contest Director task in `users.md §2` is
covered; every story is a *decision/authority* story, not administrative
mechanics; recompute behaviour is testable; no Future-Enhancement dependencies;
every story cites its area.
