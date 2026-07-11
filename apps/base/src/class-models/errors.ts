import type { CompetitionRef } from "@soarscore/shared";
// Reuse the generic base + validation error so the centralised setErrorHandler
// (400 VALIDATION_FAILED, 500 DomainError fall-through) covers class models
// without a new branch. Each aggregate still owns its own domain codes below.
import { DomainError } from "../pilots/errors.js";

export { DomainError, ValidationError } from "../pilots/errors.js";

export class ClassModelNotFoundError extends DomainError {
  readonly code = "CLASS_MODEL_NOT_FOUND";
  constructor(message: string) {
    super(message);
  }
}

// Stock models are read-only forever (AC7/AC9): the only path to a variation is
// clone-then-edit. Enforced in the service so the API cannot be bypassed.
export class StockModelReadonlyError extends DomainError {
  readonly code = "CLASS_MODEL_STOCK_READONLY";
  constructor(message: string) {
    super(message);
  }
}

// A model referenced by a competition cannot be deleted (AC9); carries the
// referencing competitions so the UI can name them.
export class ReferencedClassModelError extends DomainError {
  readonly code = "CLASS_MODEL_REFERENCED";
  constructor(
    message: string,
    readonly competitions: CompetitionRef[],
  ) {
    super(message);
  }
}
