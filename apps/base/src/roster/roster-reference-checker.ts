import type { CompetitionRef } from "@soarscore/shared";
import type { RosterReferenceChecker } from "../pilots/roster-reference-checker.js";
import type { CompetitionProjection } from "../competitions/projection.js";
import type { RosterProjection } from "./projection.js";

// Closes the RD1 seam: pilot deletion now answers from real roster state at
// call time (current state, never a snapshot). Deleted competitions drop out
// via the competition-projection filter (their rosters are also dropped by
// the roster projection on competition.deleted), so they never block. The
// base's single synchronous SQLite writer serialises delete-vs-add, so the
// ordering guarantee holds for free. There is no force/override path.
export class ProjectionRosterReferenceChecker implements RosterReferenceChecker {
  constructor(
    private readonly rosterProjection: RosterProjection,
    private readonly competitionProjection: CompetitionProjection,
  ) {}

  getReferencingCompetitions(pilotId: string): CompetitionRef[] {
    const refs: CompetitionRef[] = [];
    for (const competitionId of this.rosterProjection.getCompetitionIdsForPilot(pilotId)) {
      const competition = this.competitionProjection.getById(competitionId);
      if (!competition) continue;
      refs.push({ id: competition.id, name: competition.name });
    }
    return refs;
  }
}
