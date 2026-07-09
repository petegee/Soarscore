import type { Competition } from "@soarscore/shared";
import type { EventRecord } from "../eventstore/event-store.js";

// Registry/lifecycle events file under one fixed scope; content events (roster,
// draw, scores in later stories) will file under scope = competitionId. This
// projection guards its scope first so it only ever sees competition.* events.
const SCOPE = "competitions";

// Derived state only (D4/D7) — safe to discard and rebuild from the log at any
// time. A competition.deleted tombstone drops the entry on both apply and
// rebuild, even though the original competition.created event remains in the log.
export class CompetitionProjection {
  private competitions = new Map<string, Competition>();

  apply(record: EventRecord): void {
    if (record.scope !== SCOPE) return;

    switch (record.type) {
      case "competition.created":
      case "competition.updated": {
        const payload = record.payload as {
          id: string;
          name: string;
          date: string;
          venue: string | null;
        };
        this.competitions.set(payload.id, {
          id: payload.id,
          name: payload.name,
          date: payload.date,
          venue: payload.venue,
        });
        break;
      }
      case "competition.deleted": {
        const payload = record.payload as { competitionId: string };
        this.competitions.delete(payload.competitionId);
        break;
      }
      default:
        break;
    }
  }

  rebuild(events: Iterable<EventRecord>): void {
    this.competitions = new Map();
    for (const event of events) {
      this.apply(event);
    }
  }

  getAll(): Competition[] {
    return [...this.competitions.values()].sort((a, b) => {
      const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      return byName !== 0 ? byName : a.id.localeCompare(b.id);
    });
  }

  getById(id: string): Competition | undefined {
    return this.competitions.get(id);
  }
}
