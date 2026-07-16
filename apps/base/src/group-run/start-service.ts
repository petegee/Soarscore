// STORY-001-044: group start control and manual run tasks (AC1–5, D3, D8, D10).
// The single deliberate operator action that starts every group, duration-shaped
// or manual-run. This story is the sole emitter of group.opened and (reactively)
// group.scored events. Structured by Approach §6's next-group resolution algorithm.
import type {
  Attribution,
  GroupMembership,
} from "@soarscore/shared";
import type { EventStore } from "../eventstore/event-store.js";
import type { GroupCompositionProvider } from "../draw/group-composition-provider.js";
import type { ClassModelProjection } from "../class-models/projection.js";
import type { CompetitionProjection } from "../competitions/projection.js";
import type { LifecycleProjection } from "../lifecycle/projection.js";
import type { FinalisationProgressProvider } from "../competitions/state-providers.js";
import { LifecycleGuard } from "../lifecycle/guard.js";
import { NoGroupReadyToStartError } from "./errors.js";

export interface GroupStartRequest {
  competitionId: string;
}

export interface GroupStartResponse {
  roundNumber: number;
  taskId: string;
  groupFlyingOrder: number;
  durationShaped: boolean;
  members: GroupMembership[];
}

export interface GroupRunSchedulerHook {
  onGroupStarted(competitionId: string, roundNumber: number, groupFlyingOrder: number): void;
}

export interface GroupCompletionReactorNotifier {
  notifyGroupOpened(competitionId: string, roundNumber: number, taskId: string, groupFlyingOrder: number): void;
}

// A stub no-op GroupRunSchedulerHook for testing before STORY-001-040 lands.
class StubGroupRunSchedulerHook implements GroupRunSchedulerHook {
  onGroupStarted(): void {
    // No-op: STORY-001-040's real scheduler not yet available
  }
}

export class GroupStartService {
  private openedGroups: Set<string> = new Set();

  constructor(
    private readonly eventStore: EventStore,
    private readonly groupCompositionProvider: GroupCompositionProvider,
    private readonly classModelProjection: ClassModelProjection,
    private readonly competitionProjection: CompetitionProjection,
    private readonly lifecycleProjection: LifecycleProjection,
    private readonly finalisationProgressProvider: FinalisationProgressProvider,
    private readonly lifecycleGuard: LifecycleGuard,
    private readonly groupRunScheduler: GroupRunSchedulerHook = new StubGroupRunSchedulerHook(),
    private readonly completionReactor?: GroupCompletionReactorNotifier,
  ) {
    // Rebuild the opened-groups fold from the event log
    this.rebuildOpenedGroups();
  }

  private rebuildOpenedGroups(): void {
    this.openedGroups.clear();
    for (const record of this.eventStore.readAll()) {
      if (record.type === "group.opened") {
        const payload = record.payload as {
          competitionId: string;
          roundNumber: number;
          taskId: string;
          groupFlyingOrder: number;
        };
        const key = `${payload.competitionId}:${payload.roundNumber}:${payload.taskId}:${payload.groupFlyingOrder}`;
        this.openedGroups.add(key);
      }
    }
  }

  startGroup(competitionId: string, attribution: Attribution): GroupStartResponse {
    // Check lifecycle state: must be Running/BetweenGroups
    const state = this.lifecycleProjection.getState(competitionId);
    if (state.state !== "Running" || state.runningSubState !== "BetweenGroups") {
      const { TransitionNotAllowedError } = require("../lifecycle/errors.js");
      throw new TransitionNotAllowedError(
        "Group start is only allowed when Running and between groups",
        state.state,
        "GroupStart",
      );
    }

    // Get the competition to find its class model
    const competition = this.competitionProjection.getById(competitionId);
    if (!competition) {
      throw new Error(`Competition ${competitionId} not found`);
    }

    const model = this.classModelProjection.getById(competition.classModelId);
    if (!model) {
      throw new Error(`Class model ${competition.classModelId} not found`);
    }

    // Approach §6: derive the next group to open
    const round = this.finalisationProgressProvider.completedRounds(competitionId) + 1;

    // Iterate over model.tasks in declared order
    for (const task of model.tasks) {
      const groups = this.groupCompositionProvider.getEffectiveGroups(competitionId, round, task.id);

      // For each group in flying order
      for (const group of groups) {
        const key = `${competitionId}:${round}:${task.id}:${group.flyingOrder}`;
        if (!this.openedGroups.has(key)) {
          // This is the first unopened group
          const taskId = task.id;
          const isDurationShaped = task.isDurationShaped ?? false;

          // Append group.opened event
          this.eventStore.append({
            scope: competitionId,
            type: "group.opened",
            payload: {
              competitionId,
              roundNumber: round,
              taskId,
              groupFlyingOrder: group.flyingOrder,
            },
            attribution,
          });

          // Track the opened group
          this.openedGroups.add(key);

          // If duration-shaped, invoke the scheduler hook
          if (isDurationShaped) {
            this.groupRunScheduler.onGroupStarted(competitionId, round, group.flyingOrder);
          } else {
            // If manual-run, notify the completion reactor
            this.completionReactor?.notifyGroupOpened(competitionId, round, taskId, group.flyingOrder);
          }

          return {
            roundNumber: round,
            taskId,
            groupFlyingOrder: group.flyingOrder,
            durationShaped: isDurationShaped,
            members: group.members,
          };
        }
      }
    }

    // No unopened group found
    throw new NoGroupReadyToStartError(
      `No unopened group found for round ${round}. All task-groups have been opened or draw is incomplete.`
    );
  }
}
