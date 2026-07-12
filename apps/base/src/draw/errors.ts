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

// AC1: groups-per-round would force a group below the per-group minimum (from
// the task model or the spec override), or above the D1 ceiling (R/2). The
// message states the feasible groups-per-round range so the Organiser can fix
// it. Validated at both save and generate time against the live roster
// (Safeguard 6).
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
