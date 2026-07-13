# SPDD Analysis: Group-Size-Warning Acknowledgement in the Companion App

## Original Business Requirement

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

## Domain Concept Identification

#### Existing Concepts (from codebase)
- `GeneratedDraw.groupSizeWarnings` (`packages/shared/src/draw.ts:152`): the
  candidate draw's array of `ConstraintWarning`, populated by
  `DrawService` (STORY-001-022) whenever the resolved group-size minimum
  couldn't be met — the data this story must render.
- `ConstraintWarning` (`packages/shared/src/draw.ts:163`): `{ constraint,
  message, id? }`. The optional `id` is the acknowledgement-gating
  discriminator — present only for group-size-minimum warnings, absent for
  the pre-existing non-gating anti-repeat/consecutive-flight advisories that
  `DrawView.tsx` and `DrawSpecView.tsx` already render via
  `DrawEvidenceView.warnings` (a *separate* array from
  `GeneratedDraw.groupSizeWarnings` — two different warning surfaces on two
  different objects, both already partly rendered today).
- `DrawDecisionRequest.acknowledgedWarningIds` (`packages/shared/src/draw.ts:242`):
  the accept/cancel request field, already `z.array(z.string()).default([])`
  — a client that omits it behaves exactly as before. This story is the
  first caller to ever populate it.
- `DrawGroupSizeWarningUnacknowledgedError` (`apps/base/src/draw/errors.ts:72`,
  code `DRAW_GROUP_SIZE_WARNING_UNACKNOWLEDGED`): thrown by
  `DrawService.accept()` (`apps/base/src/draw/service.ts:300-334`) when any
  warning's `id` is missing from `acknowledgedWarningIds`; the message lists
  the missing ids. Currently surfaces to the companion UI only as an
  unlabelled `ApiError` with no recovery path.
  `handleDecision`'s existing catch (`DrawView.tsx:356-365`) already routes
  any `ApiError` (including this one) to `setAlert` + `refresh()`, which is
  the exact 409-style reconciliation AC4 asks for — no new error-handling
  branch, just a payload change to the call that triggers it.
- `DrawSpecification.minGroupSizeOverride` /
  `SaveDrawSpecRequest.minGroupSizeOverride`
  (`packages/shared/src/draw.ts:55,209-214`): the pre-022 numeric override,
  still present in the shared schema/type (kept for backward compatibility
  per the story's own note) but no longer read by `DrawService.resolveMin`.
  `DrawSpecView.tsx` is the only remaining place that surfaces it — as a
  live-looking input (`spec-min-group-size`, lines 282-302) with helper copy
  claiming it "relaxes the per-group minimum size."
- `handleDecision` / `acceptDraw` seam
  (`DrawView.tsx:342-366`, `apps/companion/src/draw/api.ts:38-46`): the
  existing accept/cancel call path and its 409-reconciliation pattern
  (candidate superseded → alert + refresh) that this story's AC4 must mirror
  rather than reinvent.
- `evidence.warnings` non-gating advisory rendering
  (`DrawView.tsx:402-407`, `DrawSpecView.tsx:313-323`): the existing pattern
  for rendering a `ConstraintWarning[]` as a `<span className="badge">` +
  message — the visual vocabulary this story's *gating* warning display must
  be distinguishable from (AC2 explicitly requires this), not a template to
  copy verbatim.

#### New Concepts Required
- **Acknowledgement form state**: transient, per-candidate selection (which
  `groupSizeWarnings[].id`s the CD has ticked) held only in `DrawView.tsx`
  component state — never persisted, reset whenever the candidate changes
  (new generate/regenerate or a refresh after a 409), consistent with the
  companion app's statelessness (D8).
- **Accept-gating derived from acknowledgement state**: the Accept button's
  `disabled` condition must be extended from today's single `busy` check to
  additionally require every `groupSizeWarnings[].id` to be present in the
  local acknowledgement selection — a purely client-side UX gate, since the
  base is the authoritative enforcer (`DrawGroupSizeWarningUnacknowledgedError`)
  regardless of what the client permits.
- **Gating-warning visual treatment**: a badge/style distinct from the
  existing `advisory` badge (AC2's "distinguishable from the existing
  non-gating advisories" requirement) — exact treatment is a design decision
  for REASONS Canvas, not fixed by this analysis.

#### Key Business Rules
- **Acceptance stays one decision for the whole draw** (STORY-001-017,
  reaffirmed here): acknowledging warnings is a *precondition* gating the
  existing single Accept action — never a separate per-warning or per-task
  accept step. Governs: the Accept button/handler, not a new endpoint or
  decision type.
- **Zero-friction unwarned path** (AC1): when `groupSizeWarnings` is empty,
  no new UI element may appear and Accept must behave identically to
  pre-story behaviour. Governs: the conditional rendering guard around the
  new warning/acknowledgement UI.
- **`id`-presence is the gating discriminator** (D14/STORY-001-022): only
  `ConstraintWarning` entries carrying an `id` gate acceptance; entries
  without one (the pre-existing advisories) must never be conflated with a
  gating warning or accidentally required for acknowledgement. Governs:
  which warnings this story renders with an acknowledgement control vs.
  which stay as-is.
- **Client-side gating is UX only, base is authoritative** (D8, D4): the
  Accept button being enabled client-side is a convenience — the base's
  `DrawService.accept()` re-validates against its own current
  `groupSizeWarnings` and rejects with
  `DrawGroupSizeWarningUnacknowledgedError` if the sets don't match
  (including the stale-candidate race in AC4). Governs: the story must not
  treat client-side gating as sufficient; the 409-style catch/refresh path
  remains mandatory.
- **Backward-compatible shared schema, presentation-only removal** (per the
  story's own Integration point): `minGroupSizeOverride` stays in
  `SaveDrawSpecRequest`/`DrawSpecification` — only `DrawSpecView.tsx`'s
  rendering of it is removed. Governs: scope of the AC5 change — no shared
  schema edit, no base-side change, no data migration.
- **Warning message shown verbatim, never truncated** (Non-Functional
  Expectations): the full `ConstraintWarning.message` (task + rule clause)
  must render unmodified so the CD can judge the deviation. Governs: the
  warning-rendering component must not summarise, ellipsize, or otherwise
  transform `message`.

## Strategic Approach

#### Solution Direction
- Pure presentation and request-wiring change confined to three files:
  `apps/companion/src/draw/DrawView.tsx` (render `groupSizeWarnings`,
  collect acknowledgement selection, gate/extend the Accept action),
  `apps/companion/src/draw/api.ts` (`acceptDraw` gains an
  `acknowledgedWarningIds: string[]` parameter, threaded straight into the
  existing POST body alongside `drawId`), and
  `apps/companion/src/draw/DrawSpecView.tsx` (delete the
  `minGroupSizeOverride` field, its `SpecFormState` slot, and its
  `buildRequestBody`/`seedForm` wiring — while still submitting a `null` for
  that field in `buildRequestBody`, since the shared schema still expects
  it). No base, event-log, or shared-schema changes — the entire backend
  contract (STORY-001-022) is already shipped and tested.
- Data flow: `DrawView`'s existing `refresh()` already fetches
  `GeneratedDraw` (via `getDraw` → `DrawEvidenceView.candidate`), so
  `groupSizeWarnings` is already in hand on every render — no new fetch.
  Acknowledgement selection is local `useState` (e.g. a `Set<string>` of
  acknowledged ids) scoped to `DrawView`, read only at Accept-click time to
  build the array passed to `acceptDraw`. On the AC4 stale-candidate path,
  the existing `handleDecision` catch already calls `refresh()`, which
  replaces `evidence.candidate` — the acknowledgement `Set` should be reset
  whenever the candidate's `id` changes (new candidate → warnings can only
  be re-earned by re-acknowledging).
- Leverage existing architectural patterns already visible in this same
  screen: the `evidence.warnings` advisory-rendering pattern
  (`<span className="badge">advisory</span> {message}`) for visual
  vocabulary, adapted with a distinguishing style per AC2; the
  `handleDecision`/`ApiError`/`setAlert`+`refresh()` reconciliation pattern
  for AC4, reused unmodified; the `busy`-gated toolbar-button pattern for
  extending Accept's `disabled` condition.

#### Key Design Decisions
- **Per-warning checkbox vs. single "acknowledge all" control**: the story
  explicitly leaves this open (Negotiable in the INVEST Analysis). Trade-off
  — per-warning checkboxes give the clearest 1:1 audit correspondence to
  `acknowledgedWarningIds` and scale naturally if a future multi-task draw
  carries several independent task-qualified warnings (the `id` naming
  convention `group-size-minimum:<taskId>` already anticipates this per the
  `GeneratedDraw.groupSizeWarnings` comment); a single "acknowledge all"
  control is less friction for the common single-warning case but loses
  per-item granularity and would need to map to *all* current ids at accept
  time regardless of count. → **Recommend per-warning checkboxes**: today's
  MVP typically surfaces at most one warning per draw, so the friction
  difference is negligible, but per-warning controls avoid a future rework
  when STORY-001-020's per-task warnings become common, and they give the
  clearest audit-trail correspondence between what was shown and what was
  sent.
- **Where acknowledgement state resets**: on any new `refresh()` (covers
  regenerate and the AC4 stale-candidate reconciliation) vs. only on an
  explicit candidate-id change. Trade-off — resetting on every `refresh()`
  is simplest but would also clear acknowledgement on an unrelated refresh
  (e.g. tab visibility re-fetch, if ever added) even when the candidate is
  unchanged; keying the reset off `candidate.id` changing is more precise
  but requires tracking the previous id. → **Recommend keying off
  `candidate.id` change** (e.g. `useEffect` comparing to a ref, or deriving
  the acknowledgement `Set` fresh whenever `candidate` changes) — it is the
  correct semantic (a stale acknowledgement must never survive a candidate
  swap, AC4) and is a small, well-understood React pattern already
  implicitly needed since `DrawView` already re-derives everything from
  `evidence` each render.
- **How to handle the still-required `minGroupSizeOverride` in
  `buildRequestBody`**: since the shared `SaveDrawSpecRequest` schema still
  requires the field (nullable, defaults `null`), `DrawSpecView.tsx` must
  keep sending `minGroupSizeOverride: null` even after the form field is
  deleted, rather than trying to omit the key. Trade-off — none really; this
  is dictated by the existing shared schema, which the story explicitly
  scopes as unchanged. → **Recommend**: hardcode `null` in
  `buildRequestBody`, remove the field from `SpecFormState`/`seedForm`
  entirely (no dead state to carry).

#### Alternatives Considered
- **Removing `minGroupSizeOverride` from the shared schema/type entirely**:
  rejected — the story's own Integration-points note explicitly keeps it for
  backward compatibility with already-saved specs, and doing so would be an
  unrequested base/shared-schema change out of this story's scope.
  - **Server-side enforcement only, no client-side Accept gating** (rely
  solely on `DrawGroupSizeWarningUnacknowledgedError` for every warned
  accept attempt): rejected — AC2 explicitly requires Accept to be
  "disabled (or rejected with the base's message)," so a server-only path is
  allowed per the letter of the AC, but a client-side disable is the better
  UX (avoids a round-trip failure for the common case) and costs almost
  nothing to add given the acknowledgement state already exists locally;
  recommend implementing the disable, with the server rejection remaining as
  the authoritative backstop for the AC4 race.

## Risk & Gap Analysis

#### Requirement Ambiguities — Resolved
- **Acknowledgement control shape**: **per-warning checkbox**, each tied to
  its `ConstraintWarning.id`. Matches the data shape 1:1 and generalises
  without rework once STORY-001-020's per-task warnings can co-occur.
- **Visual distinguishing treatment**: a new badge class/label distinct from
  `advisory` (e.g. `warning` — "acknowledgement required"), styled more
  attention-grabbing than the neutral advisory badge, reusing the existing
  `<span className="badge">` pattern rather than a new UI element.
- **"Disabled (or rejected with the base's message)" phrasing in AC2**:
  resolved as **both** — client-side disable of Accept until every warning
  is ticked, *and* the server's `DrawGroupSizeWarningUnacknowledgedError`
  remains the authoritative backstop (needed regardless, for AC4's stale-
  candidate race).

#### Edge Cases
- **Multiple concurrent `groupSizeWarnings` entries** (e.g. a future
  multi-task draw per STORY-001-020 surfacing more than one task-qualified
  warning): the story's own Scope Out defers reconciling this with
  STORY-001-020/021's shape, but the *acknowledgement mechanism itself*
  (looping over `groupSizeWarnings`, collecting acknowledged ids) should
  naturally support N warnings without special-casing "exactly one," since
  the data shape (`ConstraintWarning[]`) already supports it today even in
  the single-task path.
  - **Regenerate while warnings are partially acknowledged — Resolved**:
  in-progress ticks are **discarded silently** on candidate change (no
  confirmation dialog). Consistent with D8 (nothing persisted ahead of the
  accept call); the existing Cancel-draw confirmation dialog is reserved for
  the one destructive action on this screen and is not extended here — a
  fresh candidate may carry a different warning set anyway.
- **A warning whose `id` is present but whose `constraint`/`message` changes
  between renders (same id, different text)** — not addressed by the AC set;
  low likelihood given `id` is meant to be stable per warning instance, but
  worth flagging since `handleDecision`'s reconciliation logic keys off
  candidate supersession (`drawId`), not per-warning content diffing.
- **Screen-reader / accessibility of the acknowledgement control**: not
  addressed by any AC; the existing codebase already uses
  `role="alert"`/`role="dialog"` patterns (`DrawView.tsx:384-386,404,491-493`)
  that a new control should follow for consistency, though this is
  implementation detail for REASONS Canvas, not a story-level gap.

#### Technical Risks
- **None significant** — this is confined to two already-tested,
  already-shipped backend contracts (STORY-001-022's warning generation and
  acknowledgement gating) being wired into an existing screen pair. No
  concurrency, performance, or data-integrity concern beyond the existing
  409-style candidate-supersession race, which the codebase already handles
  via `handleDecision`'s catch/refresh and which AC4 asks this story to
  mirror, not invent.
- **Minor risk**: `DrawSpecView.tsx`'s `extractFieldErrors` fallback
  (`error.response.details as { fieldErrors?: FieldErrors }`) currently
  defaults an unshaped error to `{ groupsPerRound: [message] }` — if any
  future validation error references `minGroupSizeOverride` by field name
  (unlikely now that the base doesn't validate it against roster/class-model
  bounds, per STORY-001-022 having moved that check elsewhere), removing the
  input means that field-specific error would have nowhere to render. Low
  risk given the field is inert server-side, but worth a quick grep during
  implementation to confirm no `fieldErrors.minGroupSizeOverride` reference
  remains reachable.

#### Acceptance Criteria Coverage
| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Unwarned draw accepts exactly as before, no new UI | Yes | Straightforward conditional-render guard on `groupSizeWarnings.length === 0`; no gap. |
| 2 | Warned draw shows message, Accept blocked until acknowledged | Yes | Control shape (checkbox vs. "acknowledge all") and visual distinguishing treatment are open design choices, not blockers — resolvable in REASONS Canvas. |
| 3 | Acknowledging + accepting sends ids, draw accepted | Yes | Direct extension of `acceptDraw`'s existing POST body; no gap. |
| 4 | Stale warning set reconciled via existing error/refresh pattern | Yes | `handleDecision`'s catch already does `setAlert` + `refresh()` for any `ApiError`; this AC needs no new error-handling branch, only confirmation the existing message is legible for this specific error code — worth a manual check that `DrawGroupSizeWarningUnacknowledgedError`'s message reads sensibly as a top-of-screen alert. |
| 5 | Draw Spec Editor no longer shows the dead field | Yes | Direct deletion of the `spec-min-group-size` input/label/hint block and its `SpecFormState`/`seedForm`/`buildRequestBody` wiring (retaining the hardcoded `null` submission per the shared-schema note); no gap. |
