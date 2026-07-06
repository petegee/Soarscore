# Prompt — Write the user stories for the **Organiser**

You are a requirements analyst working on **Soarscore**, a scoring and running
system for radio-control glider competitions. Your single task in this session is
to write the **user stories for the Organiser role** and nothing else. Do not
write stories for any other role.

## Step 1 — Read before you write

Read these, in order, and treat them as authoritative:

1. `CLAUDE.md` (repo root) — project context, house-keeping rules, domain summary.
2. `docs/requirements/users.md` — **your role is defined here**; read the whole
   file, then focus on **§1 Organiser** (its key needs and task table).
3. `docs/requirements/high-level-requirements.md` — the requirement **areas** you
   will flesh out. The Organiser owns tasks in areas
   **1, 2.1, 3, 4.1, 4.2, 4.4, 5.3, 5.4, 5.6, and 7**.
4. `docs/architecture/logical-architecture.md` — how the Organiser (on the Base
   Station) fits the wider system.
5. `docs/requirements/rules/` — the FAI-derived rules the software must enforce.
   Read `00-general-rules.md`; consult family (`f3-`, `f5-`) and per-class docs
   only as needed to keep draw/scoring stories rule-accurate. **These rule docs
   are read-only authority — never write stories that contravene them.**

## Step 2 — Scope

Write stories **only for what the Organiser does**, per the task table in
`users.md §1`:

- Maintain reusable **master data** — pilots, landing-bonus tables, contest
  templates (Area 1).
- **Create / open / delete** competitions (2.1).
- **Configure a competition** — identity, discipline, entry options, roster,
  draw/scoring/task-scoring rules (Area 3, all sub-areas 3.1–3.7).
- **Specify, generate and adjust the draw** — draw specification, generate,
  adjust lanes (4.1, 4.2, 4.4).
- **Administer scores** — corrections, cross-round review (score-by-pilot),
  group moves/re-flights, outlier/missing validation (5.3, 5.4, 5.6).
- Produce **draw and results reports** (Area 7).

**Role boundaries — do not cross them:**
- The Organiser **sets up and administers**; the **Contest Director** holds
  *authority* over decisions (accept/re-draw the draw at 4.3, penalties,
  approving re-flights, retirement at 5.5, locking at 2.2, publishing). Where a
  task needs the Director's authority, the Organiser story stops at *preparing /
  proposing / executing under authority* — write the decision itself as the
  Director's story, not yours. If a story genuinely spans both, note the handoff
  rather than duplicating the Director's decision.
- The per-competitor **Scorer** (live capture, 5.0/5.1/5.2) is a different role —
  not yours.
- This is the **MVP**. Anything under *Future Enhancements* in the requirements
  (teams, frequency management, i18n, remote scoring, import/export, series,
  etc.) is **out of scope** — do not write stories for it.

## Step 3 — Story format

Group stories by **requirement area**, in area order. For each story use:

```
### <area-ref> — <short title>

**As an** Organiser, **I want** <capability>, **so that** <benefit>.

**Acceptance criteria**
- [ ] Given <context>, when <action>, then <observable outcome>.
- [ ] ...

**Traces to:** area(s) <n.n> · users.md §1 Organiser
**Notes:** <edge cases, rule dependencies, open questions — optional>
```

Rules for good stories here:
- **Altitude:** high-level and **implementation-agnostic**. Describe *what* must
  be possible, never a specific UI, screen, framework or data store. Match the
  altitude of the existing requirements docs.
- **Vertical slices:** each story delivers observable value to the Organiser.
  Split an area into several stories where it clearly holds several capabilities
  (e.g. Area 1 → pilots vs landing tables vs templates).
- **Acceptance criteria** are testable and observable — prefer Given/When/Then.
  Include the unhappy paths that matter (e.g. deleting a competition that is
  locked; replacing an entrant after the draw; an outlier flagged at 5.6).
- **Rule-bound stories** (draw fairness at 4.1/4.2, scoring config at 3.6/3.7,
  score admin at 5.3–5.6) must stay consistent with `docs/requirements/rules/`.
  Cite the rule where a criterion depends on it.
- **Cross-reference** every story back to its area number(s) and to
  `users.md §1`, exactly as the docs already cross-link by area.

## Step 4 — House-keeping (from `CLAUDE.md`)

- The rule docs track the **sport**, not the product. If a requirement you are
  fleshing out appears to **contradict** the rules — or contradicts another
  requirement in `high-level-requirements.md` / `users.md` — **do not silently
  reconcile it**. Flag it in the story's **Notes**, propose a resolution, and
  list it in a **"Conflicts & questions for the user"** section at the end of
  your output. Prefer the rule over a conflicting requirement.
- Cross-check each new story against the existing requirements before it lands;
  avoid duplicating a capability already owned by another role.

## Step 5 — Output

Write your stories to **`docs/user-stories/01-organiser.md`**. Start the file
with a short intro (role, scope, which areas it covers), then the stories grouped
by area, then the **"Conflicts & questions for the user"** section (even if
empty — say "none found"). Wrap prose at ~80 columns to match the repo's markdown
style. Do not modify any other file, and do **not** edit anything under
`docs/requirements/rules/`.

Before finishing, self-check: every Organiser task in `users.md §1` is covered by
at least one story; no story strays into another role's authority; no story
depends on a Future-Enhancement capability; every story cites its area.
