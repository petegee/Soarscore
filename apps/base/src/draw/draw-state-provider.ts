import type { DrawStateProvider } from "../roster/state-providers.js";
import type { DrawProjection } from "./projection.js";

// The real DrawStateProvider (STORY-001-017), replacing the roster module's
// NoAcceptedDrawProvider stub as the app.ts default. The interface is
// roster-owned; this implementation is draw-owned and injected via AppOptions,
// so the roster module never imports the draw module (no cycle).
//
// Seam honesty: it answers only from the *accepted* state — never mere
// candidate existence — the exact 009/005 contract. Once a draw is accepted it
// returns true, which activates the STORY-001-005 roster remove/replace gates
// by design (RD4: the seat carries draw slots forward). Read-only: draw slots
// key on rosterEntryId, so a replacement inherits its slots with no draw write.
export class ProjectionDrawStateProvider implements DrawStateProvider {
  constructor(private readonly projection: DrawProjection) {}

  hasAcceptedDraw(competitionId: string): boolean {
    return this.projection.hasAccepted(competitionId);
  }
}
