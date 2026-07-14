// Reuse the generic base + validation error so the centralised setErrorHandler
// (400 VALIDATION_FAILED) covers competitions the same way. Each aggregate still
// owns its own domain codes below, each with its own setErrorHandler branch.
import type { OutstandingItem } from "@soarscore/shared";
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

// STORY-001-025 (AC2/AC3): thrown by CompetitionService.start when the
// competition is in Setup below the DrawAccepted rung. Carries the list of
// unmet prerequisites, each a stable code + operator-facing message, so the
// blocked start changes nothing and reports exactly what remains. Mapped to
// 409 COMPETITION_NOT_READY with details.outstandingItems in setErrorHandler.
export class CompetitionNotReadyError extends DomainError {
  readonly code = "COMPETITION_NOT_READY";
  constructor(
    message: string,
    readonly outstandingItems: OutstandingItem[],
  ) {
    super(message);
  }
}

// Hard block (RD2): thrown by update when the referenced class model differs
// from the stored one and captured scores exist. There is no acknowledgment
// flag — a locked competition reuses CompetitionLockedError, checked first.
export class CompetitionClassLockedError extends DomainError {
  readonly code = "COMPETITION_CLASS_LOCKED";
  constructor(
    message: string,
    readonly reason: "captured-scores" = "captured-scores",
  ) {
    super(message);
  }
}
