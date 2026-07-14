import type { LifecycleState, SetupSubState } from "@soarscore/shared";
import type { EventRecord } from "../eventstore/event-store.js";
import type { RosterProjection } from "../roster/projection.js";
import type { DrawProjection } from "../draw/projection.js";

// One authoritative lifecycle state per competition, derived purely from the
// log (STORY-001-024). Derived state only (D4/D7): safe to discard and rebuild
// at any time. A PURE LOADER (Norm 2) — apply guards on record type/scope
// before mutating; no RNG, no network, no side effects.
//
// Class-agnostic law (CLAUDE.md): this file reads only generic roster/draw/
// lifecycle facts. It contains no branch on any competition class and never
// reads the Contest Class Model. Any such reference is a defect.
//
// It folds four fact sources: its own lifecycle.* markers (started / suspended /
// resumed / locked / group-opened / group-scored / deleted), plus roster and
// draw facts read through the two injected read-only projections. Missing
// foundational facts degrade gracefully to their default rung (Setup /
// BetweenGroups), so the model ships now and later-emitted events swap in
// additively without touching this projection's shape.

// Registry/lifecycle facts file under this fixed scope; content-level run facts
// (group.opened / group.scored) file under scope = competitionId.
const REGISTRY_SCOPE = "competitions";

export class LifecycleProjection {
  private started = new Set<string>();
  private suspended = new Set<string>();
  private locked = new Set<string>();
  // Count of currently-open groups per competition: >0 ⇒ GroupInProgress.
  private openGroups = new Map<string, number>();
  // Retained so a deleted competition still reports Deleted — distinguishable
  // from never-existed, even though CompetitionProjection drops the row.
  private deletedTombstones = new Set<string>();
  // Highest seq of a roster.* or draw.specSaved event per competition, and the
  // seq of the latest draw.generated — compared to derive candidate staleness
  // (left-fallback, AC3) deterministically from log ordering alone.
  private latestInputSeq = new Map<string, number>();
  private latestGeneratedSeq = new Map<string, number>();

  constructor(
    private readonly rosterProjection: RosterProjection,
    private readonly drawProjection: DrawProjection,
  ) {}

  apply(record: EventRecord): void {
    switch (record.type) {
      case "competition.deleted": {
        if (record.scope !== REGISTRY_SCOPE) break;
        const payload = record.payload as { competitionId: string };
        this.deletedTombstones.add(payload.competitionId);
        break;
      }
      case "competition.started": {
        this.started.add(competitionIdOf(record));
        break;
      }
      case "competition.suspended": {
        this.suspended.add(competitionIdOf(record));
        break;
      }
      case "competition.resumed": {
        this.suspended.delete(competitionIdOf(record));
        break;
      }
      case "competition.locked": {
        this.locked.add(competitionIdOf(record));
        break;
      }
      case "group.opened": {
        const id = competitionIdOf(record);
        this.openGroups.set(id, (this.openGroups.get(id) ?? 0) + 1);
        break;
      }
      case "group.scored": {
        const id = competitionIdOf(record);
        this.openGroups.set(id, Math.max(0, (this.openGroups.get(id) ?? 0) - 1));
        break;
      }
      case "roster.entryAdded":
      case "roster.entryUpdated":
      case "roster.entryRemoved":
      case "roster.entryReplaced":
      case "draw.specSaved": {
        // Content facts file under scope = competitionId. Newest input seq wins.
        this.latestInputSeq.set(
          record.scope,
          Math.max(this.latestInputSeq.get(record.scope) ?? 0, record.seq),
        );
        break;
      }
      case "draw.generated": {
        this.latestGeneratedSeq.set(record.scope, record.seq);
        break;
      }
      default:
        break;
    }
  }

  rebuild(events: Iterable<EventRecord>): void {
    this.started = new Set();
    this.suspended = new Set();
    this.locked = new Set();
    this.openGroups = new Map();
    this.deletedTombstones = new Set();
    this.latestInputSeq = new Map();
    this.latestGeneratedSeq = new Map();
    for (const event of events) {
      this.apply(event);
    }
  }

  // Exactly one state, evaluated in strict precedence (AC1). Sub-states appear
  // only within their composite.
  getState(competitionId: string): LifecycleState {
    if (this.deletedTombstones.has(competitionId)) return { state: "Deleted" };
    if (this.locked.has(competitionId)) return { state: "Locked" };
    if (this.suspended.has(competitionId)) return { state: "Suspended" };
    if (this.started.has(competitionId)) {
      const open = (this.openGroups.get(competitionId) ?? 0) > 0;
      return { state: "Running", runningSubState: open ? "GroupInProgress" : "BetweenGroups" };
    }
    return { state: "Setup", setupSubState: this.deriveSetupSubState(competitionId) };
  }

  isDeleted(competitionId: string): boolean {
    return this.deletedTombstones.has(competitionId);
  }

  // STORY-001-025: true once competition.started is folded, and stays true
  // while Suspended/Locked — i.e. genuinely past Start. Backs the config-
  // authority boundary seam (StartStateProvider) with no change to getState /
  // apply / rebuild.
  isStarted(competitionId: string): boolean {
    return this.started.has(competitionId);
  }

  // The Setup readiness ladder, derived from existing roster/draw facts with a
  // deterministic left-fallback on staleness (AC2/AC3). "Roster complete" ≡ the
  // roster holds ≥ 1 entry — the concrete, class-agnostic definition (group-size
  // minima are a class-model concern, STORY-001-022, and never enter here).
  private deriveSetupSubState(competitionId: string): SetupSubState {
    // A candidate is stale when an input (roster edit or draw-spec save) was
    // logged after the latest draw.generated — a pure read over log ordering,
    // needing no draw.cancelled cascade to have fired.
    const generatedSeq = this.latestGeneratedSeq.get(competitionId) ?? 0;
    const inputSeq = this.latestInputSeq.get(competitionId) ?? 0;
    const stale = inputSeq > generatedSeq;

    if (!stale && this.drawProjection.hasAccepted(competitionId)) return "DrawAccepted";
    if (!stale && this.drawProjection.getCandidate(competitionId)) return "DrawGenerated";
    // A stale candidate/accepted collapses to the earliest affected rung: the
    // draw spec if one still exists, else the roster rung.
    if (this.drawProjection.getSpec(competitionId)) return "DrawSpecified";
    if (this.rosterProjection.getRoster(competitionId).length >= 1) return "RosterComplete";
    return "Draft";
  }
}

// Registry-level lifecycle facts (started/suspended/resumed/locked) file under
// scope = "competitions" and name the competition in their payload; content run
// facts (group.opened/scored) file under scope = competitionId. Read the payload
// id when present, else fall back to the record scope — one accessor for both.
function competitionIdOf(record: EventRecord): string {
  const payload = record.payload as { competitionId?: string } | null;
  return payload?.competitionId ?? record.scope;
}
