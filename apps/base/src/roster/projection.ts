import type { RosterEntry } from "@soarscore/shared";
import type { RosterEntryAddedPayload, RosterEntryReplacedPayload } from "@soarscore/shared";
import type { EventRecord } from "../eventstore/event-store.js";

// One projection for all competitions' rosters (RD2) — derived state only
// (D4/D7), safe to discard and rebuild from the log at any time. Roster events
// file under scope = competitionId, so this projection guards by recognising
// roster.* event types and files each entry under its record's scope: one
// competition's events never bleed into another's roster.
export class RosterProjection {
  private rosters = new Map<string, Map<string, RosterEntry>>();

  apply(record: EventRecord): void {
    switch (record.type) {
      case "roster.entryAdded":
      case "roster.entryUpdated": {
        const payload = record.payload as RosterEntryAddedPayload;
        this.rosterFor(record.scope).set(payload.id, {
          id: payload.id,
          competitionId: payload.competitionId,
          pilotId: payload.pilotId,
          pilotNumber: payload.pilotNumber,
          pilotClass: payload.pilotClass,
        });
        break;
      }
      case "roster.entryReplaced": {
        // Same entry id, payload's occupant/attributes win (RD4).
        const payload = record.payload as RosterEntryReplacedPayload;
        this.rosterFor(record.scope).set(payload.rosterEntryId, {
          id: payload.rosterEntryId,
          competitionId: payload.competitionId,
          pilotId: payload.pilotId,
          pilotNumber: payload.pilotNumber,
          pilotClass: payload.pilotClass,
        });
        break;
      }
      case "roster.entryRemoved": {
        const payload = record.payload as { rosterEntryId: string };
        this.rosters.get(record.scope)?.delete(payload.rosterEntryId);
        break;
      }
      case "competition.deleted": {
        // Drop the whole roster with its competition so stale entries never
        // block pilot deletion (RD1).
        if (record.scope !== "competitions") break;
        const payload = record.payload as { competitionId: string };
        this.rosters.delete(payload.competitionId);
        break;
      }
      default:
        break;
    }
  }

  rebuild(events: Iterable<EventRecord>): void {
    this.rosters = new Map();
    for (const event of events) {
      this.apply(event);
    }
  }

  getRoster(competitionId: string): RosterEntry[] {
    return [...(this.rosters.get(competitionId)?.values() ?? [])];
  }

  getEntry(competitionId: string, entryId: string): RosterEntry | undefined {
    return this.rosters.get(competitionId)?.get(entryId);
  }

  getCompetitionIdsForPilot(pilotId: string): string[] {
    const ids: string[] = [];
    for (const [competitionId, roster] of this.rosters) {
      for (const entry of roster.values()) {
        if (entry.pilotId === pilotId) {
          ids.push(competitionId);
          break;
        }
      }
    }
    return ids;
  }

  hasPilot(competitionId: string, pilotId: string): boolean {
    for (const entry of this.rosters.get(competitionId)?.values() ?? []) {
      if (entry.pilotId === pilotId) return true;
    }
    return false;
  }

  usedPilotNumbers(competitionId: string): Set<number> {
    const used = new Set<number>();
    for (const entry of this.rosters.get(competitionId)?.values() ?? []) {
      if (entry.pilotNumber !== null) used.add(entry.pilotNumber);
    }
    return used;
  }

  private rosterFor(competitionId: string): Map<string, RosterEntry> {
    let roster = this.rosters.get(competitionId);
    if (!roster) {
      roster = new Map();
      this.rosters.set(competitionId, roster);
    }
    return roster;
  }
}
