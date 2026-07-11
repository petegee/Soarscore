import crypto from "node:crypto";
import { z, type ZodType } from "zod";
import {
  updateCompetitionTaskConfigRequestSchema,
  taskConfigToPayload,
  type Attribution,
  type Competition,
  type CompetitionTaskConfig,
  type ContestClassModel,
  type TaskConfigEntry,
} from "@soarscore/shared";
import type { EventStore } from "../eventstore/event-store.js";
import type { CompetitionProjection } from "../competitions/projection.js";
import type { ClassModelProjection } from "../class-models/projection.js";
import type { CompetitionTaskConfigProjection } from "./projection.js";
import {
  CompetitionTaskConfigNotFoundError,
  NlhNotApplicableError,
  PerRoundOverrideNotAllowedError,
  TaskNotFoundError,
  ValidationError,
} from "./errors.js";

export class CompetitionTaskConfigService {
  constructor(
    private readonly eventStore: EventStore,
    private readonly projection: CompetitionTaskConfigProjection,
    private readonly competitionProjection: CompetitionProjection,
    private readonly classModelProjection: ClassModelProjection,
  ) {}

  // The merged view: the class model supplies the task list and defaults; the
  // saved overlay (if any) supplies per-event base target times, per-round
  // overrides and the NLH value. 404 only if the competition itself is absent —
  // a competition with no overlay yet returns pure defaults.
  get(competitionId: string): CompetitionTaskConfig {
    const competition = this.getCompetition(competitionId);
    const model = this.getModel(competition);
    return this.merge(competition, model, this.projection.getConfig(competitionId));
  }

  update(competitionId: string, input: unknown, attribution: Attribution): CompetitionTaskConfig {
    const competition = this.getCompetition(competitionId);
    const model = this.getModel(competition);
    const parsed = parseOrThrow(updateCompetitionTaskConfigRequestSchema, input);

    const modelTasks = new Map(model.tasks.map((task) => [task.id, task]));
    const nlhApplicableAnywhere = model.tasks.some((task) => task.nlhApplicable);

    // Cross-aggregate validation (Zod cannot see the sibling class model).
    for (const entry of parsed.tasks) {
      const modelTask = modelTasks.get(entry.taskId);
      if (!modelTask) {
        throw new TaskNotFoundError(
          `Task ${entry.taskId} is not part of this competition's class model`,
        );
      }
      const hasOverrides = Object.keys(entry.roundOverrides).length > 0;
      if (hasOverrides && !modelTask.perRoundOverrideAllowed) {
        throw new PerRoundOverrideNotAllowedError(
          `Task "${modelTask.name}" has a rule-fixed working time; per-round overrides are not permitted`,
        );
      }
    }
    // AC6: an NLH value only belongs to a competition whose class scores launch
    // height; never demanded, but rejected where it has no home.
    if (parsed.nlhValue !== null && !nlhApplicableAnywhere) {
      throw new NlhNotApplicableError(
        "This competition's class has no Nominal Launch Height to set",
      );
    }

    // Persist only overrides/values (NFR-1) — never a copy of the model shape.
    // Overlay entries are keyed by taskId; only tasks the client sent are stored,
    // the rest inherit model defaults on read.
    const existing = this.projection.getConfig(competitionId);
    const config: CompetitionTaskConfig = {
      id: existing?.id ?? crypto.randomUUID(),
      competitionId,
      classModelId: model.id,
      nlhValue: parsed.nlhValue,
      tasks: parsed.tasks.map((entry) => ({
        taskId: entry.taskId,
        baseTargetSeconds: entry.baseTargetSeconds,
        roundOverrides: { ...entry.roundOverrides },
      })),
    };

    const record = this.eventStore.append({
      scope: competitionId,
      type: "taskConfig.updated",
      payload: taskConfigToPayload(config),
      attribution,
    });
    this.projection.apply(record);
    return this.merge(competition, model, this.projection.getConfig(competitionId));
  }

  private getCompetition(competitionId: string): Competition {
    const competition = this.competitionProjection.getById(competitionId);
    if (!competition) {
      throw new CompetitionTaskConfigNotFoundError(`Competition ${competitionId} not found`);
    }
    return competition;
  }

  private getModel(competition: Competition): ContestClassModel {
    const model = this.classModelProjection.getById(competition.classModelId);
    if (!model) {
      // A competition can never reference a missing model (AC9 of 016 blocks
      // deletion), so this is a genuine integrity fault, not a client 404.
      throw new CompetitionTaskConfigNotFoundError(
        `Class model ${competition.classModelId} not found`,
      );
    }
    return model;
  }

  // Overlay overlaid on model defaults. One entry per model task, in model order;
  // a saved entry supplies the base target and overrides, otherwise the task
  // defaults (null base, no overrides). nlhValue comes from the overlay.
  private merge(
    _competition: Competition,
    model: ContestClassModel,
    overlay: CompetitionTaskConfig | undefined,
  ): CompetitionTaskConfig {
    const saved = new Map((overlay?.tasks ?? []).map((entry) => [entry.taskId, entry]));
    const tasks: TaskConfigEntry[] = model.tasks.map((task) => {
      const entry = saved.get(task.id);
      return {
        taskId: task.id,
        baseTargetSeconds: entry?.baseTargetSeconds ?? null,
        roundOverrides: entry ? { ...entry.roundOverrides } : {},
      };
    });
    return {
      id: overlay?.id ?? `defaults:${model.id}`,
      competitionId: _competition.id,
      classModelId: model.id,
      nlhValue: overlay?.nlhValue ?? null,
      tasks,
    };
  }
}

function parseOrThrow<S extends ZodType<unknown, z.ZodTypeDef, unknown>>(
  schema: S,
  input: unknown,
): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError("Validation failed", result.error.flatten());
  }
  return result.data;
}
