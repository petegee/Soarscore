// STORY-001-032: run-control authority domain errors. Reuse the generic base +
// validation error so the centralised setErrorHandler covers run-control the
// same way (the draw/task-config idiom). Each domain code below gets exactly
// one setErrorHandler branch in app.ts; a missing branch surfaces as a 500 and
// is a release blocker (Safeguard 8).
import { DomainError } from "../pilots/errors.js";

export { DomainError, ValidationError } from "../pilots/errors.js";

// The group is not in Preparation phase. Pause/resume/fast-forward/add-time
// are legal only when the phase provider reports phase === "Preparation" (AC1).
// Returned by pause, resume, fast-forward, add-time.
export class GroupNotInPreparationError extends DomainError {
  readonly code = "GROUP_NOT_IN_PREPARATION";
  constructor(message: string) {
    super(message);
  }
}

// The preparation phase has 60 seconds or less remaining. Fast-forward never
// drops remaining prep time below 60 seconds (AC2).
export class PrepAtFloorError extends DomainError {
  readonly code = "PREP_AT_FLOOR";
  constructor(message: string) {
    super(message);
  }
}

// The named device is not currently in the group's blockingDeviceIds set —
// it is not a candidate for gate release. Returned by both gate-release paths
// (AC4/AC5).
export class PrepGateNotHeldError extends DomainError {
  readonly code = "PREP_GATE_NOT_HELD";
  constructor(message: string) {
    super(message);
  }
}

// The group is not in WorkingTime phase. Abort is legal only during
// "WorkingTime" — never during "Preparation" (nothing to abort) or "Landing"
// (abort no longer applies once landing/touchdown has begun, per AC6 confirmed
// 202607160945).
export class GroupNotInWorkingTimeError extends DomainError {
  readonly code = "GROUP_NOT_IN_WORKING_TIME";
  constructor(message: string) {
    super(message);
  }
}

// Round advance is not currently blocked by outstanding items. "Advance anyway"
// is never a no-op success; it must throw when there is nothing blocking (AC7).
export class RoundAdvanceNotBlockedError extends DomainError {
  readonly code = "ROUND_ADVANCE_NOT_BLOCKED";
  constructor(message: string) {
    super(message);
  }
}

// The group identified by competitionId/roundNumber/groupFlyingOrder does not
// resolve via the phase provider. 404.
export class GroupNotFoundError extends DomainError {
  readonly code = "GROUP_NOT_FOUND";
  constructor(message: string) {
    super(message);
  }
}

// STORY-001-040: group-run phase-transition engine errors.

// Field-aid settings (prep/landing duration configuration) are not yet
// configured. Area 3.8 scope; this is a temporary stub until that story lands.
export class FieldAidSettingsNotConfiguredError extends DomainError {
  readonly code = "FIELD_AID_SETTINGS_NOT_CONFIGURED";
  constructor(message: string) {
    super(message);
  }
}

// A duration-shaped task's working-time source is missing or zero at
// transition time. This should not occur in normal operation if task-config
// is properly populated, but is raised to surface misconfiguration.
export class NoDurationShapedTaskConfiguredError extends DomainError {
  readonly code = "NO_DURATION_SHAPED_TASK_CONFIGURED";
  constructor(message: string) {
    super(message);
  }
}

// The read route was called for a (competitionId, roundNumber, groupFlyingOrder)
// triple with no currently-open run. Presence/absence of a run is
// RunningSubState territory (STORY-001-044), not this story's read model to
// represent as a phase value. 404.
export class GroupRunNotFoundError extends DomainError {
  readonly code = "GROUP_RUN_NOT_FOUND";
  constructor(message: string) {
    super(message);
  }
}

// STORY-001-044: group start control and manual run tasks (AC1–5, D3, D8, D10).

// AC3 / Approach §6: every task-group in the current round has already been
// opened (or the draw is incomplete for the next round). Advancing to the next
// round is exclusively STORY-001-043's round-advance action, never inferred here.
// 409 — the request conflicts with the contest's current running state.
export class NoGroupReadyToStartError extends DomainError {
  readonly code = "NO_GROUP_READY_TO_START";
  constructor(message: string) {
    super(message);
  }
}
