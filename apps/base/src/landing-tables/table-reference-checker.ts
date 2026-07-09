import type { CompetitionRef } from "@soarscore/shared";

export interface LandingTableReferenceChecker {
  getReferencingCompetitions(tableId: string): CompetitionRef[];
}

// STORY-001-008 seam: a real checker will answer from per-task scoring config
// (which task in which competition selected this table). Table deletion must
// not interleave with a concurrent reference-add — both run on the base's
// single SQLite writer, so that ordering guarantee holds for free.
export class NoTaskConfigYetChecker implements LandingTableReferenceChecker {
  getReferencingCompetitions(_tableId: string): CompetitionRef[] {
    return [];
  }
}
