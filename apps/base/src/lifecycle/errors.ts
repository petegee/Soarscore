// The lifecycle module's one domain error. Reuses the generic DomainError base
// so the centralised setErrorHandler surfaces it uniformly (a domain-coded 4xx)
// with no new error-handling framework. Thrown by LifecycleGuard.assertAdmissible
// when an action is illegal from the current state — carrying the current state
// and the attempted action, and never mutating state or appending an event (AC7).
import { DomainError } from "../pilots/errors.js";

export { DomainError } from "../pilots/errors.js";

export class TransitionNotAllowedError extends DomainError {
  readonly code = "TRANSITION_NOT_ALLOWED";
  constructor(
    message: string,
    readonly currentState: string,
    readonly attemptedAction: string,
  ) {
    super(message);
  }
}
