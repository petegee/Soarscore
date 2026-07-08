import type { CompetitionRef } from "@soarscore/shared";

export abstract class DomainError extends Error {
  abstract readonly code: string;
}

export class ValidationError extends DomainError {
  readonly code = "VALIDATION_FAILED";
  constructor(
    message: string,
    readonly details: unknown,
  ) {
    super(message);
  }
}

export class NotFoundError extends DomainError {
  readonly code = "PILOT_NOT_FOUND";
  constructor(message: string) {
    super(message);
  }
}

export class ReferencedPilotError extends DomainError {
  readonly code = "PILOT_REFERENCED";
  constructor(
    message: string,
    readonly competitions: CompetitionRef[],
  ) {
    super(message);
  }
}
