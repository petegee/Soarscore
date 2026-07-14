# [STORY-001-035] Mark a Pilot Cannot Make the Group (No-Score)

> Source: `docs/user-stories/03-scorer.md` §5.0.5 ·
> `docs/requirements/high-level-requirements.md` Area 5.0, 5.7 · relates to
> STORY-001-034 (the confirmation guard this action satisfies),
> STORY-001-031 (no-score resolution), STORY-001-032 (prep gate)
> Module: 001 (Organiser MVP) · Estimated effort: **2 days**

### Background

A **no-score** is *did-not-fly* — a different thing from a **zero**, which is
*flew and scored zero*. When the pilot beside a Scorer genuinely cannot make
the group, the Scorer needs a way to say so that both records the correct
did-not-fly state and satisfies their outstanding confirmation obligation, so
the group is not held indefinitely by the prep gate waiting on a pilot who
will never arrive. This story is deliberately narrow: the Scorer only **raises**
the no-score. Resolving it — moving the pilot into a later group, retiring
them, or the automatic end-of-round conversion to a zero — is Contest
Director/Organiser authority (STORY-001-031).

### Business Value

- Prevent a group being held open indefinitely by the prep gate on account of a
  pilot who is a genuine no-show.
- Preserve the did-not-fly / zero distinction at the point of capture, so
  downstream resolution starts from an honest state.
- Give the Scorer a clean way to satisfy their confirmation obligation without
  inventing or forcing a fake pilot selection.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-034 (the per-group confirmation guard this
  action satisfies).
- **Data assumptions**: a no-score is a distinct per-(pilot, round) state, not a
  zero value and not a captured flight result.
- **Integration points**: satisfies the Scorer's outstanding confirmation for
  the group so the Contest Director's prep gate (STORY-001-032) is not held
  open on this pilot's account; the resulting no-score is resolved downstream
  by the Contest Director (STORY-001-031).
- **Business constraints**: the Scorer only raises the no-score — resolving it
  (readiness move, retirement, or end-of-round auto-zero) is out of scope here.

### Scope In

- Marking the pilot beside the Scorer as unable to fly this group.
- Recording that mark as a **no-score**, distinct from a captured zero, with no
  flight metrics captured for that pilot in this group.
- Satisfying the Scorer's outstanding confirmation obligation for the group so
  the prep gate is not held open on their account.

### Scope Out

- Resolving the no-score (readiness move into a later group, retirement, or the
  end-of-round auto-zero) — STORY-001-031.
- The Contest Director's own prep-gate release forms ("device offline" /
  "pilot unconfirmed") — STORY-001-032.
- Selecting and confirming a pilot who **is** flying — STORY-001-034.

### Acceptance Criteria

#### AC1: Marking cannot-make-the-group records a no-score, not a zero
**Given** John Brown is beside me for round 4 group 2 but will not fly
**When** I mark him as cannot make the group
**Then** a no-score is recorded for John Brown in round 4 — distinct from a
zero — and no flight metrics are captured for him in this group.

#### AC2: Marking satisfies my outstanding confirmation
**Given** the prep gate is holding round 4 group 2's countdown at one minute
because my confirmation is outstanding
**When** I mark John Brown as cannot make the group
**Then** my device's confirmation obligation for the group is satisfied and
the group is not held open on my account.

#### AC3: A no-score is not something I resolve
**Given** I have marked John Brown a no-score for round 4
**When** the round proceeds
**Then** resolving it — moving him into a later group, retiring him, or an
end-of-round auto-zero — happens elsewhere; my device does not offer me any of
those actions.

### INVEST Check

Independent (a single, narrow raise-only action layered on the existing
confirmation guard) · Valuable (keeps a genuine no-show from stalling the prep
gate and preserves the did-not-fly distinction) · Small (2 days, 2 functional
points: record the no-score, satisfy the confirmation) · Testable (the
no-score/zero distinction and the confirmation release are both directly
observable).
