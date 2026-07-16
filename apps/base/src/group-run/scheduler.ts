// STORY-001-040: group-run scheduler. The one genuinely new mechanism in this
// codebase: decides when a phase's duration has elapsed and appends the next
// groupRun.* event. Ticks on a short interval or lazily on read, but must
// guarantee the transition is appended at most once per boundary (idempotent
// under concurrent reads).

import type { EventStore } from "../eventstore/event-store.js";
import type { GroupRunProjection } from "./projection.js";
import type { DurationSource, TaskShapeProvider } from "./state-providers.js";
import {
  FieldAidSettingsNotConfiguredError,
  NoDurationShapedTaskConfiguredError,
} from "./errors.js";

const SYSTEM_ACTOR_NAME = "system";
const SYSTEM_CLIENT_ID = "group-run-engine";

// Internal tracking: which transitions have been appended to avoid duplicate
// appends on concurrent reads. Key: competitionId:roundNumber:groupFlyingOrder:phase.
type TransitionKey = string;

function makeKey(competitionId: string, roundNumber: number, groupFlyingOrder: number): string {
  return `${competitionId}:${roundNumber}:${groupFlyingOrder}`;
}

function makeTransitionKey(
  competitionId: string,
  roundNumber: number,
  groupFlyingOrder: number,
  targetPhase: string,
): TransitionKey {
  return `${makeKey(competitionId, roundNumber, groupFlyingOrder)}:${targetPhase}`;
}

export class GroupRunScheduler {
  private readonly transitionedRuns = new Set<TransitionKey>();
  private tickInterval?: ReturnType<typeof setInterval>;

  constructor(
    private readonly eventStore: EventStore,
    private readonly projection: GroupRunProjection,
    private readonly durationSource: DurationSource,
    private readonly taskShapeProvider: TaskShapeProvider,
  ) {}

  // Start the scheduler's tick loop (called from app.ts on startup).
  start(tickIntervalMs: number = 1000): void {
    if (this.tickInterval) {
      return; // Already started
    }
    this.tickInterval = setInterval(() => this.tick(), tickIntervalMs);
  }

  // Stop the scheduler (called on app shutdown).
  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = undefined;
    }
  }

  // Invoked by STORY-001-044 when it appends group.opened. Checks if the
  // round's task is duration-shaped; if so, kicks off preparation.
  async onGroupStarted(
    competitionId: string,
    roundNumber: number,
    groupFlyingOrder: number,
  ): Promise<void> {
    // Check if this task is duration-shaped; if not, STORY-001-044 handles
    // it, not this engine.
    try {
      const isDuration = await this.taskShapeProvider.isDurationShaped(competitionId, roundNumber);
      if (!isDuration) {
        return; // Manual-run task; nothing to do here.
      }
    } catch (error) {
      // TaskShapeProvider threw (unlikely in normal operation); log and bail.
      console.error("TaskShapeProvider error in onGroupStarted:", error);
      return;
    }

    // Read preparation duration from config.
    let prepDuration: number;
    try {
      prepDuration = await this.durationSource.preparationSeconds(competitionId);
    } catch (error) {
      if (error instanceof FieldAidSettingsNotConfiguredError) {
        console.error("Preparation duration not configured; skipping group start:", error);
        return;
      }
      throw error;
    }

    // Append groupRun.preparationStarted.
    this.eventStore.append({
      scope: competitionId,
      type: "groupRun.preparationStarted",
      payload: {
        competitionId,
        roundNumber,
        groupFlyingOrder,
        durationSeconds: prepDuration,
      },
      attribution: {
        actorName: SYSTEM_ACTOR_NAME,
        originClient: SYSTEM_CLIENT_ID,
        authority: "system",
      },
    });

    const key = makeKey(competitionId, roundNumber, groupFlyingOrder);
    this.transitionedRuns.add(key);
  }

  // The scheduler's tick: check all known runs for phase-duration expiry and
  // append transitions as needed.
  private async tick(): Promise<void> {
    // Since we don't expose an enumeration of all active runs, this tick
    // is a no-op in the current design. The real implementation would need
    // a way to know which runs are currently active. For now, rely on lazy
    // checking in checkAdvance (called by consumers).
    // In a production implementation, the projection would expose an
    // getActiveRuns() method or the scheduler would maintain its own registry.
  }

  // Lazy check: invoked by consumers (board, audio, device) on read to
  // advance the phase if its duration has elapsed. Must be idempotent.
  async checkAdvance(
    competitionId: string,
    roundNumber: number,
    groupFlyingOrder: number,
  ): Promise<void> {
    const phase = this.projection.currentPhase(competitionId, roundNumber, groupFlyingOrder);
    if (!phase) {
      return; // No active run for this key.
    }

    if (phase.remainingSeconds > 0) {
      return; // Duration not elapsed yet.
    }

    const key = makeKey(competitionId, roundNumber, groupFlyingOrder);

    // Idempotency: only transition once per boundary.
    if (phase.phase === "Preparation") {
      const transitionKey = makeTransitionKey(competitionId, roundNumber, groupFlyingOrder, "WorkingTime");
      if (this.transitionedRuns.has(transitionKey)) {
        return; // Already transitioned to working time.
      }

      let workingTimeDuration: number;
      try {
        workingTimeDuration = await this.durationSource.workingTimeSeconds(
          competitionId,
          roundNumber,
        );
      } catch (error) {
        if (error instanceof NoDurationShapedTaskConfiguredError) {
          console.error("Working-time duration not configured:", error);
          return;
        }
        throw error;
      }

      // Append groupRun.workingTimeStarted. The timestamp is the AC3 boundary.
      this.eventStore.append({
        scope: competitionId,
        type: "groupRun.workingTimeStarted",
        payload: {
          competitionId,
          roundNumber,
          groupFlyingOrder,
          durationSeconds: workingTimeDuration,
        },
        attribution: {
          actorName: SYSTEM_ACTOR_NAME,
          originClient: SYSTEM_CLIENT_ID,
          authority: "system",
        },
      });

      this.transitionedRuns.add(transitionKey);
      return;
    }

    if (phase.phase === "WorkingTime") {
      const transitionKey = makeTransitionKey(competitionId, roundNumber, groupFlyingOrder, "Landing");
      if (this.transitionedRuns.has(transitionKey)) {
        return; // Already transitioned to landing.
      }

      let landingDuration: number;
      try {
        landingDuration = await this.durationSource.landingWindowSeconds(competitionId);
      } catch (error) {
        if (error instanceof FieldAidSettingsNotConfiguredError) {
          console.error("Landing duration not configured:", error);
          return;
        }
        throw error;
      }

      // Append groupRun.landingWindowStarted. The timestamp doubles as AC3 boundary.
      this.eventStore.append({
        scope: competitionId,
        type: "groupRun.landingWindowStarted",
        payload: {
          competitionId,
          roundNumber,
          groupFlyingOrder,
          durationSeconds: landingDuration,
        },
        attribution: {
          actorName: SYSTEM_ACTOR_NAME,
          originClient: SYSTEM_CLIENT_ID,
          authority: "system",
        },
      });

      this.transitionedRuns.add(transitionKey);
      return;
    }

    if (phase.phase === "Landing") {
      const transitionKey = makeTransitionKey(competitionId, roundNumber, groupFlyingOrder, "Completed");
      if (this.transitionedRuns.has(transitionKey)) {
        return; // Already transitioned to completed.
      }

      // Append groupRun.completed.
      this.eventStore.append({
        scope: competitionId,
        type: "groupRun.completed",
        payload: {
          competitionId,
          roundNumber,
          groupFlyingOrder,
        },
        attribution: {
          actorName: SYSTEM_ACTOR_NAME,
          originClient: SYSTEM_CLIENT_ID,
          authority: "system",
        },
      });

      this.transitionedRuns.add(transitionKey);
      return;
    }
  }
}
