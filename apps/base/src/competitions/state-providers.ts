// Deferred-state seams: this story does not own lock or scoring state, so both
// are queried through an injected interface with a no-op stub. The lock and
// scoring stories swap in real implementations via AppOptions with zero rework.

export interface LockStateProvider {
  isLocked(competitionId: string): boolean;
}

// STORY (CD lock): a real provider will answer from CD lock/unlock events.
export class AlwaysUnlockedProvider implements LockStateProvider {
  isLocked(_competitionId: string): boolean {
    return false;
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
