import type { CompetitionTaskConfig } from "@soarscore/shared";
import type { EventRecord } from "../eventstore/event-store.js";

// One projection for all competitions' task-config overlays — derived state only
// (D4/D7), safe to discard and rebuild from the log at any time. taskConfig.*
// events file under scope = competitionId, so this projection guards by that
// event type and files each overlay under its record's scope: one competition's
// config never bleeds into another's. A deleted competition drops its overlay so
// it never orphans (mirrors the roster projection).
export class CompetitionTaskConfigProjection {
  private configs = new Map<string, CompetitionTaskConfig>();

  apply(record: EventRecord): void {
    switch (record.type) {
      case "taskConfig.updated": {
        const payload = record.payload as CompetitionTaskConfig;
        this.configs.set(record.scope, this.copy(payload));
        break;
      }
      case "competition.deleted": {
        if (record.scope !== "competitions") break;
        const payload = record.payload as { competitionId: string };
        this.configs.delete(payload.competitionId);
        break;
      }
      default:
        break;
    }
  }

  rebuild(events: Iterable<EventRecord>): void {
    this.configs = new Map();
    for (const event of events) {
      this.apply(event);
    }
  }

  getConfig(competitionId: string): CompetitionTaskConfig | undefined {
    const config = this.configs.get(competitionId);
    return config ? this.copy(config) : undefined;
  }

  private copy(config: CompetitionTaskConfig): CompetitionTaskConfig {
    return {
      id: config.id,
      competitionId: config.competitionId,
      classModelId: config.classModelId,
      nlhValue: config.nlhValue,
      tasks: config.tasks.map((task) => ({
        taskId: task.taskId,
        baseTargetSeconds: task.baseTargetSeconds,
        roundOverrides: { ...task.roundOverrides },
      })),
    };
  }
}
