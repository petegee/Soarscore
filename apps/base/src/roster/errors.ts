// Reuse the generic base + validation error so the centralised setErrorHandler
// (400 VALIDATION_FAILED) covers the roster the same way. Each domain code
// below gets its own setErrorHandler branch.
import { DomainError } from "../pilots/errors.js";

export { DomainError, ValidationError } from "../pilots/errors.js";

export class RosterEntryNotFoundError extends DomainError {
  readonly code = "ROSTER_ENTRY_NOT_FOUND";
  constructor(message: string) {
    super(message);
  }
}

export class DuplicateRosterEntryError extends DomainError {
  readonly code = "DUPLICATE_ROSTER_ENTRY";
  constructor(message: string) {
    super(message);
  }
}

// AC5: retired state is owned by the Contest Director (Area 5.5); ordinary
// roster editing can never touch a retired entry, and there is no reactivate
// path in this slice.
export class RosterEntryRetiredError extends DomainError {
  readonly code = "ROSTER_ENTRY_RETIRED";
  constructor(message: string) {
    super(message);
  }
}

// AC3/AC4 boundary: with an accepted draw, remove is no longer free — the
// Organiser must replace so the seat's draw slots are inherited (RD4).
export class RosterRemoveRequiresReplacementError extends DomainError {
  readonly code = "ROSTER_REMOVE_REQUIRES_REPLACEMENT";
  constructor(
    message: string,
    readonly reason: "accepted-draw" = "accepted-draw",
  ) {
    super(message);
  }
}

// AC4: the server-enforced acknowledgment — replace under an accepted draw
// refuses until confirmDrawAffected is true, so a mis-built client cannot
// skip the warning.
export class RosterReplaceNeedsConfirmationError extends DomainError {
  readonly code = "ROSTER_REPLACE_AFFECTS_DRAW";
  constructor(
    message: string,
    readonly reason: "draw-and-lanes-affected" = "draw-and-lanes-affected",
  ) {
    super(message);
  }
}

// Hard block — no acknowledgment flag clears it: a seat with captured scores
// is CD retirement territory (Area 5.5, which re-draws); points must never
// transfer to a new occupant.
export class RosterEntryHasFlownError extends DomainError {
  readonly code = "ROSTER_ENTRY_HAS_FLOWN";
  constructor(
    message: string,
    readonly reason: "captured-scores" = "captured-scores",
  ) {
    super(message);
  }
}
