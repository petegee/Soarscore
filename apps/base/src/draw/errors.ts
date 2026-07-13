// Reuse the generic base + validation error so the centralised setErrorHandler
// (400 VALIDATION_FAILED) covers the draw the same way (the task-config idiom).
// Each domain code below gets exactly one setErrorHandler branch in app.ts;
// a missing branch surfaces as a 500 and is a release blocker (Safeguard 8).
import { DomainError } from "../pilots/errors.js";

export { DomainError, ValidationError } from "../pilots/errors.js";

// The competition has no saved draw spec yet, or the competition itself is
// absent. GET evidence before any save returns an empty view, so this is
// reserved for generate-before-save and genuinely unknown competitions.
export class DrawSpecNotFoundError extends DomainError {
  readonly code = "DRAW_SPEC_NOT_FOUND";
  constructor(message: string) {
    super(message);
  }
}

// Post-STORY-001-022 (D14) this is a narrower gate than its name might
// suggest: the rule-fixed per-group minimum no longer hard-rejects here at
// all — a genuine shortfall against it now warns-and-generates instead (see
// DrawService#resolveGroupPlan). This error fires only for the two cases D14
// left as hard rejections: the D1 two-scoring-pilot floor (at most floor(R/2)
// groups), and an ungated single group — groupsPerRound = 1 requested (or
// reached) without the CD's spare-scorer consent (allowSingleGroup) or the
// class's "or all competitors" escape. The message states the feasible
// groups-per-round range so the Organiser can fix it. Validated at both save
// and generate time against the live roster (Safeguard 6).
export class GroupSizeOutOfBoundsError extends DomainError {
  readonly code = "DRAW_GROUP_SIZE_OUT_OF_BOUNDS";
  constructor(message: string) {
    super(message);
  }
}

// AC6: no attempt yielded a valid draw for this roster/spec (e.g. the
// consecutive-flight constraint is unsatisfiable). Carries a human reason;
// nothing is appended before it is thrown (Safeguard 3).
export class DrawGenerationFailedError extends DomainError {
  readonly code = "DRAW_GENERATION_FAILED";
  constructor(message: string) {
    super(message);
  }
}

// STORY-001-017 AC5 (and its cancel symmetric): there is no awaiting-decision
// candidate to accept or cancel. Nothing is appended before this is thrown.
// 409 — the request conflicts with the contest's current draw state.
export class DrawCandidateNotFoundError extends DomainError {
  readonly code = "DRAW_CANDIDATE_NOT_FOUND";
  constructor(message: string) {
    super(message);
  }
}

// STORY-001-017 AC6: the supplied drawId no longer matches the current
// candidate — a re-generate superseded it. Rejecting keeps the "decision binds
// to a specific candidate" invariant: no stale accept/cancel can attach to the
// wrong draw. The client should re-read the evidence and decide again. 409.
export class DrawCandidateSupersededError extends DomainError {
  readonly code = "DRAW_CANDIDATE_SUPERSEDED";
  constructor(message: string) {
    super(message);
  }
}

// STORY-001-022 AC3: the candidate carries one or more group-size-minimum
// warnings (D14) whose ids are absent from the accept request's
// acknowledgedWarningIds. The message names the missing warning(s) by their
// own message text, not a generic "unacknowledged" string. 409 — the request
// conflicts with the contest's current draw state until acknowledged.
export class DrawGroupSizeWarningUnacknowledgedError extends DomainError {
  readonly code = "DRAW_GROUP_SIZE_WARNING_UNACKNOWLEDGED";
  constructor(message: string) {
    super(message);
  }
}

// STORY-001-011: group move/split/re-flight-prepare all operate only on an
// *accepted* draw — attempting one against a not-yet-accepted candidate (or
// no draw at all) reads as "no accepted draw exists yet" (mirrors
// STORY-001-010's precedent). 409 — the request conflicts with the contest's
// current draw state.
export class DrawNotAcceptedError extends DomainError {
  readonly code = "DRAW_NOT_ACCEPTED";
  constructor(message: string) {
    super(message);
  }
}

// AC1: the round/task/rosterEntryId/target group named by a move or split
// request doesn't resolve against the effective composition. 404.
export class GroupMoveTargetNotFoundError extends DomainError {
  readonly code = "GROUP_MOVE_TARGET_NOT_FOUND";
  constructor(message: string) {
    super(message);
  }
}

// AC1/AC2: the move/split would violate the group-size minimum or the
// no-back-to-back constraint. The message names the violated constraint
// ("group-size-minimum" / "consecutive-flight"); nothing is appended before
// this is thrown. 409.
export class GroupMoveClashError extends DomainError {
  readonly code = "GROUP_MOVE_CLASH";
  constructor(message: string) {
    super(message);
  }
}

// A split would leave either resulting group below the class minimum without
// a permitted escape, or movedRosterEntryIds is not a strict subset of the
// source group's current membership. 409.
export class GroupSplitInvalidError extends DomainError {
  readonly code = "GROUP_SPLIT_INVALID";
  constructor(message: string) {
    super(message);
  }
}

// AC3: the named entitled pilot is not seated in the referenced round/task.
// 404.
export class ReflightEntitlementNotFoundError extends DomainError {
  readonly code = "REFLIGHT_ENTITLEMENT_NOT_FOUND";
  constructor(message: string) {
    super(message);
  }
}
