import type {
  AnnulmentOverrideRequestedPayload,
  CapturedFlightResult,
  LonePilotResolvedPayload,
  ResultCapturedPayload,
} from "@soarscore/shared";
import type { EventRecord } from "../eventstore/event-store.js";

// One projection for all competitions' captured results and lone-pilot/
// annulment resolutions (STORY-001-011) — derived state only (D4/D7), safe to
// discard and rebuild from the log at any time. scoring.* events file under
// scope = competitionId, mirroring DrawProjection exactly.
//
// This is a PURE LOADER (Norm 4 / Safeguard 2): no RNG, no recompute
// arithmetic, no clash-checking — the one-time random picks (fillers, dummy)
// are materialised into the event by ScoringService before this projection
// ever sees them, so replay is always deterministic.
export class ScoringProjection {
  // Outer key competitionId; inner key `${roundNumber}|${taskId}|${rosterEntryId}`,
  // array holds at most one "original" and one "reflight" entry — a repeat
  // capture of the same kind replaces its slot (supersede, latest wins).
  private results = new Map<string, Map<string, CapturedFlightResult[]>>();
  // Outer key competitionId; inner key `${roundNumber}|${taskId}|${groupFlyingOrder}`.
  private lonePilotResolutions = new Map<string, Map<string, LonePilotResolvedPayload>>();
  private annulmentRequests = new Map<string, Map<string, AnnulmentOverrideRequestedPayload>>();

  apply(record: EventRecord): void {
    switch (record.type) {
      case "scoring.resultCaptured": {
        const payload = record.payload as ResultCapturedPayload;
        const resultsForCompetition = this.resultsFor(record.scope);
        const key = compositeKey(payload.roundNumber, payload.taskId, payload.rosterEntryId);
        const existing = resultsForCompetition.get(key) ?? [];
        const withoutSameKind = existing.filter((r) => r.resultKind !== payload.resultKind);
        withoutSameKind.push({
          id: `${key}|${payload.resultKind}`,
          competitionId: payload.competitionId,
          roundNumber: payload.roundNumber,
          taskId: payload.taskId,
          taskName: payload.taskName,
          rosterEntryId: payload.rosterEntryId,
          pilotId: payload.pilotId,
          raw: payload.raw,
          resultKind: payload.resultKind,
          capturedAt: payload.capturedAt,
        });
        resultsForCompetition.set(key, withoutSameKind);
        break;
      }
      case "scoring.lonePilotResolved": {
        const payload = record.payload as LonePilotResolvedPayload;
        const groupKey = compositeKey(payload.roundNumber, payload.taskId, String(payload.groupFlyingOrder));
        this.lonePilotResolutionsFor(record.scope).set(groupKey, { ...payload });
        break;
      }
      case "scoring.annulmentOverrideRequested": {
        const payload = record.payload as AnnulmentOverrideRequestedPayload;
        const groupKey = compositeKey(payload.roundNumber, payload.taskId, String(payload.groupFlyingOrder));
        this.annulmentRequestsFor(record.scope).set(groupKey, { ...payload });
        break;
      }
      case "competition.deleted": {
        if (record.scope !== "competitions") break;
        const payload = record.payload as { competitionId: string };
        this.results.delete(payload.competitionId);
        this.lonePilotResolutions.delete(payload.competitionId);
        this.annulmentRequests.delete(payload.competitionId);
        break;
      }
      default:
        break;
    }
  }

  rebuild(events: Iterable<EventRecord>): void {
    this.results = new Map();
    this.lonePilotResolutions = new Map();
    this.annulmentRequests = new Map();
    for (const event of events) {
      this.apply(event);
    }
  }

  getResults(
    competitionId: string,
    roundNumber: number,
    taskId: string,
    rosterEntryId: string,
  ): CapturedFlightResult[] {
    const key = compositeKey(roundNumber, taskId, rosterEntryId);
    return (this.results.get(competitionId)?.get(key) ?? []).map((r) => ({ ...r }));
  }

  getLonePilotResolution(
    competitionId: string,
    roundNumber: number,
    taskId: string,
    groupFlyingOrder: number,
  ): LonePilotResolvedPayload | undefined {
    const key = compositeKey(roundNumber, taskId, String(groupFlyingOrder));
    const resolution = this.lonePilotResolutions.get(competitionId)?.get(key);
    return resolution ? { ...resolution } : undefined;
  }

  getAnnulmentRequest(
    competitionId: string,
    roundNumber: number,
    taskId: string,
    groupFlyingOrder: number,
  ): AnnulmentOverrideRequestedPayload | undefined {
    const key = compositeKey(roundNumber, taskId, String(groupFlyingOrder));
    const request = this.annulmentRequests.get(competitionId)?.get(key);
    return request ? { ...request } : undefined;
  }

  // The exact query EntryScoresProvider.hasCapturedScores needs (STORY-001-011
  // seam activation): does this seat carry any genuinely captured result, in
  // any round/task, ever? Never answered from draw membership alone.
  hasCapturedResults(competitionId: string, rosterEntryId: string): boolean {
    for (const resultsByKey of this.results.get(competitionId)?.values() ?? []) {
      if (resultsByKey.some((r) => r.rosterEntryId === rosterEntryId)) return true;
    }
    return false;
  }

  private resultsFor(competitionId: string): Map<string, CapturedFlightResult[]> {
    let forCompetition = this.results.get(competitionId);
    if (!forCompetition) {
      forCompetition = new Map();
      this.results.set(competitionId, forCompetition);
    }
    return forCompetition;
  }

  private lonePilotResolutionsFor(competitionId: string): Map<string, LonePilotResolvedPayload> {
    let forCompetition = this.lonePilotResolutions.get(competitionId);
    if (!forCompetition) {
      forCompetition = new Map();
      this.lonePilotResolutions.set(competitionId, forCompetition);
    }
    return forCompetition;
  }

  private annulmentRequestsFor(competitionId: string): Map<string, AnnulmentOverrideRequestedPayload> {
    let forCompetition = this.annulmentRequests.get(competitionId);
    if (!forCompetition) {
      forCompetition = new Map();
      this.annulmentRequests.set(competitionId, forCompetition);
    }
    return forCompetition;
  }
}

function compositeKey(roundNumber: number, taskId: string, tail: string): string {
  return `${roundNumber}|${taskId}|${tail}`;
}
