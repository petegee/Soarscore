// STORY-001-044: group start control and manual run tasks (AC1–5, D3, D8, D10).
// Reactive group completion for manual-run groups. Monitors capture-shaped facts
// and emits group.scored when all outstanding items for a group resolve.
// For duration-shaped groups, receives onGroupRunCompleted callbacks from
// STORY-001-040's scheduler.
import type { EventStore, EventRecord } from "../eventstore/event-store.js";
import type { LifecycleProjection } from "../lifecycle/projection.js";
import type { GroupCompositionProvider } from "../draw/group-composition-provider.js";
import type { ClassModelProjection } from "../class-models/projection.js";
import type { ScoreCompletenessProvider } from "../scoring/completeness-provider.js";
import type { NoScoreOutstandingProvider, ReflightOutstandingProvider } from "../competitions/state-providers.js";
import { GroupCompletionReactorNotifier } from "./start-service.js";

interface OpenGroup {
  competitionId: string;
  roundNumber: number;
  taskId: string;
  groupFlyingOrder: number;
}

export class GroupCompletionReactor implements GroupCompletionReactorNotifier {
  private currentOpenGroup: OpenGroup | null = null;
  private subscription: (() => void) | null = null;

  constructor(
    private readonly eventStore: EventStore,
    private readonly lifecycleProjection: LifecycleProjection,
    private readonly groupCompositionProvider: GroupCompositionProvider,
    private readonly classModelProjection: ClassModelProjection,
    private readonly scoreCompletenessProvider: ScoreCompletenessProvider,
    private readonly noScoreOutstandingProvider: NoScoreOutstandingProvider,
    private readonly reflightOutstandingProvider: ReflightOutstandingProvider,
  ) {}

  notifyGroupOpened(
    competitionId: string,
    roundNumber: number,
    taskId: string,
    groupFlyingOrder: number,
  ): void {
    // Check if this task is manual-run (isDurationShaped === false)
    const model = this.getModelByCompetitionId(competitionId);
    if (!model) return;

    const task = model.tasks.find((t) => t.id === taskId);
    if (!task || task.isDurationShaped) {
      // Duration-shaped tasks don't use this reactor path
      return;
    }

    // Set the currently open manual-run group
    this.currentOpenGroup = {
      competitionId,
      roundNumber,
      taskId,
      groupFlyingOrder,
    };
  }

  async onGroupRunCompleted(
    competitionId: string,
    roundNumber: number,
    taskId: string,
    groupFlyingOrder: number,
  ): Promise<void> {
    // Called by STORY-001-040's scheduler for duration-shaped groups
    await this.closeGroup(competitionId, roundNumber, taskId, groupFlyingOrder);
  }

  async onCaptureShapedFact(_competitionId: string, _roundNumber: number, _taskId: string): Promise<void> {
    // This method would be called by a post-append hook when scoring facts arrive
    // For now, this is a placeholder for the reactive listener pattern
    if (!this.currentOpenGroup) return;

    const { competitionId, roundNumber, taskId, groupFlyingOrder } = this.currentOpenGroup;

    // Only process if the group is still open
    const state = this.lifecycleProjection.getState(competitionId);
    if (state.state !== "Running" || state.runningSubState !== "GroupInProgress") {
      this.currentOpenGroup = null;
      return;
    }

    // Check if task is manual-run
    const model = this.getModelByCompetitionId(competitionId);
    if (!model) return;

    const task = model.tasks.find((t) => t.id === taskId);
    if (!task || task.isDurationShaped) {
      // Duration-shaped uses the other path
      return;
    }

    // Perform completeness check for this group's seats
    const groups = this.groupCompositionProvider.getEffectiveGroups(competitionId, roundNumber, taskId);
    const openGroup = groups.find((g) => g.flyingOrder === groupFlyingOrder);
    if (!openGroup) return;

    const seatedIds = openGroup.members.map((m) => m.rosterEntryId);

    // Check resolved-inclusive: all three conditions must hold
    const uncapturedSeats = await this.scoreCompletenessProvider.uncapturedSeats(
      competitionId,
      roundNumber,
      taskId,
      groupFlyingOrder,
      seatedIds,
    );

    if (uncapturedSeats.length > 0) {
      // Still waiting for captures
      return;
    }

    const outstandingNoScores = await this.noScoreOutstandingProvider.outstandingNoScores(
      competitionId,
      roundNumber,
    );
    const groupNoScores = outstandingNoScores.filter((item) => seatedIds.includes(item.rosterEntryId));
    if (groupNoScores.length > 0) {
      // Still waiting for no-score resolutions
      return;
    }

    const outstandingReflights = await this.reflightOutstandingProvider.outstandingReflights(
      competitionId,
      roundNumber,
    );
    const groupReflights = outstandingReflights.filter((item) =>
      seatedIds.some((id) => id === item.rosterEntryId)
    );
    if (groupReflights.length > 0) {
      // Still waiting for reflight resolutions
      return;
    }

    // All items resolved - close the group
    await this.closeGroup(competitionId, roundNumber, taskId, groupFlyingOrder);
  }

  private async closeGroup(
    competitionId: string,
    roundNumber: number,
    taskId: string,
    groupFlyingOrder: number,
  ): Promise<void> {
    // Idempotency guard: if group is no longer open, this is a no-op
    const state = this.lifecycleProjection.getState(competitionId);
    if (state.state !== "Running" || state.runningSubState !== "GroupInProgress") {
      return;
    }

    // Check if this is the currently open group - if not, also a no-op
    // (another group might have been opened since)
    if (
      this.currentOpenGroup &&
      (this.currentOpenGroup.groupFlyingOrder !== groupFlyingOrder ||
        this.currentOpenGroup.taskId !== taskId ||
        this.currentOpenGroup.roundNumber !== roundNumber)
    ) {
      return;
    }

    // Append group.scored with system attribution
    this.eventStore.append({
      scope: competitionId,
      type: "group.scored",
      payload: {
        competitionId,
        roundNumber,
        taskId,
        groupFlyingOrder,
      },
      attribution: {
        actorName: "system",
        originClient: "group-run-engine",
        authority: "system",
      },
    });

    // Clear the open group
    this.currentOpenGroup = null;
  }

  private getModelByCompetitionId(competitionId: string) {
    // Helper to get the class model for a competition
    // This would normally be injected or cached
    for (const record of this.eventStore.readAll()) {
      if (record.type === "competition.created" && record.scope === competitionId) {
        const payload = record.payload as { classModelId: string };
        return this.classModelProjection.getById(payload.classModelId);
      }
    }
    return null;
  }

  start(): void {
    // Start listening to events
    // This would be called during app initialization
    // For now, this is a placeholder for the subscription mechanism
  }

  stop(): void {
    // Stop listening to events
    if (this.subscription) {
      this.subscription();
      this.subscription = null;
    }
  }
}
