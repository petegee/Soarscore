# Prompt — Write the user stories for the **Announcer / Timekeeper**

You are a requirements analyst working on **Soarscore**, a scoring and running
system for radio-control glider competitions. Your single task in this session is
to write the **user stories for the Announcer / Timekeeper role** and nothing
else. Do not write stories for any other role.

## ⚠️ Read this first — Area 6 is an unconfirmed stub

The Announcer/Timekeeper operates **Area 6 (Display, Timer & Audio)**, which
`CLAUDE.md` and `high-level-requirements.md` both flag as an **unconfirmed stub**
— its sub-areas are *inferred*, not verified against reference material. So:

- Write stories at a **deliberately provisional** altitude and mark the whole set
  as **provisional / pending Area 6 confirmation** in the file intro.
- Do **not** over-specify. Capture the evident intent (a group clock, callouts,
  a field display) without inventing detail the requirements don't support.
- Put every assumption you make, and every gap, into the **"Conflicts &
  questions for the user"** section so they can be resolved when Area 6 is
  verified. This is the most important output of this particular prompt.

## Step 1 — Read before you write

1. `CLAUDE.md` (repo root) — note Area 6 is called out as unconfirmed.
2. `docs/requirements/users.md` — read the whole file, then **§4 Announcer /
   Timekeeper**, including the **"Naming caution"** box.
3. `docs/requirements/high-level-requirements.md` — **Area 6** (6.1 Timer,
   6.2 Audio, 6.3 Field Display) and its stub warning.
4. `docs/architecture/logical-architecture.md` — the **Field Aids** node (shown
   dashed as a stub), driven by the Base Station with current group / flying
   order / time.
5. `docs/requirements/rules/` — `00-general-rules.md` for **working time** and
   any timing/countdown conventions the timer and callouts must respect. **Rule
   docs are read-only authority — never contravene them.**

## Step 2 — Scope and the naming caution

Get this distinction exactly right, because the docs stress it:

- This **"Timekeeper" runs the group clock and callouts for the whole group** —
  starts the working-time timer, triggers audio callouts, and drives the on-field
  display of who is flying. There is **one** of them per group.
- They are **NOT** the per-competitor **Scorer** (of whom there is one beside
  each pilot). One Announcer/Timekeeper runs the group; many Scorers record
  within it. Do not blur the two roles.

Write stories **only** for the three Area 6 sub-areas:

- **6.1 Timer** — run the countdown / working-time timer for the current group.
  Needs: **zero fuss** to start / stop / reset for the next group (hands busy,
  eyes on the field).
- **6.2 Audio** — trigger spoken / audible callouts tied to the working-time
  window; **reliable and correctly timed**.
- **6.3 Field Display** — show the current group and flying order on-field; **big,
  glanceable, daylight-readable** from the flight line.

**Role boundaries — do not cross them:**
- Live **score capture** (Area 5) belongs to the **Scorer**, not you.
- **Setup, draw and results** (Areas 1–4, 7) belong to the **Organiser / Contest
  Director**. The field display *consumes* the current group / flying order the
  Base Station provides — your stories are about **operating and viewing** the
  field aids, not producing the underlying draw.
- This is the **MVP**.

## Step 3 — Story format

Group stories by sub-area (6.1, 6.2, 6.3). For each story use:

```
### <area-ref> — <short title>

**As an** Announcer / Timekeeper, **I want** <capability>, **so that** <benefit>.

**Acceptance criteria**
- [ ] Given <context>, when <action>, then <observable outcome>.
- [ ] ...

**Traces to:** area(s) <6.n> · users.md §4 Announcer / Timekeeper
**Notes / assumptions:** <flag anything provisional — expected to be frequent here>
```

Rules for good stories here:
- **Altitude:** high-level and **implementation-agnostic**. You may state the
  evident field needs (glanceable, daylight-readable, low-fuss start/stop/reset,
  correctly-timed callouts) since the requirements name them — but do not design
  the display, choose audio content, or specify hardware.
- **Timing correctness matters:** callouts and the timer must align with the
  **working-time window** defined in the rules; make that testable and cite the
  rule. Cover start / stop / reset and moving to the next group.
- Because Area 6 is a stub, **prefer fewer, well-flagged stories** over many
  speculative ones. Every inferred capability gets an explicit assumption note.
- **Cross-reference** every story to its sub-area and to `users.md §4`.

## Step 4 — House-keeping (from `CLAUDE.md`)

- Rule docs track the **sport**, not the product. If a requirement appears to
  contradict the rules or another requirement, **flag it — don't silently
  reconcile** — in **Notes** and in the final section. Prefer the rule.
- The **naming caution** (Announcer/Timekeeper vs Scorer) is itself an open item
  the docs say must be reconciled when Area 6 is confirmed — surface it in your
  questions section.

## Step 5 — Output

Write your stories to **`docs/user-stories/04-announcer-timekeeper.md`**. Open the
file with a prominent note that this set is **provisional pending Area 6
confirmation**. Then a short intro (role, the naming caution, scope), the stories
grouped by sub-area, and a substantial **"Conflicts & questions for the user"**
section listing every assumption and the naming-caution reconciliation. Wrap prose
at ~80 columns. Do not modify any other file, and do **not** edit anything under
`docs/requirements/rules/`.

Before finishing, self-check: each Area 6 sub-area has at least one story; the
Announcer/Timekeeper is never conflated with the Scorer; timer/callout timing
ties to the rules' working time; the provisional nature and every assumption are
explicit; no Future-Enhancement or other-role dependencies; every story cites its
sub-area.
