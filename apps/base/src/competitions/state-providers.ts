// Deferred-state seams: this story does not own lock or scoring state, so both
// are queried through an injected interface with a no-op stub. The lock and
// scoring stories swap in real implementations via AppOptions with zero rework.

import type { LifecycleProjection } from "../lifecycle/projection.js";

export interface LockStateProvider {
  isLocked(competitionId: string): boolean;
}

// STORY (CD lock): the no-op stub, retained as the tests' seam.
export class AlwaysUnlockedProvider implements LockStateProvider {
  isLocked(_competitionId: string): boolean {
    return false;
  }
}

// STORY-001-026: the real LockStateProvider, the app default (replaces
// AlwaysUnlockedProvider). It answers the class-agnostic locked predicate from
// the authoritative lifecycle state, activating every existing freeze gate
// already coded against LockStateProvider.isLocked (the update class-change
// reject, the delete reject, and the score-correction / manual-entry / penalty
// gates other stories built) with no rework. The interface is competitions-owned;
// this implementation reads the injected LifecycleProjection, wired in app.ts via
// AppOptions so no service imports the lifecycle module directly (mirrors
// ProjectionStartStateProvider / ProjectionDrawStateProvider).
export class ProjectionLockStateProvider implements LockStateProvider {
  constructor(private readonly projection: LifecycleProjection) {}

  isLocked(competitionId: string): boolean {
    return this.projection.isLocked(competitionId);
  }
}

// STORY-001-026: the completed-round/task counts the Lock finalisation guard
// reads, decoupling Lock from the not-yet-built round/scoring emitters (the LIVE
// DEPENDENCY). The seam contract fixes only the SHAPE — two integer counts — so
// the precise class-agnostic definition of "completed round/task" can be settled
// in the round story (Area 6 / competition.roundAdvanced) without touching Lock.
export interface FinalisationProgressProvider {
  completedRounds(competitionId: string): number;
  completedTasks(competitionId: string): number;
}

// The app default: completedRounds folds from competition.roundAdvanced in the
// lifecycle projection; completedTasks is 0 until a task-completion fact is
// defined. No emitter appends competition.roundAdvanced today, so both read 0 —
// correct-but-empty (a real contest with a class minimum resolves to NoContest
// until the round story ships), additive, and swapped in with zero rework when
// the emitter lands (the seam is the swap point).
export class ProjectionFinalisationProgressProvider implements FinalisationProgressProvider {
  constructor(private readonly projection: LifecycleProjection) {}

  completedRounds(competitionId: string): number {
    return this.projection.completedRoundCount(competitionId);
  }

  completedTasks(_competitionId: string): number {
    return 0;
  }
}

// Test/bootstrap stub: no rounds or tasks completed (mirrors
// AlwaysUnlockedProvider / NotStartedProvider). Tests inject a fixed-count stub
// to drive each finalisation outcome independently of the emitter.
export class ZeroProgressProvider implements FinalisationProgressProvider {
  completedRounds(_competitionId: string): number {
    return 0;
  }

  completedTasks(_competitionId: string): number {
    return 0;
  }
}

export interface CapturedScoresProvider {
  hasCapturedScores(competitionId: string): boolean;
}

// STORY (scoring): a real provider will answer from captured score events.
export class NoScoresYetProvider implements CapturedScoresProvider {
  hasCapturedScores(_competitionId: string): boolean {
    return false;
  }
}

// STORY-001-025: the class-agnostic "past-Start" predicate seam. A module that
// keys off whether proceedings have started (the config-authority boundary)
// consults this injected interface rather than importing the lifecycle module,
// mirroring LockStateProvider / DrawStateProvider. This is the single adoption
// point the remaining 3.5–3.8 config surfaces take up as they are built.
export interface StartStateProvider {
  isStarted(competitionId: string): boolean;
}

// Test stub: proceedings never started, so config edits keep organiser
// attribution. Mirrors AlwaysUnlockedProvider.
export class NotStartedProvider implements StartStateProvider {
  isStarted(_competitionId: string): boolean {
    return false;
  }
}
