// STORY-001-040: group-run phase projection. A PURE LOADER (Norm 2):
// applies guards on record type/scope before folding; no RNG, no network, no
// side effects; safe to rebuild() from the full log at any time (D4/D7).
//
// Folds groupRun.preparationStarted/workingTimeStarted/landingWindowStarted/
// completed (this story's own types) plus groupRun.aborted (032's, ending the
// run immediately and clearing its state) and groupRun.gatePlaced/gateCleared
// (the gate-owning story's, folded purely into prepGateHeld) into the current
// GroupRunPhase per (competitionId, roundNumber, groupFlyingOrder) key.

import type { EventRecord } from "../eventstore/event-store.js";
import type {
  PreparationStartedPayload,
  WorkingTimeStartedPayload,
  LandingWindowStartedPayload,
  GroupRunCompletedPayload,
  GroupAbortedPayload,
} from "@soarscore/shared";

export interface GroupRunPhase {
  competitionId: string;
  roundNumber: number;
  groupFlyingOrder: number;
  phase: "Preparation" | "WorkingTime" | "Landing";
  remainingSeconds: number;
  prepGateHeld: boolean;
  blockingDeviceIds: string[];
  phaseStartedAt: string;
}

interface GroupRunState {
  phase: "Preparation" | "WorkingTime" | "Landing";
  phaseStartedAt: string;
  durationSeconds: number;
  prepGateHeld: boolean;
  blockingDeviceIds: string[];
}

type GroupRunKey = `${string}:${number}:${number}`; // competitionId:roundNumber:groupFlyingOrder

function makeKey(competitionId: string, roundNumber: number, groupFlyingOrder: number): GroupRunKey {
  return `${competitionId}:${roundNumber}:${groupFlyingOrder}`;
}

export class GroupRunProjection {
  // Internal map of (competitionId, roundNumber, groupFlyingOrder) → current state
  private runs = new Map<GroupRunKey, GroupRunState>();

  apply(record: EventRecord): void {
    // Only process events filed under content-level scope (competitionId).
    // System-emitted phase events and gate events file under competitionId,
    // not the fixed "competitions" scope.
    if (!record.scope || record.scope === "competitions") {
      return;
    }

    const competitionId = record.scope;

    // Handle phase-transition events (STORY-001-040).
    if (record.type === "groupRun.preparationStarted") {
      const payload = record.payload as PreparationStartedPayload;
      const key = makeKey(competitionId, payload.roundNumber, payload.groupFlyingOrder);
      this.runs.set(key, {
        phase: "Preparation",
        phaseStartedAt: record.timestamp,
        durationSeconds: payload.durationSeconds,
        prepGateHeld: false,
        blockingDeviceIds: [],
      });
      return;
    }

    if (record.type === "groupRun.workingTimeStarted") {
      const payload = record.payload as WorkingTimeStartedPayload;
      const key = makeKey(competitionId, payload.roundNumber, payload.groupFlyingOrder);
      const current = this.runs.get(key);
      if (current) {
        this.runs.set(key, {
          ...current,
          phase: "WorkingTime",
          phaseStartedAt: record.timestamp,
          durationSeconds: payload.durationSeconds,
        });
      }
      return;
    }

    if (record.type === "groupRun.landingWindowStarted") {
      const payload = record.payload as LandingWindowStartedPayload;
      const key = makeKey(competitionId, payload.roundNumber, payload.groupFlyingOrder);
      const current = this.runs.get(key);
      if (current) {
        this.runs.set(key, {
          ...current,
          phase: "Landing",
          phaseStartedAt: record.timestamp,
          durationSeconds: payload.durationSeconds,
        });
      }
      return;
    }

    if (record.type === "groupRun.completed") {
      const payload = record.payload as GroupRunCompletedPayload;
      const key = makeKey(competitionId, payload.roundNumber, payload.groupFlyingOrder);
      // Remove the completed run from the map; a new group's fresh key entry
      // will have zero leftover state (AC6 "clean reset").
      this.runs.delete(key);
      return;
    }

    // Handle abort event (STORY-001-032): end the run immediately.
    if (record.type === "groupRun.aborted") {
      const payload = record.payload as GroupAbortedPayload;
      const key = makeKey(competitionId, payload.roundNumber, payload.groupFlyingOrder);
      this.runs.delete(key);
      return;
    }

    // Handle gate placement/clearing (owned by gate story, folded as pass-through).
    if (record.type === "groupRun.gatePlaced") {
      const payload = record.payload as any;
      const key = makeKey(competitionId, payload.roundNumber, payload.groupFlyingOrder);
      const current = this.runs.get(key);
      if (current) {
        this.runs.set(key, {
          ...current,
          prepGateHeld: true,
          blockingDeviceIds: [...(payload.blockingDeviceIds || [])],
        });
      }
      return;
    }

    if (record.type === "groupRun.gateCleared") {
      const payload = record.payload as any;
      const key = makeKey(competitionId, payload.roundNumber, payload.groupFlyingOrder);
      const current = this.runs.get(key);
      if (current) {
        this.runs.set(key, {
          ...current,
          prepGateHeld: false,
          blockingDeviceIds: [],
        });
      }
      return;
    }

    // Gate release events (STORY-001-032): update blockingDeviceIds.
    if (
      record.type === "groupRun.gateReleasedDeviceOffline" ||
      record.type === "groupRun.gateReleasedPilotUnconfirmed"
    ) {
      const payload = record.payload as any;
      const key = makeKey(competitionId, payload.roundNumber, payload.groupFlyingOrder);
      const current = this.runs.get(key);
      if (current) {
        const updated = current.blockingDeviceIds.filter((id) => id !== payload.deviceId);
        this.runs.set(key, {
          ...current,
          blockingDeviceIds: updated,
          prepGateHeld: updated.length > 0,
        });
      }
      return;
    }
  }

  // Get current phase for a specific group. This is a **partial function**
  // valid only for an active run (per Approach §8, presence/absence is
  // RunningSubState territory). It always returns one of the three fixed
  // phase values; never a fabricated "idle" state.
  currentPhase(
    competitionId: string,
    roundNumber: number,
    groupFlyingOrder: number,
  ): GroupRunPhase | null {
    const key = makeKey(competitionId, roundNumber, groupFlyingOrder);
    const state = this.runs.get(key);

    if (!state) {
      return null;
    }

    // Compute remainingSeconds on read: max(0, durationSeconds - (now - phaseStartedAt)).
    // Never stored as a mutable field — matches D7 discipline (derived, rebuildable
    // projections) and survives a Base Station restart (D6 offline-first).
    const now = new Date().getTime();
    const startedAtMs = new Date(state.phaseStartedAt).getTime();
    const elapsedMs = now - startedAtMs;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const remaining = Math.max(0, state.durationSeconds - elapsedSeconds);

    return {
      competitionId,
      roundNumber,
      groupFlyingOrder,
      phase: state.phase,
      remainingSeconds: remaining,
      prepGateHeld: state.prepGateHeld,
      blockingDeviceIds: [...state.blockingDeviceIds],
      phaseStartedAt: state.phaseStartedAt,
    };
  }

  // Rebuild from a stream of events (idempotent, safe at any time).
  rebuild(events: EventRecord[]): void {
    this.runs.clear();
    for (const record of events) {
      this.apply(record);
    }
  }
}
