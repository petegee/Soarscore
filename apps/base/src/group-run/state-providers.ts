// STORY-001-040: group-run state provider seams and implementations. Mirrors
// apps/base/src/competitions/state-providers.ts's LockStateProvider /
// FinalisationProgressProvider shape exactly.

import type { GroupRunProjection } from "./projection.js";
import {
  FieldAidSettingsNotConfiguredError,
  NoDurationShapedTaskConfiguredError,
} from "./errors.js";

// GroupRunPhaseProvider is defined in STORY-001-032's service.ts; it is the
// interface this story implements for real via ProjectionGroupRunPhaseProvider.

// Duration source seam: provides phase durations. Real implementation reads
// from CompetitionTaskConfigService (workingTimeSeconds) and
// FieldAidSettingsProvider (prep/landing).
export interface DurationSource {
  workingTimeSeconds(competitionId: string, roundNumber: number): Promise<number>;
  preparationSeconds(competitionId: string): Promise<number>;
  landingWindowSeconds(competitionId: string): Promise<number>;
}

// Task shape provider seam: classifies whether a task is duration-shaped
// (automatic phases) or manual-run (STORY-001-044 decides completion).
// STORY-001-044 owns the isDurationShaped field on TaskParameterSet; this
// story is a consumer only via this seam.
export interface TaskShapeProvider {
  isDurationShaped(competitionId: string, roundNumber: number): Promise<boolean>;
}

// Field-aid settings seam: provides prep/landing durations. Area 3.8 owns
// real configuration; this story ships only the seam and an explicit, clearly-
// labelled stub that throws until 3.8 lands. Never a silent hard-coded number.
export interface FieldAidSettingsProvider {
  preparationSeconds(competitionId: string): Promise<number>;
  landingWindowSeconds(competitionId: string): Promise<number>;
}

// Stub field-aid settings provider: throws until Area 3.8 lands.
// STORY-001-040 only — the real implementation is STORY-001-043/Area-3.8's
// scope (apps/base/src/competitions/state-providers.ts notes this gap at line 91).
export class UnconfiguredFieldAidSettingsProvider implements FieldAidSettingsProvider {
  async preparationSeconds(_competitionId: string): Promise<number> {
    throw new FieldAidSettingsNotConfiguredError(
      "Field-aid settings (preparation/landing duration) are not yet configured. This is Area 3.8 scope, deferred post-MVP.",
    );
  }

  async landingWindowSeconds(_competitionId: string): Promise<number> {
    throw new FieldAidSettingsNotConfiguredError(
      "Field-aid settings (preparation/landing duration) are not yet configured. This is Area 3.8 scope, deferred post-MVP.",
    );
  }
}

// Real provider implementation: reads working-time from task-config adapter,
// delegates prep/landing to FieldAidSettingsProvider seam.
export class TaskConfigDurationSource implements DurationSource {
  constructor(
    private readonly taskConfigService: any, // Type would be CompetitionTaskConfigService, but we avoid direct import to prevent cycles
    private readonly fieldAidSettings: FieldAidSettingsProvider,
  ) {}

  async workingTimeSeconds(competitionId: string, roundNumber: number): Promise<number> {
    const config = this.taskConfigService.get(competitionId);
    if (!config) {
      throw new NoDurationShapedTaskConfiguredError(
        `No task configuration found for competition ${competitionId}`,
      );
    }
    // Default to first task's base target (MVP single-task model);
    // STORY-001-020 will extend this to per-task lookup by taskId.
    const task = config.tasks[0];
    if (!task || task.baseTargetSeconds === 0) {
      throw new NoDurationShapedTaskConfiguredError(
        `No working-time duration configured for competition ${competitionId}, round ${roundNumber}`,
      );
    }
    return task.baseTargetSeconds;
  }

  async preparationSeconds(competitionId: string): Promise<number> {
    return this.fieldAidSettings.preparationSeconds(competitionId);
  }

  async landingWindowSeconds(competitionId: string): Promise<number> {
    return this.fieldAidSettings.landingWindowSeconds(competitionId);
  }
}

// Stub task shape provider: TEMPORARY — all tasks default duration-shaped
// until STORY-001-044 adds the real isDurationShaped field to TaskParameterSet.
// STORY-001-040 only — the real implementation reads TaskParameterSet.isDurationShaped
// once STORY-001-044 lands and owns that field fully. This stub is a clear,
// temporary marker of the gap.
export class TemporaryAllDurationShapedProvider implements TaskShapeProvider {
  async isDurationShaped(
    _competitionId: string,
    _roundNumber: number,
  ): Promise<boolean> {
    // TEMPORARY: All tasks are duration-shaped until STORY-001-044 adds
    // the real isDurationShaped classification. Once that field exists and
    // is populated by STORY-001-044, replace this stub with:
    //   const config = this.taskConfigService.get(competitionId);
    //   const task = config.tasks.find(t => t.taskId === taskId);
    //   return task?.isDurationShaped ?? false;
    return true;
  }
}

// Real provider: reads from projection. Satisfies STORY-001-032's stubbed
// GroupRunPhaseProvider interface — the real implementation STORY-001-032
// already committed to expecting.
export class ProjectionGroupRunPhaseProvider {
  constructor(private readonly projection: GroupRunProjection) {}

  async getPhase(
    competitionId: string,
    roundNumber: number,
    groupFlyingOrder: number,
  ): Promise<any | null> {
    // Delegate to projection's currentPhase method. This is safe because the
    // projection is a partial function only ever called for an active run
    // (callers check RunningSubState first per Approach §8).
    return this.projection.currentPhase(competitionId, roundNumber, groupFlyingOrder);
  }
}
