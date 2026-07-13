// Reuse the generic base + validation error so the centralised setErrorHandler
// (400 VALIDATION_FAILED) covers scoring the same way (the draw/task-config
// idiom). Each domain code below gets exactly one setErrorHandler branch in
// app.ts; a missing branch surfaces as a 500 and is a release blocker.
import { DomainError } from "../pilots/errors.js";

export { DomainError, ValidationError } from "../pilots/errors.js";

// The round/task/rosterEntryId a capture or recompute targets doesn't resolve
// in the effective draw (no such seat this round/task). 404.
export class CaptureTargetNotFoundError extends DomainError {
  readonly code = "CAPTURE_TARGET_NOT_FOUND";
  constructor(message: string) {
    super(message);
  }
}

// A group's lone-pilot situation has already been resolved
// (scoring.lonePilotResolved / scoring.annulmentOverrideRequested already
// exists for it) — protects the "resolved once, replayed forever" invariant
// (Safeguard 3). 409.
export class LonePilotAlreadyResolvedError extends DomainError {
  readonly code = "LONE_PILOT_ALREADY_RESOLVED";
  constructor(message: string) {
    super(message);
  }
}

// A recompute is requested for a group whose annulment override is still
// pending Contest-Director approval — there is no dummy to compute against
// yet. 409.
export class AnnulmentOverridePendingError extends DomainError {
  readonly code = "ANNULMENT_OVERRIDE_PENDING";
  constructor(message: string) {
    super(message);
  }
}
