// Score-completeness seam (STORY-001-043): a competitions-owned interface that
// answers "which seats in this round/task have no captured result," decoupling
// CompetitionService from the scoring module (mirrors how GroupCompositionProvider
// decouples the draw module). The seam contract: one method answering a lightweight
// presence check (MUST NOT trigger ScoringService.getGroupScore or any recompute
// that could materialize lone-pilot RNG or F3B annulment-override state).

import type { ScoringProjection } from "./projection.js";

export interface ScoreCompletenessProvider {
  // Returns the rosterEntryIds seated in this group (per
  // GroupCompositionProvider.getEffectiveGroups) that carry no captured result
  // for this round/task/group. A lightweight presence check only — MUST NOT call
  // ScoringService.getGroupScore or trigger any recompute.
  uncapturedSeats(
    competitionId: string,
    roundNumber: number,
    taskId: string,
    groupFlyingOrder: number,
    seatedRosterEntryIds: string[],
  ): string[];
}

// Real implementation: checks each seated entry against the global
// hasCapturedResults flag from the scoring projection. This is settled as
// acceptable (user-confirmed, 202607161029) because getEffectiveGroups already
// scopes entries to the exact round/task, so a global check does not admit false
// "complete" readings. A test obligation (Safeguards §11) locks this in.
export class ProjectionScoreCompletenessProvider implements ScoreCompletenessProvider {
  constructor(private readonly scoringProjection: ScoringProjection) {}

  uncapturedSeats(
    competitionId: string,
    _roundNumber: number,
    _taskId: string,
    _groupFlyingOrder: number,
    seatedRosterEntryIds: string[],
  ): string[] {
    return seatedRosterEntryIds.filter(
      (id) => !this.scoringProjection.hasCapturedResults(competitionId, id),
    );
  }
}

// Test stub: all seats report captured (gate passes). Never used in production;
// tests inject a real provider or use ProjectionScoreCompletenessProvider.
export class AllSeatsCompleteProvider implements ScoreCompletenessProvider {
  uncapturedSeats(
    _competitionId: string,
    _roundNumber: number,
    _taskId: string,
    _groupFlyingOrder: number,
    _seatedRosterEntryIds: string[],
  ): string[] {
    return [];
  }
}
