import { copyTaskParameterSet, type ContestClassModel } from "@soarscore/shared";
import type { EventRecord } from "../eventstore/event-store.js";

const SCOPE = "master-data";

// Derived state only (D4/D7) — safe to discard and rebuild from the log at any
// time. Nested rule structures (dropWorst, each task's precision / coefficients /
// penalties / owned table) are deep-copied on apply so no two projected models —
// especially a clone and its stock source — alias the same object (AC5).
export class ClassModelProjection {
  private models = new Map<string, ContestClassModel>();

  apply(record: EventRecord): void {
    if (record.scope !== SCOPE) return;

    switch (record.type) {
      case "classModel.seeded":
      case "classModel.created":
      case "classModel.updated": {
        const payload = record.payload as ContestClassModel;
        this.models.set(payload.id, this.copy(payload));
        break;
      }
      case "classModel.deleted": {
        const payload = record.payload as { modelId: string };
        this.models.delete(payload.modelId);
        break;
      }
      default:
        break;
    }
  }

  rebuild(events: Iterable<EventRecord>): void {
    this.models = new Map();
    for (const event of events) {
      this.apply(event);
    }
  }

  // Stock models first (in class order), then custom models by name — so the
  // seeded catalogue reads predictably and clones follow their sources.
  getAll(): ContestClassModel[] {
    return [...this.models.values()].sort((a, b) => {
      if (a.origin !== b.origin) return a.origin === "stock" ? -1 : 1;
      const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      return byName !== 0 ? byName : a.id.localeCompare(b.id);
    });
  }

  getById(id: string): ContestClassModel | undefined {
    const model = this.models.get(id);
    return model ? this.copy(model) : undefined;
  }

  // Trimmed, case-insensitive lookup across ALL models (stock + custom) for the
  // name-uniqueness invariant (AC10) — stock names participate.
  findByName(name: string): ContestClassModel | undefined {
    const key = name.trim().toLowerCase();
    for (const model of this.models.values()) {
      if (model.name.toLowerCase() === key) return this.copy(model);
    }
    return undefined;
  }

  private copy(model: ContestClassModel): ContestClassModel {
    return {
      ...model,
      dropWorst: { ...model.dropWorst },
      tasks: model.tasks.map(copyTaskParameterSet),
    };
  }
}
