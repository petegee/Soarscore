import { stockModelIdFor, type ContestTemplate, type Discipline } from "@soarscore/shared";
import type { EventRecord } from "../eventstore/event-store.js";

const SCOPE = "master-data";

// Derived state only (D4/D7) — safe to discard and rebuild from the log at
// any time. pilotClasses is deep-copied on apply so no two projected templates
// alias the same array. contestTemplate.seeded is audit-only (RD4) and is
// deliberately ignored here.
export class TemplateProjection {
  private templates = new Map<string, ContestTemplate>();

  apply(record: EventRecord): void {
    if (record.scope !== SCOPE) return;

    switch (record.type) {
      case "contestTemplate.created":
      case "contestTemplate.updated": {
        const payload = record.payload as {
          id: string;
          name: string;
          // New events carry classModelId; legacy events carry discipline only.
          classModelId?: string;
          discipline?: Discipline;
          pilotNumbersEnabled: boolean;
          pilotClassesEnabled: boolean;
          pilotClasses: string[];
        };
        // Back-fill (D12): a legacy discipline payload resolves to its stock
        // model on rebuild — no log rewrite.
        const classModelId =
          payload.classModelId ??
          (payload.discipline ? stockModelIdFor(payload.discipline) : "");
        this.templates.set(payload.id, {
          id: payload.id,
          name: payload.name,
          classModelId,
          pilotNumbersEnabled: payload.pilotNumbersEnabled,
          pilotClassesEnabled: payload.pilotClassesEnabled,
          pilotClasses: [...payload.pilotClasses],
        });
        break;
      }
      case "contestTemplate.deleted": {
        const payload = record.payload as { templateId: string };
        this.templates.delete(payload.templateId);
        break;
      }
      default:
        break;
    }
  }

  rebuild(events: Iterable<EventRecord>): void {
    this.templates = new Map();
    for (const event of events) {
      this.apply(event);
    }
  }

  getAll(): ContestTemplate[] {
    return [...this.templates.values()].sort((a, b) => {
      const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      return byName !== 0 ? byName : a.id.localeCompare(b.id);
    });
  }

  getById(id: string): ContestTemplate | undefined {
    return this.templates.get(id);
  }

  // Trimmed, case-insensitive lookup for the RD3 name-uniqueness invariant.
  findByName(name: string): ContestTemplate | undefined {
    const key = name.trim().toLowerCase();
    for (const template of this.templates.values()) {
      if (template.name.toLowerCase() === key) return template;
    }
    return undefined;
  }
}
