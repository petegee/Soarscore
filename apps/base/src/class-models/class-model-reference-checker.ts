import type { CompetitionRef } from "@soarscore/shared";
import type { CompetitionProjection } from "../competitions/projection.js";

export interface ClassModelReferenceChecker {
  getReferencingCompetitions(modelId: string): CompetitionRef[];
}

// Mirrors ProjectionRosterReferenceChecker: answers from real competition state
// at call time (current state, never a snapshot). The base's single synchronous
// SQLite writer serialises delete-vs-reference, so the ordering guarantee holds
// for free. There is no force/override path (AC9).
export class ProjectionClassModelReferenceChecker implements ClassModelReferenceChecker {
  constructor(private readonly competitionProjection: CompetitionProjection) {}

  getReferencingCompetitions(modelId: string): CompetitionRef[] {
    return this.competitionProjection
      .getAll()
      .filter((competition) => competition.classModelId === modelId)
      .map((competition) => ({ id: competition.id, name: competition.name }));
  }
}
