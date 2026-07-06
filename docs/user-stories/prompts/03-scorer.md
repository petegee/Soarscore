# Prompt — Write the user stories for the **Scorer**

You are a requirements analyst working on **Soarscore**, a scoring and running
system for radio-control glider competitions. Your single task in this session is
to write the **user stories for the Scorer role** and nothing else. Do not write
stories for any other role.

## Step 1 — Read before you write

Read these, in order, and treat them as authoritative:

1. `CLAUDE.md` (repo root) — project context, house-keeping rules, domain summary.
2. `docs/requirements/users.md` — **your role is defined here**; read the whole
   file, then focus on **§3 Scorer** (key needs, task table, and the two
   call-out boxes on **device–competitor binding** and the split from the
   Announcer/Timekeeper).
3. `docs/requirements/high-level-requirements.md` — the requirement **areas** you
   will flesh out. The Scorer owns **Area 5 sub-areas 5.0, 5.1, 5.2** only, plus
   the intro paragraph to Area 5 on concurrent device-based capture.
4. `docs/architecture/logical-architecture.md` — the **Scorer Device ↔ Base
   Station** two-way link, one Scorer per flying pilot. This is the heart of your
   stories.
5. `docs/requirements/rules/` — read `00-general-rules.md` for what a Scorer
   actually records (times, landings, laps, heights, motor runs, penalties) and
   the timing/precision rules; per-class task detail is **deferred**, so keep
   task screens **generic**. **Rule docs are read-only authority — never
   contravene them.**

## Step 2 — Scope — who the Scorer is

Crucial context, get this exactly right:

- There is **one Scorer per competitor**, not one central operator. During a
  group's working time, each flying pilot has a Scorer beside them recording
  **that pilot's** metrics on **one device**. Several Scorers capture **in
  parallel** within a group.
- The Scorer's needs are physical: **eyes on the flight, not the screen** — large
  touch targets, minimal keystrokes, sensible defaults, input laid out to **match
  the shape of the task**.
- **Device–competitor binding is the Scorer's responsibility.** The Scorer
  selects, from the group's pilot list on the device, the competitor they are
  about to score, and **confirms before the group starts**. A Scorer often scores
  **back-to-back across consecutive groups** without swapping handsets, so the
  device must support **re-selecting** the pilot. A **pre-group confirmation
  guard** must block score entry until the pilot has been deliberately
  (re-)confirmed for *that* group, so a stale selection can't silently score the
  wrong competitor.

Write stories **only** for the three Scorer sub-areas:

- **5.0 Device Assignment** — select the competitor from the group's pilot list;
  show the selected pilot for pre-group confirmation; re-select between
  consecutive groups without swapping devices; the pre-group confirmation guard.
- **5.1 Score Entry** — capture the adjacent competitor's result live, with
  immediate confirmation it landed against the **right** competitor; many Scorers
  capturing concurrently within a group.
- **5.2 Task Scoring Screens** — capture the inputs each task requires (times,
  landings, laps, heights, motor runs, penalties). Keep this **generic** —
  discipline-specific layouts are deferred; do not invent per-class screens.

**Role boundaries — do not cross them:**
- Mid-contest **score administration** — corrections, cross-round review,
  re-flights/group moves, outlier/missing validation (5.3, 5.4, 5.6) — is
  **Organiser** oversight work under **Contest Director** authority, **not** the
  Scorer's. Do not write those.
- The **Announcer/Timekeeper** who runs the group clock and callouts (Area 6) is
  a **different** role. The Scorer is not the group timekeeper.
- Pilots **never self-score** (conflict of interest). The Scorer records on the
  pilot's behalf; the pilot only cross-checks the device is set to them.
- This is the **MVP**. *Remote / off-site* scoring, device-to-device sync, and
  hardware-assisted capture are **Future Enhancements** — out of scope. Concurrent
  on-site multi-device capture **is** in scope.

## Step 3 — Story format

Group stories by sub-area (5.0, 5.1, 5.2). For each story use:

```
### <area-ref> — <short title>

**As a** Scorer, **I want** <capability>, **so that** <benefit>.

**Acceptance criteria**
- [ ] Given <context>, when <action>, then <observable outcome>.
- [ ] ...

**Traces to:** area(s) <5.n> · users.md §3 Scorer
**Notes:** <edge cases, rule dependencies, open questions — optional>
```

Rules for good stories here:
- **Altitude:** high-level and **implementation-agnostic**. You may describe
  *interaction qualities* the requirements already call for (large targets, few
  keystrokes, immediate confirmation, task-shaped input) because those are stated
  needs — but do **not** design a specific screen, control, gesture or layout.
- **Make the safety-critical paths testable.** The wrong-pilot failure mode is
  the central risk: write acceptance criteria for the pre-group confirmation
  guard, for re-selecting a pilot between back-to-back groups, and for immediate
  confirmation that an entry attributed to the correct competitor. Include the
  unhappy paths (stale selection carried over; a mistyped value; entry attempted
  before confirmation).
- **Concurrency:** cover that several Scorers capture at once within a group
  without collision or cross-attribution.
- **Generic task capture:** 5.2 stories describe capturing categories of metric,
  not a class's specific task. Cite `00-general-rules.md` for what those metrics
  are and any timing precision.
- **Cross-reference** every story to its sub-area and to `users.md §3`.

## Step 4 — House-keeping (from `CLAUDE.md`)

- Rule docs track the **sport**, not the product. If a requirement appears to
  **contradict** the rules — or another requirement in the docs — **do not
  silently reconcile it**. Flag it in **Notes**, propose a fix, and list it in a
  **"Conflicts & questions for the user"** section at the end. Prefer the rule.
- Cross-check each story against existing requirements; don't duplicate Organiser
  or Director capabilities.

## Step 5 — Output

Write your stories to **`docs/user-stories/03-scorer.md`**. Start with a short
intro (who the Scorer is — one per competitor, concurrent, device-based — scope,
sub-areas covered), then stories grouped by sub-area, then the **"Conflicts &
questions for the user"** section (say "none found" if empty). Wrap prose at ~80
columns. Do not modify any other file, and do **not** edit anything under
`docs/requirements/rules/`.

Before finishing, self-check: every Scorer task in `users.md §3` is covered; the
pre-group confirmation guard and re-selection are both storied with testable
criteria; 5.2 stays generic (no per-class screens); nothing strays into 5.3–5.6
or Area 6; no Future-Enhancement dependencies; every story cites its sub-area.
