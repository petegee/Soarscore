# SPDD Analysis: Companion-App Draw Specification Editor

> **Pure companion-app FRONTEND/UI story (Area 4.1).** STORY-001-009 already
> built the draw specification's storage AND its bounds validation; the base is
> headless, so this story adds the *only* missing piece — an Organiser screen to
> view, edit and SAVE that specification. It introduces **no new backend** and
> **no new persisted state**; it drives one already-built save endpoint and one
> already-built read-model over `PUT` / `GET /api/competitions/:id/draw/*`.
> This analysis's central job is to nail the exact save contract and the
> validation error codes the UI must surface — and to flag a real divergence:
> the story's "spare-scorer override that relaxes the two-group minimum"
> (AC3/AC4) is **not** what STORY-001-009 actually implemented.

## Original Business Requirement

> Reproduced verbatim from
> `requirements/[User-story-19]draw-specification-editor.md`.

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
  spare-scorer override path).
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

#### AC2: Out-of-bounds groups-per-round is rejected with the bound explained
**Given** a 14-pilot roster and an F5J task whose groups need at least 6 pilots
**When** the Organiser sets groups-per-round to 4 (which would force groups
below the minimum) and saves
**Then** the save is rejected and the screen explains the bound implied by the
roster size and the class group minimum, and no specification is stored from
that attempt.

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

---

## Domain Concept Identification

This is a **frontend/UI story** in a TypeScript monorepo. The companion app is
a Vite + React SPA (`apps/companion`) served by the headless Fastify base
(`apps/base`); domain types are shared through `@soarscore/shared`
(`packages/shared`). Every concept the screen needs already exists in code —
the type, the endpoints, the validation and the error mapping were all built by
STORY-001-009. This story is a **read-then-form-then-save** UI over a
fully-established contract, hosted by `CompetitionLibrary` like `RosterView`.

### Existing Concepts (from codebase)

- **DrawSpecification** (`packages/shared/src/draw.ts`): the saved fair-draw
  policy this screen edits. Fields: `drawMode` (`"random-anti-repeat"` — a
  single-member union, so a fixed value, not a real choice yet), `roundCount`
  (1–8), `groupsPerRound` (≥2), `fairnessMetric` (3-value enum), `lanePolicy`
  (3-value enum), `avoidConsecutiveFlights` (bool, default false),
  `minGroupSizeOverride` (positive int | null). `id`, `competitionId`,
  `classModelId` are **server-derived** — the UI never sends them.
- **SaveDrawSpecRequest / `saveDrawSpecRequestSchema`** (`draw.ts`): the exact
  request body the screen submits — the seven editable fields only. This is the
  authoritative shape; the Zod schema is what the base validates against.
  Structural bounds are baked into this schema: `roundCount` 1–8,
  `groupsPerRound` `.int().min(2)`, `minGroupSizeOverride`
  `.int().positive().nullable().default(null)`. **The `≥2` floor on
  groupsPerRound is a hard Zod bound, not a relaxable rule** (see Risks).
- **DrawEvidenceView** (`draw.ts`): the read-model the screen loads
  (`{ spec, candidate, warnings }`). The **save endpoint returns this same
  view**, so a successful save hands back the persisted `spec` plus AC2-style
  soft `warnings[]`. For this screen only `spec` (and `warnings`) matter;
  `candidate` is the STORY-001-018 concern.
- **ConstraintWarning** (`draw.ts`): non-blocking soft warnings that ride a
  *successful* save (`{ constraint, message }`) — e.g. "some pairings must
  repeat" (anti-repeat), or "two groups makes no-back-to-back very tight". The
  base computes these in `DrawService.computeWarnings`. The screen should
  render them as advisories, distinct from a hard rejection.
- **Spec-save endpoint** — `PUT /api/competitions/:competitionId/draw/spec`
  (`apps/base/src/routes/draw.ts` → `DrawService.saveSpec`). Body =
  `SaveDrawSpecRequest`; returns `DrawEvidenceView` (200 with JSON, **not**
  204). Appends a **`draw.specSaved`** event with `authority: "organiser"`
  attribution from the `X-Actor-Name` / `X-Client-Id` headers (D4). The spec id
  is **stable across re-saves** (`existing?.id ?? randomUUID()`), so editing
  replaces in place (AC5).
- **Evidence read endpoint** — `GET /api/competitions/:competitionId/draw`
  (`DrawService.getEvidence`). Returns `{ spec: null, candidate: null,
  warnings: [] }` when **no spec is saved yet** — a first-run empty view, **not**
  an error. `DRAW_SPEC_NOT_FOUND` (404) is thrown only when the *competition
  itself* is absent (or on generate-before-save), never for "no spec on an
  existing competition". This makes AC6 recovery and the AC1 first-run form
  clean — the screen always gets a well-formed view.
- **The three surfaced error codes** (confirmed in `apps/base/src/app.ts`
  `setErrorHandler`):
  - `VALIDATION_FAILED` (400) — Zod structural failures, `details` = Zod
    `flatten()` (`fieldErrors` keyed by field name). Fires for
    `groupsPerRound < 2`, `roundCount` outside 1–8, a non-positive/non-integer
    `minGroupSizeOverride`. This is the `extractFieldErrors` idiom RosterView
    already uses.
  - `DRAW_GROUP_SIZE_OUT_OF_BOUNDS` (409) — the AC2 cross-aggregate rejection:
    `groupsPerRound` outside `[2, min(floor(R/min), floor(R/2))]` for roster R.
    The message states the feasible range and the reason ("each group needs at
    least N scoring pilots… would force groups below the minimum").
  - `DRAW_SPEC_NOT_FOUND` (404) — competition absent; effectively "this
    competition doesn't exist", not a normal editing path.
- **`apiRequest` / `ApiError`** (`apps/companion/src/api/client.ts`): the fetch
  helper that stamps `X-Actor-Name` / `X-Client-Id` and throws `ApiError`
  (carrying `ErrorResponse { code, message, details }`) on non-2xx. Every call
  the screen makes goes through it.
- **`useActor` / `Actor`** (`apps/companion/src/identity/useActor.ts`): the
  name-pick identity providing `actorName` + persisted `clientId`, passed into
  every competition-scoped view.
- **`RosterView`** (`apps/companion/src/roster/RosterView.tsx`): the idiom this
  screen mirrors exactly — a `{ competitionId, actor, onBack }` component; a
  memoised `request` wrapping `apiRequest`; a `refresh()` that re-fetches base
  state on mount; a `loading` guard; `ApiError`-`code` branching; per-field
  `fieldErrors` with `role="alert"` `field-error` paragraphs; `role="dialog"`
  confirmation for the escalated (override) path.
- **`CompetitionLibrary`** (`apps/companion/src/competitions/CompetitionLibrary.tsx`):
  the competition-scoped host. It opens a competition via `openId` (client-side
  selection only, D8) and today renders `RosterView` **unconditionally** for an
  opened competition (line 162–166). The draw-spec screen is reached the same
  `openId` way — but the single-screen host needs a small sub-nav to fit both
  this and the STORY-001-018 draw screen (see Risks).
- **Reusable CSS** (`apps/companion/src/styles.css`): `form` / `form-actions` /
  `field-error` / `toolbar` / `btn` (`btn-primary`, `btn-small`, `btn-danger`)
  / `data-table` / `table-wrap` / `badge` / `status-text` / `dialog` /
  `dialog-backdrop`. The screen reuses these — no new design system.

### New Concepts Required (UI-only; no new domain/persistence)

- **Draw specification screen** — one competition-scoped React view (e.g.
  `apps/companion/src/draw/DrawSpecView.tsx`) reached from `CompetitionLibrary`
  alongside Roster. Loads the evidence read-model, presents the seven editable
  fields as a form pre-filled from `spec` (or class-agnostic defaults on first
  run), saves via the `PUT` endpoint, and surfaces acceptance / warnings /
  rejection.
- **Field presentation** — draw mode (single-value, effectively display-only or
  a one-option select), `roundCount` and `groupsPerRound` numeric inputs, the
  consecutive-flight **checkbox** (default off), the fairness-metric and
  lane-policy **selects**, and the min-group-size **override** input. These are
  the seven `SaveDrawSpecRequest` fields — no more, no less.
- **Validation-feedback rendering** — branch on `ApiError.code`:
  `VALIDATION_FAILED` → per-field `fieldErrors` (RosterView `extractFieldErrors`
  idiom); `DRAW_GROUP_SIZE_OUT_OF_BOUNDS` → a prominent `role="alert"` message
  (the backend already writes the human bound explanation, so the UI surfaces
  `message` verbatim rather than recomputing the bound).
- **Soft-warning rendering** — after a successful save, list the returned
  `warnings[]` as non-blocking advisories (distinct visual weight from an
  error). Implicit in the story ("surface the backend's acceptance") but worth
  making explicit.
- **First-run empty state** — `spec === null` renders the form at sensible
  defaults (drawMode fixed, avoidConsecutiveFlights false, minGroupSizeOverride
  null) so AC1 can author from scratch.

### Key Business Rules

- **The base owns validation; the client only surfaces it** (Area 4.1, story
  Scope Out): the screen must **not** re-implement the bound arithmetic. The
  feasible groups-per-round range depends on roster size *and* the class model's
  per-task `minGroupSize` (max over tasks) *and* the override — a computation
  that already lives in `DrawService.assertGroupBound`. The UI submits and
  displays the server's verdict + explanation (single source of truth).
- **Save = replace in place** (AC5): the spec id is stable, so re-saving
  supersedes; the immutable log keeps prior `draw.specSaved` events (D4). The UI
  treats every save as an idempotent "set the current spec".
- **Attribution on every mutation** (companion §1, D4): the `PUT` carries
  actor-name + client-id headers → `authority: "organiser"` attribution. AC1/AC5
  "recorded with who saved it" is satisfied by the existing header stamping — no
  UI work beyond using `apiRequest`.
- **Stateless client** (D8, AC6): the screen holds no spec state of its own; it
  always renders from the fetched `DrawEvidenceView.spec`, so a replacement
  client shows the same saved spec. No client-side persistence of the spec.
- **Consecutive-flight is opt-in, default off** (Decision #5): the checkbox
  starts unchecked; the schema `.default(false)` backs this.
- **Generate ≠ specify** (Scope Out): this screen never generates; producing and
  deciding on a draw is STORY-001-018. The two are separate competition-scoped
  screens.

---

## Strategic Approach

### Solution Direction

- Add a **competition-scoped React view** (`DrawSpecView`) that follows the
  `RosterView` idiom precisely: `{ competitionId, actor, onBack }`; a memoised
  `request` wrapping `apiRequest`; a `refresh()` that fires
  `GET /api/competitions/:id/draw` on mount; a `loading` guard; `ApiError`-`code`
  branching for feedback. Render the form from the fetched `spec` (or defaults
  when `spec === null`).
- **Data flow**: on open → `GET .../draw` (evidence) → populate the form from
  `spec`. On save → `PUT .../draw/spec` with the seven-field body → on success
  re-render from the returned `DrawEvidenceView.spec` and show `warnings[]`; on
  `ApiError` branch by `code` for field or bound feedback. This is the
  read → edit → save loop, all stateless (AC6).
- **Rendering & styling**: reuse `form` / `form-actions` / `field-error` /
  `toolbar` / `btn` / `status-text` / `badge` CSS. A checkbox for the
  consecutive-flight toggle; selects for the fairness-metric and lane-policy
  enums; numeric inputs for round count, groups-per-round and the override. No
  new CSS or component library.
- **Navigation**: reach the screen from `CompetitionLibrary` via the existing
  `openId` selection. Since an opened competition currently renders `RosterView`
  directly, introduce a **thin per-competition sub-nav** (Roster / Draw spec,
  and later Draw workflow for 018) so multiple competition-scoped screens
  coexist — do **not** add a top-level `App.tsx` nav entry (the spec is
  per-competition and needs `competitionId` in scope).
- **Surface, never recompute**: for AC2/AC3 the UI relies on the server's
  explanatory `message` (bounds and Zod messages are already human-readable).
  Optionally display the roster size as context, but the authoritative bound
  comes back from the base.

### Key Design Decisions

- **Where the screen lives** — competition-scoped, hosted by `CompetitionLibrary`
  (like RosterView), reached via `openId`. Trade-off: consistent with the roster
  idiom and keeps `competitionId` in scope; cost is that the current
  "opened → RosterView" shortcut must grow into a small sub-nav to host both
  this screen and STORY-001-018. Recommended: add the sub-nav; coordinate its
  shape with STORY-001-018 so the two sibling screens share one host.
- **Validation ownership** — surface the backend's verdict rather than mirror
  the bound arithmetic client-side. Trade-off: an invalid groups-per-round only
  reveals itself on save (a round-trip) instead of live; but duplicating
  `assertGroupBound` (which needs the class model's per-task `minGroupSize` and
  the live roster count) would create a second source of truth that can drift
  from the rule docs. Recommended: server-authoritative; the UI shows `message`.
  (A *read-only preview* of the range is a possible enhancement, not required.)
- **Save-response reuse** — treat the `PUT` response (`DrawEvidenceView`) as the
  post-save render source, so the form reflects exactly what the base persisted
  and shows any soft `warnings[]`. Trade-off: none material — it avoids a second
  GET. Recommended: render from the returned view.
- **Error-code branching** — `VALIDATION_FAILED` → per-field `fieldErrors`;
  `DRAW_GROUP_SIZE_OUT_OF_BOUNDS` → a single prominent alert (it is not tied to
  one field — it is a cross-field bound). Recommended: mirror RosterView's
  `extractFieldErrors` for the former, a top-of-form `role="alert"` for the
  latter.
- **The "spare-scorer override" field** — expose `minGroupSizeOverride` as the
  editable override, but **do not claim it relaxes the two-group minimum** — it
  does not (see Risks). Recommended: label it per its real effect (per-group
  minimum override / spare-timer exception) and escalate the AC3/AC4
  contradiction to the story owner before building an override the backend
  cannot honour.

### Alternatives Considered

- **Top-level nav screen (like Pilots/Templates)**: rejected — the spec is
  per-competition; a global screen would have no `competitionId`.
- **Client-side bound preview as the gate**: rejected as the *authority* — it
  would duplicate `assertGroupBound` and the class-model/roster reads,
  risking drift from the rule-doc minima. Acceptable only as a non-authoritative
  hint on top of the server verdict.
- **A second GET after save to refresh the form**: rejected — the `PUT` already
  returns the full `DrawEvidenceView`; a follow-up GET is redundant.
- **Building an `allowSingleGroup` / two-group-override control now**: rejected —
  no such backend field exists; inventing the UI for it (AC3/AC4) would create a
  control that always fails on save. Flag the gap; do not fabricate the contract.

---

## Risk & Gap Analysis

### Requirement Ambiguities

- **AC3/AC4 "spare-scorer override that relaxes the two-group minimum" is NOT
  implemented by STORY-001-009 (the dominant gap).** The only override the
  backend accepts is `minGroupSizeOverride` — a *per-group minimum size*
  override that feeds `resolveMin` and raises `maxByMin = floor(R/min)`,
  allowing **more, smaller groups**. There is **no** field that relaxes the
  two-group floor: `groupsPerRound` has a hard Zod `.min(2)`, and
  `assertGroupBound` rejects `upper < 2` and any `G` above `min(floor(R/min),
  floor(R/2))`. Consequently a **single-group spec is impossible** to save, so
  **AC4 cannot pass against the current backend**, and AC3's rejection message
  will be the Zod field error *"A round needs at least two groups"* — with **no
  mention of any override**, because none exists. This is a divergence between
  the STORY-001-009 *analysis* (Decision #1: "the exception… relaxes the cap and
  is expressed as the same spec override") and what STORY-001-009 *built*.
  **Per house-keeping rule 2, flag and resolve with the owner before building.**
  Options: (a) drop AC3/AC4's override semantics from this UI story (surface the
  Zod message as-is); or (b) treat AC4 as a re-opened STORY-001-009 backend gap
  (add an explicit `allowSingleGroup`/spare-scorer flag that relaxes the D1
  floor) — which would be **out of this pure-UI story's scope**.
- **`minGroupSizeOverride` direction is opposite to the story's mental model.**
  The story frames the override as *reducing* group count (allowing one group);
  the implemented override *increases* the permissible group count (smaller
  minimum per group). A UI field labelled "spare-scorer override — allow a
  single group" would misrepresent the backend. Clarify the intended semantics.
- **"draw mode" is a single-value union** (`"random-anti-repeat"`). It is a
  required field with exactly one legal value. Ambiguity: present it as a
  disabled/one-option control or omit the control and send the constant.
  Recommend a display-only field so the form is honest about the fixed value.
- **`roundCount` is not named in the story's field list** (Scope In lists draw
  mode, groups-per-round, consecutive-flight, lane policy) yet it is a required
  saved field (1–8). The form must include it or the `PUT` fails
  `VALIDATION_FAILED`. Confirm it belongs on this screen (it does — it is part
  of `SaveDrawSpecRequest`).
- **Soft warnings (AC2 of STORY-001-009) are unmentioned** in this story's ACs
  but ride every successful save. Decide whether to render them (recommended —
  they are the "constraints cannot be jointly satisfied" advisory).

### Edge Cases

- **First run / no spec**: `GET .../draw` returns `spec: null` (not an error).
  The form must render defaults, not a "not found" state. AC1 depends on this.
- **Empty or near-empty roster (R < 2)**: `saveSpec` **skips** the bound check
  (`if (R >= 2)`) so the Organiser can author the policy before pilots are
  entered; the check is deferred to generate time. The screen can therefore save
  a spec that will later fail at generate — surface the returned
  `roster-size` warning so the operator knows.
- **Roster shrinks after save**: a spec valid at save can become out-of-bounds
  later (re-checked at generate, not on the saved spec). This screen isn't
  responsible for re-validation, but AC6 recovery will faithfully show the
  now-stale spec; STORY-001-018's generate is where it surfaces.
- **`groupsPerRound = 1` (AC3)**: fails as `VALIDATION_FAILED` (Zod min 2), a
  *field* error — not the `DRAW_GROUP_SIZE_OUT_OF_BOUNDS` bound explanation.
  The UI branching must handle both codes, and the AC3 "explain the override"
  expectation is unmet by the current message.
- **Concurrent clients (last-write-wins)**: a second client could save a
  different spec while this one edits; `refresh()` on open mitigates but there is
  no live sync (acceptable at MVP scale, D8).

### Technical Risks

- **Contract mismatch on the override (highest, non-technical-but-blocking)**:
  AC3/AC4 assume a backend behaviour that does not exist. Building the UI to the
  ACs verbatim yields a control that cannot succeed. Mitigation: resolve the
  ambiguity above before REASONS Canvas; build only what the `PUT` accepts.
- **Host navigation collision with STORY-001-018**: both this and the draw
  workflow screen are competition-scoped and both want the `openId` slot in
  `CompetitionLibrary`, which currently hard-renders `RosterView`. Mitigation:
  introduce a shared per-competition sub-nav in one place and let both siblings
  register into it; coordinate with 018.
- **Field-error surface shape**: `VALIDATION_FAILED` `details` is Zod
  `flatten()` (`fieldErrors` + `formErrors`); `DRAW_GROUP_SIZE_OUT_OF_BOUNDS`
  has no `fieldErrors` (message only). The UI must not assume `fieldErrors`
  exists for every error — mirror RosterView's defensive `extractFieldErrors`
  (falls back to `{ field: [message] }`).
- **Offline-first / stateless (NFR)**: no external assets, no client-held spec
  truth. Low risk — the app is base-served and RosterView already fetches all
  state from the base. Mitigation: mirror RosterView; no local persistence.

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| AC1 | Set & save a valid spec; recorded with who; ready to generate | Yes | Pure UI over `PUT .../draw/spec` (returns the persisted `DrawEvidenceView`); attribution stamped from headers. First-run `spec:null` renders defaults. groups-per-round=2 on a 14-pilot F5J roster is valid (smallest group 7 ≥ 6). |
| AC2 | Out-of-bounds groups-per-round rejected with the bound explained | Yes | `DRAW_GROUP_SIZE_OUT_OF_BOUNDS` (409); the base's `message` already states the feasible range and reason. Surface `message` verbatim in a `role="alert"`. 14 pilots / F5J min 6 / G=4 → feasible "between 2 and 2". |
| AC3 | Too-few-groups (G=1) rejected with the two-group rule explained | **Partial** | Rejected — but as `VALIDATION_FAILED` ("A round needs at least two groups"), a Zod field error that does **not** mention any spare-scorer override (none exists). The "unless the override is set" clause is unmet by the current backend message. Flag. |
| AC4 | Spare-scorer override honoured; single-group spec accepted | **No (blocked)** | The backend has **no** override that relaxes the two-group floor; `groupsPerRound` min is a hard Zod bound and `assertGroupBound` rejects `upper < 2`. A single-group spec cannot be saved. `minGroupSizeOverride` is a *different* override (per-group min *size*). Resolve with owner; likely a re-opened STORY-001-009 backend gap, out of this UI story's scope. |
| AC5 | Edit an existing spec (toggle consecutive on); replaces prior; recorded | Yes | Re-`PUT` supersedes in place (stable spec id); attribution recorded. The checkbox drives `avoidConsecutiveFlights`. |
| AC6 | Recover the saved spec from the base on a fresh client | Yes | `GET .../draw` returns the saved `spec`; stateless render. (Contrary to a common assumption, GET returns `spec:null` — not `DRAW_SPEC_NOT_FOUND` — when none is saved, so first-run is also clean.) |

**Summary**: AC1, AC2, AC5, AC6 are fully implementable as a pure UI over the
existing STORY-001-009 backend — the save endpoint, the read-model, the
attribution and the two live error codes (`VALIDATION_FAILED`,
`DRAW_GROUP_SIZE_OUT_OF_BOUNDS`) are all in place and confirmed. **AC3 is only
partially met** (rejection happens, but via a Zod field message that omits the
override wording), and **AC4 is blocked** because the "spare-scorer override
that relaxes the two-group minimum" the story relies on was never built in
STORY-001-009 — the only override present (`minGroupSizeOverride`) works in the
opposite direction. This override contradiction is the one item to resolve with
the owner before REASONS Canvas; everything else is a routine RosterView-idiom
form. A secondary risk is the `CompetitionLibrary` host: it must grow a small
per-competition sub-nav to seat this screen beside the STORY-001-018 draw
workflow screen rather than hard-rendering `RosterView`.
