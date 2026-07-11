# SPDD Analysis: Build and Edit the Competition Roster (STORY-001-005)

## Original Business Requirement

> # [STORY-001-005] Build and Edit the Competition Roster
>
> > Source: `docs/user-stories/01-organiser.md` §3.4 · `docs/requirements/high-level-requirements.md` Area 3.4
> > Module: 001 (Organiser MVP) · Estimated effort: **3 days**
>
> ### Background
>
> The roster is the list of who is flying this competition. It is built from
> the master pilot library so entering an event means picking known pilots, not
> re-typing details. Each roster entry carries this competition's per-entry
> attributes (pilot number, pilot class — as enabled by the entry options).
> Before the draw is generated the roster changes freely; after the draw, a
> withdrawal is handled by replacing the entrant in their existing draw slot
> rather than re-drawing the whole event. Pilots confirm their own entry
> details by reading the roster.
>
> ### Business Value
>
> - Provide the Organiser with fast roster building from known pilots for
>   fields of up to 20.
> - Support per-competition attribute edits that never leak back into master
>   pilot records or other events.
> - Enable late entrant replacement without destroying an accepted draw.
>
> ### Dependencies and Assumptions
>
> - **Prerequisites**: STORY-001-001 (pilot library), STORY-001-003
>   (competition), STORY-001-004 (entry options define which attributes exist).
> - **Data assumptions**: the draw, when it exists, was produced by
>   STORY-001-009; pilot retirement is a Contest Director action reflected
>   here, not performed here.
> - **Integration points**: the roster feeds the draw (STORY-001-009) and all
>   scoring and reports.
> - **Business constraints**: individual-only MVP; retirement (5.5) and
>   re-draws are Contest Director authority.
>
> ### Scope In
>
> - Add master pilots to a competition as roster entries; remove them freely
>   before the draw exists.
> - Edit per-entry attributes (e.g. pilot number, class) scoped to this
>   competition only.
> - Replace an entrant after the draw exists, inheriting the withdrawn pilot's
>   draw slot, with a warning.
> - Reflect a Contest-Director-retired pilot's state in the roster.
>
> ### Scope Out
>
> - Retiring pilots and re-drawing remaining rounds — Contest Director
>   authority (Area 5.5).
> - Team entries and per-entry frequency — Future Enhancements.
> - Draw generation itself (STORY-001-009).
>
> ### Acceptance Criteria
>
> #### AC1: Build the roster from the library
> **Given** a pilot library holding 25 pilots and a new competition
> **When** the Organiser adds 14 of them to the competition
> **Then** each becomes a roster entry carrying the per-entry attributes the
> competition's entry options enable (e.g. pilot number, class).
>
> #### AC2: Per-entry edits stay in this competition
> **Given** roster entry "Jane Smith" with pilot number 7 in this competition
> **When** the Organiser changes her pilot number to 12
> **Then** the change applies to this competition only; her master pilot record
> and her entries in other competitions are unchanged.
>
> #### AC3: Free roster changes before the draw
> **Given** the draw has not been generated
> **When** the Organiser adds two entrants and removes one
> **Then** the roster updates freely with no warnings about the draw.
>
> #### AC4: Replacement after the draw inherits the slot
> **Given** a generated draw and entrant "John Brown" withdrawing
> **When** the Organiser replaces him with "Ken White"
> **Then** Ken White takes John Brown's place in every round of the existing
> draw (groups and lanes), and the Organiser is warned that draw and lane
> allocations are affected.
>
> #### AC5: Retired pilots are visible and not silently re-added
> **Given** a pilot the Contest Director has retired from the competition
> **When** the Organiser views the roster
> **Then** the entry shows its retired state, and re-adding or reactivating the
> pilot is not possible as a silent side effect of ordinary roster editing.
>
> ### INVEST Check
>
> Independent (consumes, not extends, earlier stories) · Valuable (the field
> list every event needs) · Small (3 days, 3 functional points: build/edit,
> post-draw replacement, retired-state respect) · Testable.

## Domain Concept Identification

### Existing Concepts (from codebase)

- **Pilot** (`packages/shared/src/pilot.ts`, master-data scope): the reusable
  master library record — name + optional registrationId / club / contact. The
  roster references pilots by their `id`; it never copies or mutates these
  records. Directly satisfies the "pick known pilots, don't re-type" business
  value and AC2's isolation requirement.
- **Competition** (`packages/shared/src/competition.ts`): the event the roster
  belongs to. Carries the *entry-option toggles* the roster's per-entry
  attributes are gated on — `pilotNumbersEnabled`, `pilotClassesEnabled`, and
  the allowed `pilotClasses` name set (from STORY-001-004). These toggles
  decide which per-entry attributes AC1 must materialise, and the `pilotClasses`
  set is the closed vocabulary an entry's class must belong to.
- **CompetitionRef** (`packages/shared/src/errors.ts`): `{ id, name }`, already
  returned by the pilot-deletion reference-check path. This is the exact shape
  the roster must now populate.
- **RosterReferenceChecker / `NoRostersYetChecker`**
  (`apps/base/src/pilots/roster-reference-checker.ts`): an injected seam whose
  in-code comment names **this story** as the one that must replace the no-op
  stub. Pilot deletion (`PilotService.delete`) already blocks with a 409
  `REFERENCED_PILOT` when a pilot is on any roster — but the checker currently
  always answers "no rosters". Making it answer from real roster state is a
  first-class deliverable of this story, not an afterthought.
- **EventStore + scope model** (`apps/base/src/eventstore/event-store.ts`,
  `competitions/projection.ts`): registry/lifecycle events file under a fixed
  scope (`"competitions"`, `"master-data"`); the projection comment states that
  **content events (roster, draw, scores) will file under `scope =
  competitionId`**. The roster is the first such content aggregate. The single
  synchronous SQLite writer serialises all appends — the ordering guarantee the
  reference-checker comment relies on for delete-vs-add races.
- **Deferred-state provider pattern** (`competitions/state-providers.ts`,
  `AppOptions` seams in `app.ts`): `LockStateProvider` / `CapturedScoresProvider`
  are injected interfaces with no-op stubs, swapped for real implementations by
  later stories with "zero rework". This is the established mechanism for
  depending on state a later story owns — and the roster needs it twice (draw,
  retirement).
- **Attribution + immutable event log** (`attribution.ts`, D4): every mutation
  is an attributed, append-only event. Roster add/remove/edit/replace are
  mutations and inherit this audit model for free.

### New Concepts Required

- **RosterEntry**: the per-competition enrolment of a master pilot. Relates to
  Competition (owner, one roster per competition) and Pilot (references one
  master pilot by id). Carries this competition's per-entry attributes —
  **pilot number** and **pilot class** — present only when the corresponding
  entry option is enabled. Crucially it needs **its own stable identity**
  distinct from the pilot id, because a draw slot must survive a
  pilot-for-pilot replacement (AC4): the slot is best keyed to the entry, not
  the person.
- **RosterEntry lifecycle state**: at minimum *active* vs *retired* (AC5).
  Retirement is set by the Contest Director elsewhere (Area 5.5) and only
  *reflected* here; the roster must render it and refuse to silently clear it.
- **DrawStateProvider (seam, read-only — RD4)**: a "does an *accepted* draw
  exist for this competition?" query, and nothing more. This story owns the
  *consumer* side and a no-op/absent-draw stub; STORY-001-009 supplies the real
  one — mirroring the lock/scores provider pattern exactly. It gates AC3 (free
  edits when absent) vs AC4 (replace-with-warning when present). It does **not**
  transfer slots: because slots reference the stable `rosterEntryId` (RD4), a
  replacement on the same entry id is inherited by the draw for free, so the
  provider never needs a write path.
- **RetirementStateProvider (seam)**: a "which entries has the CD retired?"
  query. This story consumes it to render retired state and to block silent
  re-add/reactivate (AC5); the Area-5.5 CD story supplies the real one.

### Key Business Rules

- **Roster entries derive from, never mutate, master pilots** (AC2): edits to a
  per-entry attribute must not append any `pilot.updated` event or touch other
  competitions' rosters. Governs RosterEntry ↔ Pilot.
- **Per-entry attributes exist iff the entry option is enabled** (AC1): pilot
  number / class are materialised and editable only under
  `pilotNumbersEnabled` / `pilotClassesEnabled`; a class value must be a member
  of the competition's `pilotClasses` set. Governs RosterEntry ↔ Competition.
- **Edit freedom is gated by draw existence** (AC3/AC4): with no draw, add /
  remove / edit are unconstrained and warning-free; once a draw exists, removal
  becomes *replacement* that inherits the draw slot and must warn. Governs
  RosterEntry ↔ Draw.
- **Draw-slot inheritance on replacement** (AC4): the replacement entrant
  occupies the withdrawn entrant's place in **every round** (groups *and*
  lanes) rather than triggering a re-draw. Governs RosterEntry ↔ Draw.
- **Retired state is read-only here and never silently cleared** (AC5):
  retirement is CD authority (5.5, which *does* re-draw); ordinary roster
  editing must surface it and cannot re-add / reactivate a retired pilot as a
  side effect. Governs RosterEntry lifecycle.
- **A roster feeds pilot-deletion protection** (implicit, from the existing
  seam): once entries exist, deleting a master pilot on any roster must be
  blocked with the referencing competitions named.
- **Scale invariant**: ≤ 20 pilots per competition (roster is the field list);
  informs the "add 14 of 25" AC1 shape and bounds all roster operations.

## Strategic Approach

### Resolved Design Decisions (interactive review with the Organiser)

These four decisions were worked through and settled before design; the rest of
this section and the AC coverage below reflect them. Settled — do not
re-litigate per session.

- **RD1 — Close the pilot-deletion reference-checker seam in this story.**
  `NoRostersYetChecker` is replaced with a real `RosterReferenceChecker` reading
  current roster state, so deleting a rostered master pilot fires the existing
  `REFERENCED_PILOT` 409 naming the referencing competitions. It is a **hard
  block with no force/override** (identical to how landing-tables already
  behave); a pilot must be removed from every roster before deletion. This fixes
  a currently-silent data-integrity hole the stub leaves open.

- **RD2 — One `RosterProjection`, keyed `Map<competitionId, roster>`, rebuilt
  from the full log.** The roster is the first `scope = competitionId` content
  aggregate; the single projection recognises `roster.*` events and files each
  entry under the competition id carried in the event's scope, guarding scope
  the way `CompetitionProjection` does. Chosen over per-competition projection
  instances — no lifecycle to manage, matches every existing aggregate.
  *Growth is a non-issue:* the projection is derived state bounded by
  *live competitions × current entries* (tens of MB only at thousands of
  competitions — decades away); see the deferred NFR note under Technical Risks.

- **RD3 — Depend on the draw and retirement via injected seams + no-op stubs.**
  `DrawStateProvider` and `RetirementStateProvider` join `AppOptions` beside the
  existing `LockStateProvider` / `CapturedScoresProvider`, with stubs (no
  accepted draw / nothing retired). Consumer logic and warnings for AC4/AC5 are
  built and unit-tested against fakes now; the real producers (STORY-001-009,
  Area 5.5) wire in later with zero rework. Preserves the story's "Independent"
  INVEST claim honestly.

- **RD4 — A roster entry has its own stable id (`rosterEntryId`), distinct from
  `pilotId`.** The entry is the durable *seat*; the occupant can change. Draw
  slots, scores, and reports reference the entry id, never the pilot id. This
  makes AC4 replacement a roster-level `roster.entryReplaced` mutation on the
  **same** entry id (recording Brown → White): every draw slot that referenced
  that seat now resolves to the new occupant **automatically, with no write to
  draw state**, and the immutable log (D4) still shows the prior occupant.
  Consequently **`DrawStateProvider` stays read-only** — it only answers "does
  an accepted draw exist for this competition?" to gate free-edit (AC3) vs
  replace-with-warning (AC4). Mirrors the codebase principle that a stable id
  survives change (competition update keeps its id so references never break).

- **RD5 — Pilot numbers are unique within a competition, auto-assignable from
  1.** When `pilotNumbersEnabled`, each entry's number must be unique across the
  competition's roster; the system can auto-assign the lowest free number on
  add, and the Organiser may override to any other still-unique value.
  Uniqueness is a `RosterService` invariant against the competition's own roster
  projection; a collision is a named validation refusal.

- **RD6 — Pilot class is mandatory whenever the option is on.** When
  `pilotClassesEnabled`, an entry cannot be added or saved without a class, and
  the value must belong to the competition's `pilotClasses` set. When the option
  is off, entries carry no class. Enforced in `RosterService` against the live
  competition projection (the toggle and legal-name set live on the competition,
  not visible to a standalone Zod schema).

### Solution Direction

- Introduce the **roster as the first per-competition content aggregate**,
  filing its events under `scope = competitionId` (the model the competition
  projection already anticipates), with the same
  **shared-schema → service → projection → routes** layering the pilot,
  landing-table, and competition modules already use. Data flow:
  REST endpoint → Zod-validated request → `RosterService` guards & appends
  attributed events → `RosterProjection` derives current roster → read back for
  the companion app and reports.
- **Reuse the two deferred-state mechanisms**, not new bespoke plumbing: add a
  `DrawStateProvider` and a `RetirementStateProvider` to `AppOptions` alongside
  the existing lock/scores providers, each with a no-op stub (no draw / nothing
  retired) so this story is fully testable and shippable before STORY-001-009
  and Area 5.5 land, and both swap in later with zero rework.
- **Close the pre-built pilot-deletion seam (RD1)**: replace
  `NoRostersYetChecker` with a real checker answering from the roster
  projection, so `CompetitionRef` starts carrying real referencing competitions
  and the `REFERENCED_PILOT` 409 becomes a hard block (no override). The single
  SQLite writer already gives the delete-vs-add ordering guarantee the seam
  comment promises.
- Keep per-entry attributes **driven by the owning competition's entry-option
  toggles** — the roster reads the `Competition` projection to know which
  attributes to accept/expose and (for class) which values are legal.

### Key Design Decisions

- **Roster-entry identity: own id vs pilot id as the key.** *(RESOLVED — RD4:
  distinct `rosterEntryId`.)* Keying by pilot id is simpler but turns AC4 into a
  fan-out rewrite of every slot/score/report reference from the withdrawn
  pilot's id to the replacement's. → A distinct roster-entry id makes the entry
  the durable seat: replacement records Brown → White on the same entry id and
  every downstream reference is inherited untouched. Natural fit for the
  event-sourced, id-keyed model where "rename/replace never breaks id-keyed
  references" is already established (competition update).
- **Depend on draw/retirement via injected seams vs defer the two ACs.**
  *(RESOLVED — RD3: seam + stubs.)* The story is #5 but AC4 needs the draw (#9)
  and AC5 needs CD retirement (5.5). → Apply the lock/scores seam pattern: this
  story delivers the *consumer* logic and stubs, provably exercising AC4/AC5
  branches against fakes, and the producers wire in later. Combined with RD4,
  the draw seam is **read-only** — slot inheritance needs no cross-story write.
- **Post-draw removal = replacement, pre-draw removal = free delete.** Trade-off:
  a single "remove" verb is simpler but can't express slot inheritance. →
  **Recommend the draw-state provider gate**: absent draw → free add/remove
  (AC3, no warnings); present draw → the remove path is a *replace-in-slot*
  operation that returns/raises a warning that draw and lane allocations are
  affected (AC4). One guard, ordered like the existing
  locked → captured-scores guards in `CompetitionService`.
- **Per-entry attribute validation location.** → **Recommend shared Zod
  schemas** (as with every other aggregate) for structural validation, with the
  *cross-aggregate* rules — attribute allowed only if the option is on, class ∈
  competition's `pilotClasses` — enforced in `RosterService` against the
  competition projection, since Zod can't see the owning competition's toggles.
- **Retired-state enforcement: hard refusal vs silent no-op.** → **Recommend an
  explicit guard** that makes re-add / reactivate of a CD-retired entry a named,
  surfaced refusal (a domain error with its own code + `setErrorHandler`
  branch), matching AC5's "not… as a silent side effect".

### Alternatives Considered

- **Store the roster on the Competition aggregate itself** (extend
  `competition.created`/`updated` payloads): rejected — it would bloat the
  registry aggregate, fight the documented `scope = competitionId` content-event
  model, and make the ≤20-entry roster churn (adds/removes/edits) rewrite the
  whole competition on every change.
- **Copy master-pilot fields onto the roster entry at add-time**: rejected —
  duplicates data the pilot library owns, and re-introduces the "leak back /
  drift" risk AC2 is explicitly guarding against; referencing by id is the
  established pattern.
- **Block AC4/AC5 behaviour until STORY-001-009 / Area 5.5 exist**: rejected —
  the provider-seam pattern already in the codebase lets both be built and
  tested now, keeping the story shippable and independent.

## Risk & Gap Analysis

### Requirement Ambiguities

- **Pilot-number uniqueness / range** *(RESOLVED — RD5)*: pilot numbers must be
  **unique within a competition**, and the system **can auto-assign them
  sequentially from 1** (e.g. on add, filling the lowest free number), with the
  Organiser free to override to any other number that stays unique. Uniqueness
  is a `RosterService` invariant checked against the competition's own roster
  projection; a collision is a named validation refusal.
- **"Replace" mechanics for AC4**: is the withdrawn entry retained (superseded,
  audit-visible) or overwritten in place? Event-sourcing + D4 immutability
  favour *supersede and keep the history*, but the AC is silent. Needs
  confirmation.
- **Retired entry + replacement interaction**: AC4 replaces a *withdrawing*
  entrant; AC5 covers *CD-retired* entrants (which trigger a 5.5 re-draw, not a
  slot-inheriting replace). The boundary between "Organiser replaces a
  withdrawal" and "CD retires" needs to be explicit so the roster doesn't offer
  replace on a retired entry.
- **Class default when `pilotClassesEnabled` but entry unset** *(RESOLVED —
  RD6)*: a class is **mandatory per entry whenever the option is on** — an entry
  cannot be added or saved classless while `pilotClassesEnabled`, and the value
  must be a member of the competition's `pilotClasses` set. When the option is
  off, entries carry no class. Enforced in `RosterService` against the live
  competition projection (Zod can't see the owning competition's toggle/set).
- **What counts as "the draw exists"**: generated (STORY-001-009) vs *accepted*
  by the CD (Area 4.3). AC3/AC4 hinge on this boundary. The `DrawStateProvider`
  contract must pin down which state flips free-edit off. *Recommend: accepted
  draw, matching "an accepted draw" language in the CD story.*

### Edge Cases

- **Add a pilot already on the roster**: duplicate-entry guard needed; AC1 is
  silent.
- **Remove the pilot being replaced, or replace with a pilot already on the
  roster** (AC4): must be rejected to avoid a pilot holding two slots.
- **Editing a per-entry attribute whose option was later disabled**
  (STORY-001-004 RD4 discards `pilotClasses` on disable): a stale class value on
  an entry when the option is off — needs a defined reconciliation (hide/ignore
  vs clear).
- **Deleting a master pilot who is on a roster** (existing
  `REFERENCED_PILOT` path): must now actually fire once the checker is real;
  currently silently allowed because the stub says "no rosters".
- **Replacement when no draw slot data is available yet** (provider stub during
  MVP sequencing): the consumer must degrade sensibly, not crash.
- **Reactivating a retired entry via a plain edit/add** (AC5): the silent-re-add
  vector to block.

### Technical Risks

- **Cross-aggregate coupling to the Competition projection**: roster validation
  reads competition entry-option state. Mitigation — both projections rebuild
  from the same ordered log on the single writer; read the competition
  projection synchronously at command time, don't cache toggle state on the
  entry.
- **Draw-slot ownership straddles two stories**: if the roster models the slot
  reference wrongly now, STORY-001-009 pays rework. Mitigation — define the
  entry-id-as-slot-key contract in the `DrawStateProvider` interface up front
  and keep slot *shape* opaque to the roster (it only needs "entry X holds a
  slot; replacement transfers it").
- **Reference-checker correctness under delete/add races**: mitigated for free
  by the single synchronous SQLite writer (per the existing seam comment), but
  the real checker must read *current* projection state, not a snapshot.
- **Startup-rebuild latency at scale (deferred NFR, not this story)**: every
  projection replays the whole append-only log at boot
  (`projection.rebuild(eventStore.readAll())`). The *roster* projection's memory
  is bounded by live state (RD2) and is negligible, but the **event log grows
  forever** (D4) — scores dominate its volume (~1–2k events/competition). In-memory
  replay is roughly ~1s per ~100–200k events, so rebuild time becomes noticeable
  only in the hundreds-of-thousands-to-million-event range (many hundreds of
  competitions). Standard exits when it matters: **per-season / per-event
  database files** (the natural fit for a base-station-per-event operational
  model, capping the log by construction) or projection **snapshots**. Neither
  is needed for the MVP; recorded here so it is on the NFR radar, not designed
  around now.
- **Scope-model consistency**: this is the first `scope = competitionId`
  aggregate; getting the scope guard right in the new projection (as the
  competition projection guards its fixed scope) matters so roster events of one
  competition never bleed into another's projection.

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| AC1 | Add master pilots as roster entries carrying enabled per-entry attributes | Yes | Fully in scope. Depends on reading STORY-001-004 entry-option toggles; duplicate-add guard and number/class defaults to confirm (see ambiguities). |
| AC2 | Per-entry edits stay in this competition; master + other events unchanged | Yes | Directly supported by id-reference-not-copy design; provable by asserting no `pilot.updated` event and other competitions' rosters unchanged. |
| AC3 | Free roster changes before the draw, no warnings | Yes | Requires `DrawStateProvider` "no accepted draw" branch (no-op stub suffices for this story). |
| AC4 | Post-draw replacement inherits slot in every round + warns | Yes (design), Partial (E2E) | RD4 makes slot inheritance intrinsic: replacement is a `roster.entryReplaced` mutation on the stable `rosterEntryId`, so slots inherit the new occupant with **no draw write** — fully provable now against the read-only fake draw provider (present/absent branches + warning). Only the visual end-to-end "every round shows Ken White" is gated on STORY-001-009 supplying real slots. |
| AC5 | Retired entries visible; no silent re-add/reactivate | Partial | Rendering + refusal-guard provable now against a fake `RetirementStateProvider` (RD3); the *real* retired state arrives with Area 5.5. Boundary vs AC4 replacement to confirm (see ambiguities). |

---

**House-rule cross-check (per CLAUDE.md §2):** no conflict found with the rule
docs — the roster is product-level enrolment, not a scoring rule; individual-only
MVP, no teams/frequency, and CD-owned retirement/re-draw are all consistent with
`high-level-requirements.md` Area 3.4 and the CD story (Area 5.5). The one
requirement-level tension to flag is **sequencing**: AC4 and AC5 reference the
draw (STORY-001-009) and CD retirement (Area 5.5), which land after this story —
resolved (RD3/RD4) by the established injected-provider seam pattern plus a
stable entry-id seat, rather than a requirements change.
