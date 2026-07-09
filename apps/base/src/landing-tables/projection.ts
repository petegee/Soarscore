import type { LandingBonusEntry, LandingBonusTable } from "@soarscore/shared";
import type { EventRecord } from "../eventstore/event-store.js";

const SCOPE = "master-data";

// Derived state only (D4/D7) — safe to discard and rebuild from the log at
// any time. Entries are deep-copied on apply so no two projected tables
// (especially a duplicate and its source) alias the same array (AC3).
export class LandingTableProjection {
  private tables = new Map<string, LandingBonusTable>();

  apply(record: EventRecord): void {
    if (record.scope !== SCOPE) return;

    switch (record.type) {
      case "landingTable.created":
      case "landingTable.updated": {
        const payload = record.payload as {
          id: string;
          name: string;
          entries: LandingBonusEntry[];
        };
        this.tables.set(payload.id, {
          id: payload.id,
          name: payload.name,
          entries: payload.entries.map((e) => ({ ...e })),
        });
        break;
      }
      case "landingTable.deleted": {
        const payload = record.payload as { tableId: string };
        this.tables.delete(payload.tableId);
        break;
      }
      default:
        break;
    }
  }

  rebuild(events: Iterable<EventRecord>): void {
    this.tables = new Map();
    for (const event of events) {
      this.apply(event);
    }
  }

  getAll(): LandingBonusTable[] {
    return [...this.tables.values()].sort((a, b) => {
      const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      return byName !== 0 ? byName : a.id.localeCompare(b.id);
    });
  }

  getById(id: string): LandingBonusTable | undefined {
    return this.tables.get(id);
  }
}
