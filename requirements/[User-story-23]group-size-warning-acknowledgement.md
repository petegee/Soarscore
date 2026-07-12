# Story Decomposition: Group-Size-Warning Acknowledgement in the Companion App

## INVEST Analysis

### Abstract Task: "Group-Size-Warning Acknowledgement"

**Analysis Dimensions**:
- **Core Responsibility**: give the Contest Director a companion-app way to
  see a generated draw's rule-fixed group-size-minimum warnings
  (STORY-001-022) and explicitly acknowledge each one before accepting the
  draw — and retire the Draw Specification Editor's now-inert numeric
  `minGroupSizeOverride` field, which STORY-001-022 superseded as the route
  past a minimum. Without this, STORY-001-022's backend mechanism is built
  but has no operator surface: a Contest Director cannot pass
  `acknowledgedWarningIds` at all today, so accepting a warned draw always
  fails with `DrawGroupSizeWarningUnacknowledgedError` and no way through.
- **Primary Operations**: display each `groupSizeWarnings` entry on the
  candidate draw in the draw workflow screen; let the Contest Director tick
  an acknowledgement per warning; send the acknowledged warning ids on
  accept; remove (or visibly disable, with an explanatory note) the
  `minGroupSizeOverride` field and its helper copy in the Draw Specification
  Editor.
- **Key Constraints**: acceptance remains **one decision for the whole
  draw** (STORY-001-017) — acknowledging warnings is a precondition of that
  one accept action, not a per-task or per-warning accept; a draw with zero
  `groupSizeWarnings` must accept exactly as it does today, with no new
  friction; the companion app is stateless (D8) — acknowledgement state
  lives only as the pending in-form selection until the accept call carries
  it, never persisted client-side ahead of that call.
- **Technical Complexity**: Low–Medium — the backend contract already exists
  (`GeneratedDraw.groupSizeWarnings`, `DrawDecisionRequest.acknowledgedWarningIds`,
  `DrawGroupSizeWarningUnacknowledgedError`); this is a presentation and
  request-wiring change over `DrawView.tsx` and `apps/companion/src/draw/api.ts`,
  plus a small deletion in `DrawSpecView.tsx`.
- **Business Complexity**: Low — the underlying policy (warn, generate
  anyway, require acknowledgement) is already settled by D14/STORY-001-022;
  this is purely about making that policy operable.

### INVEST Evaluation
- ✅ **Independent**: depends only on STORY-001-022's already-shipped backend
  contract; does not depend on STORY-001-020/021's per-task presentation
  work (this story's warnings ride `GeneratedDraw` today regardless of
  whether the draw is single- or multi-task).
- ✅ **Negotiable**: exact acknowledgement UX (a checkbox per warning vs. one
  "I acknowledge all warnings above" control) is open for design.
- ✅ **Valuable**: without this, STORY-001-022's warn-and-override mechanism
  is generated but unreachable — a Contest Director whose roster falls short
  of a class's rule-fixed minimum can generate a draw but can never accept
  it, which is a harder block than the silent numeric override it was meant
  to replace.
- ✅ **Estimable**: a bounded presentation and request-wiring change over a
  known, already-shaped API response.
- ✅ **Small**: ~1–2 days, two functional points (warning display +
  acknowledgement on accept; retiring the dead override field).
- ✅ **Testable**: the warned/unwarned accept paths, the acknowledgement
  gate, and the retired override field are all directly observable.

**Conclusion**: Ready as-is — single companion-app story, carved out because
STORY-001-022 (like STORY-001-009/019 and STORY-001-020/021 before it)
deliberately scoped its companion-app presentation out as follow-on work.

**Split strategy**: not split further — the warning-acknowledgement surface
and the dead-field retirement are two small edits to the same screen pairing
(Draw spec editor emits the now-superseded field; the draw workflow screen
is where its replacement's consequence — the warning — must be resolved), so
splitting them into separate stories would fragment one coherent "retire the
old mechanism, operate the new one" unit of value.

---

## [STORY-001-023] Group-Size-Warning Acknowledgement in the Companion App

> Source: `docs/requirements/decisions.md` D14 (rule-fixed group-size minima
> are advisory: warn and require override) · STORY-001-022 (backend
> warn-and-override mechanism this story presents — **done**, companion-app
> presentation explicitly scoped out) · STORY-001-017 (accept/re-draw
> decision, unchanged by this story) · STORY-001-018 (draw workflow screen,
> extended here) · STORY-001-019 (draw specification editor, whose
> `minGroupSizeOverride` field this story retires) · `docs/requirements/companion-app.md`
> §1 (role-oriented views, every mutating action to the base)
> Module: 001 (Organiser MVP) · Estimated effort: **1–2 days**

### Background

STORY-001-022 replaced the pre-emptive, numeric `minGroupSizeOverride` field
with a warn-and-generate policy: when a task's rule-fixed group-size minimum
cannot be met by the roster, the base generates the closest compliant
grouping anyway and attaches a `groupSizeWarnings` entry to the candidate
draw, which `accept()` now refuses to promote until every warning's id
appears in `acknowledgedWarningIds`. That backend mechanism is fully built
and tested, but neither companion-app screen was updated: the draw workflow
screen (`DrawView.tsx`) does not render `groupSizeWarnings` and `acceptDraw()`
never sends `acknowledgedWarningIds`, so a Contest Director facing a warned
draw hits `DrawGroupSizeWarningUnacknowledgedError` on Accept with no way to
resolve it from the UI. Separately, the Draw Specification Editor
(`DrawSpecView.tsx`) still presents the numeric `minGroupSizeOverride` field
and its "Relaxes the per-group minimum size" helper copy as if it were live,
even though `DrawService.resolveMin` no longer reads it — the field is
inert and actively misleading. This story closes both gaps: it gives the
Contest Director a way to see and acknowledge group-size warnings before
accepting, and it retires the dead override field so the editor no longer
promises a mechanism that does nothing.

### Business Value

- Make STORY-001-022's warn-and-override policy actually usable — today it
  is a backend capability with no operator path to the "override" half of
  its name.
- Prevent an Organiser from being misled by a numeric field that looks like
  it relaxes a bound but has had zero effect since STORY-001-022 shipped.
- Preserve the Contest Director's authority (D1) with a visible, per-warning
  acknowledgement, consistent with the audited-deviation trust model
  (CLAUDE.md, D4).

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-022 (`groupSizeWarnings`,
  `acknowledgedWarningIds`, `DrawGroupSizeWarningUnacknowledgedError` —
  **done**); STORY-001-018 (the draw workflow screen this story extends —
  **done**); STORY-001-019 (the draw specification editor this story trims a
  field from — **done**).
- **Data assumptions**: `GeneratedDraw.groupSizeWarnings` is `[]` for any
  draw with no shortfall (the overwhelming majority), so the unwarned accept
  path must show no new UI and require no new action. `ConstraintWarning.id`
  is present only on warnings that gate acceptance (STORY-001-022) —
  distinct from the pre-existing non-gating anti-repeat/consecutive-flight
  advisories already shown on this screen and on the Draw spec screen, which
  carry no `id` and must not be conflated with a gating warning.
- **Integration points**: `apps/companion/src/draw/api.ts`'s `acceptDraw`
  gains an `acknowledgedWarningIds` parameter threaded from `DrawView.tsx`;
  `DrawSpecView.tsx` drops the `minGroupSizeOverride` form field, its state,
  and its wire-up in `buildRequestBody`/`seedForm` (the shared
  `SaveDrawSpecRequest`/`DrawSpecification` type keeps the field for
  backward compatibility with already-saved specs, per STORY-001-022's shared
  schema note — only this screen's presentation of it is removed).
- **Business constraints**: offline-first (D6); the companion app remains
  stateless (D8) — acknowledgement is form state only until submitted.

### Scope In

- Displaying each `groupSizeWarnings` entry on the awaiting-decision
  candidate in the draw workflow screen, distinguishable from the existing
  non-gating advisories already shown there.
- A per-warning (or equivalent single "acknowledge all") control the Contest
  Director must set before Accept is enabled, whenever `groupSizeWarnings`
  is non-empty; Accept behaves exactly as today (no new control, no extra
  step) whenever it is empty.
- Sending the acknowledged warning ids on the accept call.
- Surfacing `DrawGroupSizeWarningUnacknowledgedError`'s message if a
  concurrent client's regenerate changed the candidate's warnings between
  render and accept (mirrors the existing 409-reconciliation pattern in
  `handleDecision`).
- Removing the `minGroupSizeOverride` input, its label and its helper copy
  from the Draw Specification Editor.

### Scope Out

- Any change to the accept/re-draw decision's one-decision-per-draw shape —
  STORY-001-017 (unchanged); acknowledgement is a precondition of that one
  decision, not a new decision.
- Per-task warning presentation (STORY-001-020/021's per-task composition
  and fairness display) — this story's warnings render against whatever
  shape `GeneratedDraw` has today; if STORY-001-020 lands first and changes
  that shape, reconciling the two is that story's or a further follow-on's
  concern, not this one's.
- Any change to the warning-generation or acknowledgement-gating logic
  itself — STORY-001-022 (done); this story only presents and wires it.
- Migrating or backfilling already-saved specs that carry a non-null
  `minGroupSizeOverride` from before this story — the field is inert
  wherever it is read, so no data migration is needed.

### Acceptance Criteria

#### AC1: A draw with no group-size warnings accepts exactly as before
**Given** a generated draw whose `groupSizeWarnings` is empty
**When** the Contest Director opens the draw workflow screen and accepts
**Then** the screen shows no warning UI and no acknowledgement control, and
Accept succeeds in one action, unchanged from today's behaviour.

#### AC2: A warned draw shows its warning and blocks Accept until acknowledged
**Given** a generated draw carrying one `groupSizeWarnings` entry (e.g. an
F3J roster of 5 against a rule-fixed minimum of 6)
**When** the Contest Director opens the draw workflow screen
**Then** the warning's message is displayed and Accept is disabled (or
rejected with the base's message) until the Contest Director explicitly
acknowledges it.

#### AC3: Acknowledging the warning and accepting records the deviation
**Given** the same warned draw
**When** the Contest Director acknowledges the warning and accepts
**Then** the accept call carries the warning's id in `acknowledgedWarningIds`,
the draw is accepted, and the screen reflects the accepted status — the
underlying audit record (warning + acknowledgement) is STORY-001-022's
concern, already satisfied by the base.

#### AC4: A stale warning set is reconciled, not silently bypassed
**Given** a warned candidate the Contest Director has acknowledged locally,
but a concurrent client regenerated the draw before this Accept was sent
**When** the Accept call reaches the base against the superseded candidate
**Then** the screen surfaces the resulting error/mismatch and refreshes to
the current candidate, mirroring the existing candidate-superseded
reconciliation — a stale acknowledgement never silently attaches to a
different candidate's warnings.

#### AC5: The Draw Specification Editor no longer offers the dead override field
**Given** the Draw Specification Editor
**When** the Organiser opens it, for a spec saved before or after this story
**Then** no `minGroupSizeOverride` field or helper copy is shown, because the
mechanism it controlled has been superseded by STORY-001-022's
warn-and-acknowledge flow.

#### Non-Functional Expectations
- The screen works entirely over the base's local Wi-Fi with no internet
  connection (offline-first, D6).
- The warning's full message (naming the task and rule clause, per
  STORY-001-022) is shown verbatim, never summarised or truncated, so the
  Contest Director can judge the deviation on its merits before
  acknowledging it.

### INVEST Check

Independent (a presentation and request-wiring change over STORY-001-022's
already-shipped backend contract) · Valuable (makes the warn-and-override
policy actually usable, and stops the editor from promising a dead
mechanism) · Small (1–2 days, 2 functional points: warning display and
acknowledgement on accept, dead-field retirement) · Testable (the
warned/unwarned accept paths, the acknowledgement gate, and the retired
field are all directly observable).
