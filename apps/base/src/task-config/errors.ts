// Reuse the generic base + validation error so the centralised setErrorHandler
// (400 VALIDATION_FAILED) covers task-config the same way. Each domain code
// below gets its own setErrorHandler branch.
import { DomainError } from "../pilots/errors.js";

export { DomainError, ValidationError } from "../pilots/errors.js";

// A competition has no task-config overlay yet, or the competition itself is
// absent — GET before any save returns model defaults, so this is reserved for
// a genuinely unknown competition.
export class CompetitionTaskConfigNotFoundError extends DomainError {
  readonly code = "TASK_CONFIG_NOT_FOUND";
  constructor(message: string) {
    super(message);
  }
}

// An overlay entry references a taskId absent from the competition's class model.
export class TaskNotFoundError extends DomainError {
  readonly code = "TASK_CONFIG_TASK_NOT_FOUND";
  constructor(message: string) {
    super(message);
  }
}

// AC1: per-round overrides were supplied for a task whose rule fixes its working
// time (perRoundOverrideAllowed = false — every MVP class except F3K).
export class PerRoundOverrideNotAllowedError extends DomainError {
  readonly code = "TASK_CONFIG_OVERRIDE_NOT_ALLOWED";
  constructor(message: string) {
    super(message);
  }
}

// AC4/AC6 boundary: a per-event value was supplied for a slot the class model
// does not open — e.g. an NLH value where no task is NLH-applicable.
export class NlhNotApplicableError extends DomainError {
  readonly code = "TASK_CONFIG_NLH_NOT_APPLICABLE";
  constructor(message: string) {
    super(message);
  }
}
