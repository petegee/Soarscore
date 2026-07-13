import type { EntryScoresProvider } from "../roster/state-providers.js";
import type { ScoringProjection } from "./projection.js";

// The real EntryScoresProvider (STORY-001-011), replacing the roster module's
// NoEntryScoresYetProvider stub as the app.ts default. The interface is
// roster-owned; this implementation is scoring-owned and injected via
// AppOptions, mirroring ProjectionDrawStateProvider's exact shape — the
// roster module never imports the scoring module (no cycle).
//
// Seam integrity (Safeguard 8): answers only from genuinely captured results
// (scoring.resultCaptured facts) — never from draw membership alone. A seat
// with a draw slot but no capture still reports false, preserving free
// roster replacement until a real result exists — activating "a flown seat
// can never be replaced" for real for the first time.
export class ProjectionEntryScoresProvider implements EntryScoresProvider {
  constructor(private readonly projection: ScoringProjection) {}

  hasCapturedScores(competitionId: string, rosterEntryId: string): boolean {
    return this.projection.hasCapturedResults(competitionId, rosterEntryId);
  }
}
