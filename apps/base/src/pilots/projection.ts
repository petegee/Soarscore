import type { Pilot } from "@soarscore/shared";
import type { EventRecord } from "../eventstore/event-store.js";

const SCOPE = "master-data";

// Derived state only (D4/D7) — safe to discard and rebuild from the log at
// any time. No projected SQL tables at this scale.
export class PilotLibraryProjection {
  private pilots = new Map<string, Pilot>();

  apply(record: EventRecord): void {
    if (record.scope !== SCOPE) return;

    switch (record.type) {
      case "pilot.created":
      case "pilot.updated": {
        const payload = record.payload as {
          id: string;
          name: string;
          registrationId: string | null;
          club: string | null;
          contact: string | null;
        };
        this.pilots.set(payload.id, {
          id: payload.id,
          name: payload.name,
          registrationId: payload.registrationId,
          club: payload.club,
          contact: payload.contact,
        });
        break;
      }
      case "pilot.deleted": {
        const payload = record.payload as { pilotId: string };
        this.pilots.delete(payload.pilotId);
        break;
      }
      default:
        break;
    }
  }

  rebuild(events: Iterable<EventRecord>): void {
    this.pilots = new Map();
    for (const event of events) {
      this.apply(event);
    }
  }

  getAll(): Pilot[] {
    return [...this.pilots.values()].sort((a, b) => {
      const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      return byName !== 0 ? byName : a.id.localeCompare(b.id);
    });
  }

  getById(id: string): Pilot | undefined {
    return this.pilots.get(id);
  }
}
