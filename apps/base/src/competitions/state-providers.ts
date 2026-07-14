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
