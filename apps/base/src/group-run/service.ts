// STORY-001-032: run-control authority service. One method per action
// (pause/resume/fast-forward/add-time/abort/gate-release×2/override), each
// reading phase state via the provider seam, applying the guard/business rule,
// constructing and appending the event.

import type {
  Attribution,
  GroupAbortedPayload,
  AnnulledFactRef,
  OutstandingItemResolution,
  RoundAdvanceOverriddenPayload,
  PrepGateReleasedDeviceOfflinePayload,
  PrepGateReleasedPilotUnconfirmedPayload,
  PrepPausedPayload,
  PrepResumedPayload,
  PrepFastForwardedPayload,
  PrepTimeAddedPayload,
} from "@soarscore/shared";
import type { EventStore } from "../eventstore/event-store.js";
import type { ScoringProjection } from "../scoring/projection.js";
import {
  GroupNotInPreparationError,
  PrepAtFloorError,
  PrepGateNotHeldError,
  GroupNotInWorkingTimeError,
  RoundAdvanceNotBlockedError,
  GroupNotFoundError,
} from "./errors.js";

// The phase state provider seam (STORY-001-040 implements this for real; this
// story ships a test double). Allows run-control to read current phase/
// remaining-time/gate state without depending on timer implementation details.
export interface GroupRunPhase {
  competitionId: string;
  roundNumber: number;
  groupFlyingOrder: number;
  phase: "Preparation" | "WorkingTime" | "Landing";
  remainingSeconds: number;
  prepGateHeld: boolean;
  blockingDeviceIds: string[];
}

export interface GroupRunPhaseProvider {
  getPhase(
    competitionId: string,
    roundNumber: number,
    groupFlyingOrder: number,
  ): Promise<GroupRunPhase | null>;
}

// The no-score creation seam (STORY-001-031 implements this for real; this
// story ships a test double). Allows release-gate-pilot-unconfirmed to create
// a no-score entitlement after releasing the device.
export interface NoScoreIntake {
  createNoScore(
    competitionId: string,
    roundNumber: number,
    rosterEntryId: string,
    reason: string,
  ): Promise<void>;
}

// The outstanding items provider seam (STORY-001-043 implements this for real;
// this story ships a test double). Allows override-round-advance to read
// blocking items and map them to consequences.
export interface OutstandingItem {
  code: string;
  message: string;
  type: "missing-score" | "unresolved-no-score" | "reflight-not-flown";
  referenceId: string;
  reflightApprovalStatus?: "pending-contest-director-approval" | "approved";
}

export interface OutstandingItemsProvider {
  getOutstandingItems(competitionId: string, roundNumber: number): Promise<OutstandingItem[]>;
}

export interface RunControlActionResponse {
  status: string;
  phase: GroupRunPhase;
}

export class GroupRunControlService {
  constructor(
    private readonly eventStore: EventStore,
    private readonly phaseProvider: GroupRunPhaseProvider,
    private readonly noScoreIntake: NoScoreIntake,
    private readonly outstandingItemsProvider: OutstandingItemsProvider,
    private readonly scoringProjection: ScoringProjection,
  ) {}

  async pausePrep(
    competitionId: string,
    roundNumber: number,
    groupFlyingOrder: number,
    attribution: Attribution,
  ): Promise<RunControlActionResponse> {
    const phase = await this.phaseProvider.getPhase(competitionId, roundNumber, groupFlyingOrder);
    if (!phase) {
      throw new GroupNotFoundError(
        `Group not found: competition=${competitionId}, round=${roundNumber}, group=${groupFlyingOrder}`,
      );
    }

    if (phase.phase !== "Preparation") {
      throw new GroupNotInPreparationError("The group is not in preparation phase");
    }

    const payload: PrepPausedPayload = {
      competitionId,
      roundNumber,
      groupFlyingOrder,
    };

    this.eventStore.append({
      scope: competitionId,
      type: "groupRun.prepPaused",
      payload,
      attribution,
    });

    return { status: "paused", phase };
  }

  async resumePrep(
    competitionId: string,
    roundNumber: number,
    groupFlyingOrder: number,
    attribution: Attribution,
  ): Promise<RunControlActionResponse> {
    const phase = await this.phaseProvider.getPhase(competitionId, roundNumber, groupFlyingOrder);
    if (!phase) {
      throw new GroupNotFoundError(
        `Group not found: competition=${competitionId}, round=${roundNumber}, group=${groupFlyingOrder}`,
      );
    }

    if (phase.phase !== "Preparation") {
      throw new GroupNotInPreparationError("The group is not in preparation phase");
    }

    const payload: PrepResumedPayload = {
      competitionId,
      roundNumber,
      groupFlyingOrder,
    };

    this.eventStore.append({
      scope: competitionId,
      type: "groupRun.prepResumed",
      payload,
      attribution,
    });

    return { status: "resumed", phase };
  }

  async fastForwardPrep(
    competitionId: string,
    roundNumber: number,
    groupFlyingOrder: number,
    attribution: Attribution,
  ): Promise<RunControlActionResponse> {
    const phase = await this.phaseProvider.getPhase(competitionId, roundNumber, groupFlyingOrder);
    if (!phase) {
      throw new GroupNotFoundError(
        `Group not found: competition=${competitionId}, round=${roundNumber}, group=${groupFlyingOrder}`,
      );
    }

    if (phase.phase !== "Preparation") {
      throw new GroupNotInPreparationError("The group is not in preparation phase");
    }

    if (phase.remainingSeconds <= 60) {
      throw new PrepAtFloorError(
        "Preparation time is at or below the floor of 60 seconds and cannot be fast-forwarded further",
      );
    }

    const payload: PrepFastForwardedPayload = {
      competitionId,
      roundNumber,
      groupFlyingOrder,
      secondsRemoved: 60,
    };

    this.eventStore.append({
      scope: competitionId,
      type: "groupRun.prepFastForwarded",
      payload,
      attribution,
    });

    return { status: "fast-forwarded", phase };
  }

  async addPrepTime(
    competitionId: string,
    roundNumber: number,
    groupFlyingOrder: number,
    attribution: Attribution,
  ): Promise<RunControlActionResponse> {
    const phase = await this.phaseProvider.getPhase(competitionId, roundNumber, groupFlyingOrder);
    if (!phase) {
      throw new GroupNotFoundError(
        `Group not found: competition=${competitionId}, round=${roundNumber}, group=${groupFlyingOrder}`,
      );
    }

    if (phase.phase !== "Preparation") {
      throw new GroupNotInPreparationError("The group is not in preparation phase");
    }

    // No upper bound enforced — CD discretion governs (confirmed 202607160945).
    const payload: PrepTimeAddedPayload = {
      competitionId,
      roundNumber,
      groupFlyingOrder,
      secondsAdded: 60,
    };

    this.eventStore.append({
      scope: competitionId,
      type: "groupRun.prepTimeAdded",
      payload,
      attribution,
    });

    return { status: "time-added", phase };
  }

  async abort(
    competitionId: string,
    roundNumber: number,
    groupFlyingOrder: number,
    reason: string,
    attribution: Attribution,
  ): Promise<RunControlActionResponse> {
    const phase = await this.phaseProvider.getPhase(competitionId, roundNumber, groupFlyingOrder);
    if (!phase) {
      throw new GroupNotFoundError(
        `Group not found: competition=${competitionId}, round=${roundNumber}, group=${groupFlyingOrder}`,
      );
    }

    // Abort is legal only during "WorkingTime" — never during Preparation or Landing
    // (confirmed 202607160945).
    if (phase.phase !== "WorkingTime") {
      throw new GroupNotInWorkingTimeError(
        "The group must be in working time to abort. Abort is not available during preparation or landing.",
      );
    }

    // Compute the full annulment list: raw captures + derived scoring facts.
    const annulledFacts = this.computeAnnulledFacts(competitionId, roundNumber, groupFlyingOrder);

    const payload: GroupAbortedPayload = {
      competitionId,
      roundNumber,
      groupFlyingOrder,
      annulledFacts,
      reason,
    };

    this.eventStore.append({
      scope: competitionId,
      type: "groupRun.aborted",
      payload,
      attribution,
    });

    return { status: "aborted", phase };
  }

  async releaseGateDeviceOffline(
    competitionId: string,
    roundNumber: number,
    groupFlyingOrder: number,
    rosterEntryId: string,
    deviceId: string,
    attribution: Attribution,
  ): Promise<RunControlActionResponse> {
    const phase = await this.phaseProvider.getPhase(competitionId, roundNumber, groupFlyingOrder);
    if (!phase) {
      throw new GroupNotFoundError(
        `Group not found: competition=${competitionId}, round=${roundNumber}, group=${groupFlyingOrder}`,
      );
    }

    if (!phase.blockingDeviceIds.includes(deviceId)) {
      throw new PrepGateNotHeldError(
        `The device is not currently blocking the prep gate for this group`,
      );
    }

    const payload: PrepGateReleasedDeviceOfflinePayload = {
      competitionId,
      roundNumber,
      groupFlyingOrder,
      rosterEntryId,
      deviceId,
    };

    this.eventStore.append({
      scope: competitionId,
      type: "groupRun.gateReleasedDeviceOffline",
      payload,
      attribution,
    });

    return { status: "gate-released-device-offline", phase };
  }

  async releaseGatePilotUnconfirmed(
    competitionId: string,
    roundNumber: number,
    groupFlyingOrder: number,
    rosterEntryId: string,
    deviceId: string,
    attribution: Attribution,
  ): Promise<RunControlActionResponse> {
    const phase = await this.phaseProvider.getPhase(competitionId, roundNumber, groupFlyingOrder);
    if (!phase) {
      throw new GroupNotFoundError(
        `Group not found: competition=${competitionId}, round=${roundNumber}, group=${groupFlyingOrder}`,
      );
    }

    if (!phase.blockingDeviceIds.includes(deviceId)) {
      throw new PrepGateNotHeldError(
        `The device is not currently blocking the prep gate for this group`,
      );
    }

    // Release the gate + create a no-score entitlement.
    const payload: PrepGateReleasedPilotUnconfirmedPayload = {
      competitionId,
      roundNumber,
      groupFlyingOrder,
      rosterEntryId,
      deviceId,
    };

    this.eventStore.append({
      scope: competitionId,
      type: "groupRun.gateReleasedPilotUnconfirmed",
      payload,
      attribution,
    });

    // Create the no-score — STORY-001-031 implements this for real.
    await this.noScoreIntake.createNoScore(
      competitionId,
      roundNumber,
      rosterEntryId,
      "Pilot unconfirmed at prep-gate release",
    );

    return { status: "gate-released-pilot-unconfirmed", phase };
  }

  async overrideRoundAdvance(
    competitionId: string,
    roundNumber: number,
    attribution: Attribution,
  ): Promise<{ status: string; resolutions: OutstandingItemResolution[] }> {
    // Read the outstanding items blocking the round advance.
    const outstanding = await this.outstandingItemsProvider.getOutstandingItems(
      competitionId,
      roundNumber,
    );

    if (outstanding.length === 0) {
      throw new RoundAdvanceNotBlockedError(
        "Round advance is not currently blocked — override is not applicable",
      );
    }

    // Map each outstanding item to its consequence.
    const resolutions: OutstandingItemResolution[] = outstanding.map((item) => {
      let consequence: "flagged-anomaly" | "zeroed" | "reflight-lapsed";
      if (item.type === "missing-score") {
        consequence = "flagged-anomaly";
      } else if (item.type === "unresolved-no-score") {
        consequence = "zeroed";
      } else {
        // reflight-not-flown — lapse it regardless of prior ApprovalStatus
        consequence = "reflight-lapsed";
      }
      return {
        code: item.code,
        consequence,
        referenceId: item.referenceId,
      };
    });

    const payload: RoundAdvanceOverriddenPayload = {
      competitionId,
      roundNumber,
      resolutions,
    };

    this.eventStore.append({
      scope: competitionId,
      type: "roundAdvance.overridden",
      payload,
      attribution,
    });

    return { status: "overridden", resolutions };
  }

  // Compute the full annulment list: raw captures + derived scoring facts.
  private computeAnnulledFacts(
    competitionId: string,
    roundNumber: number,
    groupFlyingOrder: number,
  ): AnnulledFactRef[] {
    // This reads through the scoring projection to find all facts for this group.
    // STORY-001-031/040 will extend this to fold the annulment into the scoring state.
    // For now, return an empty list as a placeholder — the real implementation
    // queries the scoring projection for facts matching this group's identity.
    const facts: AnnulledFactRef[] = [];

    // TODO: Query scoringProjection for scoring.resultCaptured, scoring.lonePilotResolved,
    // and scoring.annulmentOverrideRequested facts scoped to this group's current run.
    // For v1, the projection likely doesn't expose a method to enumerate facts;
    // that seam will be added by the scoring story.

    return facts;
  }
}
