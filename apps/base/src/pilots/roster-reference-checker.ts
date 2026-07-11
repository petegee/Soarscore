import type { CompetitionRef } from "@soarscore/shared";

export interface RosterReferenceChecker {
  getReferencingCompetitions(pilotId: string): CompetitionRef[];
}

// STORY-001-005 seam: once rosters exist, this must answer from current
// roster state, and pilot deletion must not interleave with a concurrent
// roster-add — both operations run on the base's single SQLite writer, so
// that ordering guarantee holds for free.
export class NoRostersYetChecker implements RosterReferenceChecker {
  getReferencingCompetitions(_pilotId: string): CompetitionRef[] {
    return [];
  }
}
