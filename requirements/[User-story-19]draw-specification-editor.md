# Story Decomposition: Companion-App Draw Specification Editor

## INVEST Analysis

### Abstract Task: "Draw Specification Editor"

**Analysis Dimensions**:
- **Core Responsibility**: give the Organiser a companion-app surface to set
  and save the draw specification — draw mode, groups-per-round, the optional
  consecutive-flight constraint and the lane-allocation policy — so that a
  draw can be generated at all. This is the operator surface for Area 4.1,
  whose validation and storage backend already exists (STORY-001-009).
- **Primary Operations**: view the current specification, edit its fields,
  save it (subject to the backend's bounds validation).
- **Key Constraints**: groups-per-round is bounded both ways — a per-task
  class minimum and a roster-derived maximum (at least two groups per
  qualifying round), relaxable by explicit override when spare scorers are
  present (Area 4.1); the consecutive-flight constraint is off by default;
  every save is submitted to the base with actor identity (companion §1, D4);
  the client is stateless — the specification lives on the base.
  **[Superseded 2026-07-13, decisions.md D14; UI updated by STORY-001-023]**:
  the per-task class minimum described here is no longer save-time-rejectable
  — it is advisory (warn at generate, require Contest Director
  acknowledgement at accept), per STORY-001-022, presented in the draw
  workflow screen by STORY-001-023. The numeric `minGroupSizeOverride` field
  this story built has been **removed** from this screen by STORY-001-023.
  Only the roster-derived two-groups-per-round floor (AC3/AC4 below) remains
  a hard save-time bound on this screen.
- **Technical Complexity**: Low (a form over an existing validated
  save endpoint; no new backend).
- **Business Complexity**: Low–Medium (a handful of fields and the
  bounds/override interaction, all already enforced server-side).

### INVEST Evaluation
- ✅ **Independent**: sits entirely on the completed STORY-001-009 spec
  storage + validation backend; needs no other unfinished story.
- ✅ **Negotiable**: form layout and how bounds/overrides are presented is
  open.
- ✅ **Valuable**: without a saved specification, generation cannot run and
  the whole draw chain (STORY-001-018 and below) is unreachable.
- ✅ **Estimable**: a bounded form over a known endpoint.
- ✅ **Small**: ~2 days, three cohesive functional points.
- ✅ **Testable**: each field, the bounds rejection and the saved-state
  recovery are observable.

**Conclusion**: Ready as-is — single story. It was carved out once analysis of
STORY-001-018 showed its AC1 ("a valid draw specification exists") had no
companion surface to create one, even though the backend to store and validate
it was already built in STORY-001-009.

---

## [STORY-001-019] Companion-App Draw Specification Editor

> Source: `docs/requirements/high-level-requirements.md` Area 4.1 (Draw
> Specification — draw mode, groups-per-round bounds, consecutive-flight
> constraint, lane-allocation policy) · `docs/requirements/companion-app.md`
> §1 (role-oriented views, name-pick identity, every mutating action to the
> base) · `docs/requirements/decisions.md` D4 (immutable event log), D8
> (headless base + companion client) · `docs/requirements/rules/` (per-task
> group-size minima)
> Module: 001 (Organiser MVP) · Estimated effort: **2 days**
>
> **Status note (2026-07-13, updated 2026-07-13):** shipped and correct as of
> STORY-001-009's backend, but `docs/requirements/decisions.md` D14 superseded
> the `minGroupSizeOverride`/AC2 save-time-rejection mechanism this story
> built (STORY-001-022's backend policy). **STORY-001-023 has since shipped**
> the corresponding UI change on this screen — the `minGroupSizeOverride`
> field is removed; see the AC2 note below for what replaced it (presented on
> the draw workflow screen, STORY-001-018/021, not here).

### Background

STORY-001-009 built the draw specification's storage and validation — the
bounds on groups-per-round (a per-task class minimum such as F3J/F5J 6 or F3K
5, and a roster-derived maximum of at least two groups per qualifying round),
the optional consecutive-flight constraint, and the lane-allocation policy —
but the base station is headless, so there is no way for an Organiser to
actually set that specification. STORY-001-018 (the draw workflow screen)
assumes a saved specification already exists so it can generate; without one,
generation fails and the whole draw chain is unreachable. This story adds the
missing operator surface: a companion-app screen where the Organiser reviews
the current draw specification, edits its fields, and saves it — with the
base's existing validation rejecting out-of-bounds values and explaining the
bound. It is deliberately separate from the draw workflow screen, which is
about deciding on a *generated* draw, not specifying one.

### Business Value

- Provide the Organiser with the place to set how the draw will be composed
  before any draw is generated.
- Support the Area 4.1 bounds and override rules by surfacing the backend's
  validation and its explanation to the operator.
- Enable draw generation and the entire downstream draw chain
  (STORY-001-018 and below), which cannot begin without a saved specification.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-009 (draw specification storage, bounds
  validation and the save endpoint — **done**); a competition with an
  established roster (STORY-001-005) and discipline/task configuration
  (STORY-001-004) exists, since the bounds are roster- and task-derived.
- **Data assumptions**: the base owns the specification and validates it; the
  companion app is stateless and fetches the current specification from the
  base. Operator identity comes from the companion name-pick — no login.
- **Integration points**: submits the saved specification to the base, landing
  in the immutable event log with originating client and actor identity (D4).
  A saved specification is the precondition STORY-001-018 needs to generate a
  draw.
- **Business constraints**: offline-first — the screen works over the base's
  local Wi-Fi with no internet (D6). This story does not change the validation
  rules themselves; those are STORY-001-009 and the rule docs.

### Scope In

- A draw specification screen in the companion app: view the current
  specification and edit its fields — draw mode, groups-per-round, the optional
  consecutive-flight constraint (off by default), and the lane-allocation
  policy.
- Save the specification to the base, surfacing the backend's acceptance or its
  bounds rejection with the explanation of the bound (including the
  spare-scorer override path). *(The class-rule-minimum half of this bound is
  superseded by D14/STORY-001-022, and this screen's UI was updated by
  STORY-001-023 to match — see AC2 note; the spare-scorer/two-groups floor is
  unaffected.)*
- Recover and display the currently saved specification when the screen opens
  on any companion client.

### Scope Out

- The bounds/validation rules and their storage — STORY-001-009 (done); this
  screen only drives and surfaces them.
- Generating, displaying and deciding on a draw — STORY-001-018.
- The draw-generation algorithm and fairness computation — STORY-001-009.
- Editing the roster, discipline or task configuration that the bounds derive
  from — STORY-001-005 / STORY-001-004.

### Acceptance Criteria

#### AC1: Set and save a valid specification
**Given** a competition with a 14-pilot roster and an F5J task, and no draw
specification yet saved
**When** the Organiser sets the draw mode, groups-per-round to 2, leaves the
consecutive-flight constraint off, chooses a lane-allocation policy and saves
**Then** the specification is stored on the base, recorded with who saved it,
and the competition is now ready for a draw to be generated.

#### AC2: Out-of-bounds groups-per-round is rejected with the bound explained — **superseded, no longer this screen's behaviour**
**Given** a 14-pilot roster and an F5J task whose groups need at least 6 pilots
**When** the Organiser sets groups-per-round to 4 (which would force groups
below the minimum) and saves
**Then** ~~the save is rejected and the screen explains the bound implied by
the roster size and the class group minimum, and no specification is stored
from that attempt~~.

> **[Superseded 2026-07-13, decisions.md D14 / STORY-001-022; UI landed
> 2026-07-13, STORY-001-023]**: a per-task class rule-fixed minimum (as
> opposed to the roster-derived two-groups floor in AC3, which is unaffected
> and still save-time-rejected) is no longer a save-time rejection anywhere
> in the system. This screen now saves the specification as given; the save
> in the example above **succeeds**. Generation instead produces the closest
> compliant grouping and attaches a warning naming the task and rule clause,
> which the draw workflow screen (STORY-001-018/021, acknowledgement UI by
> STORY-001-023) requires the Contest Director to acknowledge before
> accepting. The `minGroupSizeOverride` field this AC originally validated
> has been removed from this screen. This AC is retained here only as a
> historical record of STORY-001-019's original scope — see
> `[User-story-23]group-size-warning-acknowledgement.md` for the current
> acceptance criteria covering this flow.

#### AC3: Too-few-groups is rejected
**Given** a 14-pilot roster
**When** the Organiser sets groups-per-round to 1 (leaving no non-flying pilots
to score the flying group) and saves without the spare-scorer override
**Then** the save is rejected and the screen explains that at least two groups
per qualifying round are required unless the spare-scorer override is set.

#### AC4: The spare-scorer override is honoured
**Given** the same roster where spare non-flying scorers are present
**When** the Organiser sets the spare-scorer override and saves a single-group
specification
**Then** the base accepts it, because the override explicitly relaxes the
two-group minimum.

#### AC5: Editing an existing specification
**Given** a specification was saved earlier with the consecutive-flight
constraint off
**When** the Organiser opens the screen, turns the constraint on and saves
**Then** the updated specification replaces the previous one and the change is
recorded with who made it.

#### AC6: The screen recovers the saved specification from the base
**Given** a specification was saved earlier and the operator's laptop is
replaced by another companion client
**When** the new client opens the draw specification screen
**Then** it shows the current saved specification fetched from the base,
because the client holds no specification state of its own.

#### Non-Functional Expectations
- The screen works entirely over the base's local Wi-Fi with no internet
  connection (offline-first, D6).
- A companion client can leave, sleep or be replaced without affecting the
  specification held on the base (stateless client, D8).

### INVEST Check

Independent (a form over the finished STORY-001-009 spec backend) · Valuable
(no draw can be generated, and the whole draw chain is blocked, until a
specification exists) · Small (2 days, 3 functional points: edit fields, save
with validation feedback, recover saved state) · Testable (each field, the
bounds rejection and recovery are observable).
