// Reuse the generic base + validation error so the centralised setErrorHandler
// (400 VALIDATION_FAILED) covers competitions the same way. Each aggregate still
// owns its own domain codes below, each with its own setErrorHandler branch.
import { DomainError } from "../pilots/errors.js";

export { DomainError, ValidationError } from "../pilots/errors.js";

export class CompetitionNotFoundError extends DomainError {
  readonly code = "COMPETITION_NOT_FOUND";
  constructor(message: string) {
    super(message);
  }
}

export class CompetitionLockedError extends DomainError {
  readonly code = "COMPETITION_LOCKED";
  constructor(message: string) {
    super(message);
  }
}

export class CompetitionDeleteNeedsConfirmationError extends DomainError {
  readonly code = "COMPETITION_DELETE_NEEDS_CONFIRMATION";
  constructor(
    message: string,
    readonly reason: "captured-scores" = "captured-scores",
  ) {
    super(message);
  }
}
