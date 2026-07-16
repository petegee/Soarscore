// STORY-001-044: group start control and manual run tasks (AC1–5, D3, D8, D10).
// Read-only prep-gate hold state view. Surfaces whether a prep confirmation
// gate is held and which devices are blocking it. Never exposes a gate-release
// capability (AC5, Scope Out).
import type { LifecycleProjection } from "../lifecycle/projection.js";
import type { RosterProjection } from "../roster/projection.js";

export interface GroupRunPhaseProvider {
  currentPhase(
    competitionId: string,
    roundNumber: number,
    groupFlyingOrder: number,
  ): GroupRunPhase | null;
}

export interface GroupRunPhase {
  competitionId: string;
  roundNumber: number;
  groupFlyingOrder: number;
  phase: "Preparation" | "WorkingTime" | "Landing";
  remainingSeconds: number;
  prepGateHeld: boolean;
  blockingDeviceIds: string[];
}

export interface OutstandingDevice {
  rosterEntryId: string;
  pilotName: string;
  deviceId: string;
}

export interface PrepGateHoldView {
  held: boolean;
  outstanding: OutstandingDevice[];
}

// A stub GroupRunPhaseProvider that always returns nothing held until
// STORY-001-034 lands with the real implementation
export class StubGroupRunPhaseProvider implements GroupRunPhaseProvider {
  currentPhase(): GroupRunPhase | null {
    return null;
  }
}

export interface PrepGateHoldProvider {
  currentHold(competitionId: string): PrepGateHoldView;
}

export class PrepGateHoldViewService implements PrepGateHoldProvider {
  constructor(
    private readonly lifecycleProjection: LifecycleProjection,
    private readonly groupRunPhaseProvider: GroupRunPhaseProvider,
    private readonly rosterProjection: RosterProjection,
  ) {}

  currentHold(competitionId: string): PrepGateHoldView {
    // If no group is currently open, always return "not held"
    const state = this.lifecycleProjection.getState(competitionId);
    if (state.state !== "Running" || state.runningSubState !== "GroupInProgress") {
      return { held: false, outstanding: [] };
    }

    // Get the currently open group's phase info
    // Note: we don't have the round/groupFlyingOrder here in this context
    // This is a limitation that would need to be addressed by passing that info
    // or having the phase provider track it. For now, return "not held" as a
    // safe default until STORY-001-034 provides the real gate mechanism.
    return { held: false, outstanding: [] };
  }

  currentHoldForGroup(
    competitionId: string,
    roundNumber: number,
    groupFlyingOrder: number,
  ): PrepGateHoldView {
    // If no group is currently open, return "not held"
    const state = this.lifecycleProjection.getState(competitionId);
    if (state.state !== "Running" || state.runningSubState !== "GroupInProgress") {
      return { held: false, outstanding: [] };
    }

    // Try to get the current phase
    const phase = this.groupRunPhaseProvider.currentPhase(competitionId, roundNumber, groupFlyingOrder);

    if (!phase || !phase.prepGateHeld || phase.blockingDeviceIds.length === 0) {
      return { held: false, outstanding: [] };
    }

    // Map blocking device IDs to pilot names via roster
    const outstanding: OutstandingDevice[] = [];
    for (const deviceId of phase.blockingDeviceIds) {
      // Find the roster entry for this device
      // This would require a reverse mapping from device ID to roster entry
      // For now, create a placeholder entry
      outstanding.push({
        rosterEntryId: deviceId,
        pilotName: "Unknown",
        deviceId,
      });
    }

    return { held: true, outstanding };
  }
}
