import type { DrawSpecification, GeneratedDraw } from "@soarscore/shared";
import type { EventRecord } from "../eventstore/event-store.js";

// One projection for all competitions' draws — derived state only (D4/D7), safe
// to discard and rebuild from the log at any time. draw.* events file under
// scope = competitionId, so this projection guards by event type and files each
// fact under its record's scope: one competition's draw never bleeds into
// another's. A deleted competition drops both maps so nothing orphans (the
// roster / task-config idiom).
//
// This is a PURE LOADER (Safeguard 2/Norm 5): it never invokes the randomiser
// and never re-generates. The stored draw.generated payload is the fully
// materialised outcome, so replay reproduces the identical candidate. Any
// randomness in apply/rebuild is a defect.
export class DrawProjection {
  private specs = new Map<string, DrawSpecification>();
  private candidates = new Map<string, GeneratedDraw>();

  apply(record: EventRecord): void {
    switch (record.type) {
      case "draw.specSaved": {
        const payload = record.payload as DrawSpecification;
        this.specs.set(record.scope, this.copySpec(payload));
        break;
      }
      case "draw.generated": {
        // Latest wins — supersede, never overwrite in place (Decision #7). The
        // log retains every prior attempt; this map holds only the current one.
        const payload = record.payload as GeneratedDraw;
        this.candidates.set(record.scope, this.copyDraw(payload));
        break;
      }
      case "competition.deleted": {
        if (record.scope !== "competitions") break;
        const payload = record.payload as { competitionId: string };
        this.specs.delete(payload.competitionId);
        this.candidates.delete(payload.competitionId);
        break;
      }
      default:
        break;
    }
  }

  rebuild(events: Iterable<EventRecord>): void {
    this.specs = new Map();
    this.candidates = new Map();
    for (const event of events) {
      this.apply(event);
    }
  }

  getSpec(competitionId: string): DrawSpecification | undefined {
    const spec = this.specs.get(competitionId);
    return spec ? this.copySpec(spec) : undefined;
  }

  getCandidate(competitionId: string): GeneratedDraw | undefined {
    const draw = this.candidates.get(competitionId);
    return draw ? this.copyDraw(draw) : undefined;
  }

  private copySpec(spec: DrawSpecification): DrawSpecification {
    return {
      id: spec.id,
      competitionId: spec.competitionId,
      classModelId: spec.classModelId,
      drawMode: spec.drawMode,
      roundCount: spec.roundCount,
      groupsPerRound: spec.groupsPerRound,
      fairnessMetric: spec.fairnessMetric,
      avoidConsecutiveFlights: spec.avoidConsecutiveFlights,
      lanePolicy: spec.lanePolicy,
      minGroupSizeOverride: spec.minGroupSizeOverride,
    };
  }

  private copyDraw(draw: GeneratedDraw): GeneratedDraw {
    return {
      id: draw.id,
      competitionId: draw.competitionId,
      specId: draw.specId,
      metric: draw.metric,
      metricValue: draw.metricValue,
      attemptsRun: draw.attemptsRun,
      rounds: draw.rounds.map((round) => ({
        roundNumber: round.roundNumber,
        groups: round.groups.map((group) => ({
          flyingOrder: group.flyingOrder,
          lonePilotFlagged: group.lonePilotFlagged,
          members: group.members.map((m) => ({ rosterEntryId: m.rosterEntryId, lane: m.lane })),
        })),
      })),
      distribution: {
        maxMeets: draw.distribution.maxMeets,
        totalExcessMeets: draw.distribution.totalExcessMeets,
        variance: draw.distribution.variance,
        pairs: draw.distribution.pairs.map((p) => ({ a: p.a, b: p.b, count: p.count })),
      },
    };
  }
}
