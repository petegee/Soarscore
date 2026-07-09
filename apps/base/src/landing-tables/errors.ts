import type { CompetitionRef } from "@soarscore/shared";
// Reuse the generic base + validation error so the centralised setErrorHandler
// (400 VALIDATION_FAILED, 500 DomainError fall-through) covers landing tables
// without a new branch. Each aggregate still owns its own domain codes below.
import { DomainError } from "../pilots/errors.js";

export { DomainError, ValidationError } from "../pilots/errors.js";

export class LandingTableNotFoundError extends DomainError {
  readonly code = "LANDING_TABLE_NOT_FOUND";
  constructor(message: string) {
    super(message);
  }
}

export class ReferencedLandingTableError extends DomainError {
  readonly code = "LANDING_TABLE_REFERENCED";
  constructor(
    message: string,
    readonly competitions: CompetitionRef[],
  ) {
    super(message);
  }
}
