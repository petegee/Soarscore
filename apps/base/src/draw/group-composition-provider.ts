import type { FlightGroup } from "@soarscore/shared";
import type { DrawProjection } from "./projection.js";

// STORY-001-011: ScoringService needs the *effective* group composition
// (accepted draw plus any move/split/re-flight overlay) to know who is in a
// group when it recomputes. This interface is owned by `scoring/` (the
// consumer) but physically colocated here so the draw-side implementation and
// the interface it satisfies are easy to keep in sync — mirrors
// DrawStateProvider (roster-owned interface, draw-owned implementation,
// STORY-001-017 Safeguard 8). scoring/service.ts imports only this shape,
// never DrawProjection or DrawService directly, so neither module imports the
// other (no cycle) — the concrete wiring happens only in app.ts.
export interface GroupCompositionProvider {
  getEffectiveGroups(competitionId: string, roundNumber: number, taskId: string): FlightGroup[];
}

// Read-only: draw slots key on rosterEntryId, so this delegates straight to
// DrawProjection's pure loader — no RNG, no recompute logic here.
export class DrawServiceGroupCompositionProvider implements GroupCompositionProvider {
  constructor(private readonly projection: DrawProjection) {}

  getEffectiveGroups(competitionId: string, roundNumber: number, taskId: string): FlightGroup[] {
    return this.projection.getEffectiveGroups(competitionId, roundNumber, taskId);
  }
}
