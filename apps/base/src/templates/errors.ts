// Reuse the generic base + validation error so the centralised setErrorHandler
// (400 VALIDATION_FAILED, 500 DomainError fall-through) covers templates
// without a new branch. No referenced-error class: copy-on-seed means nothing
// ever references a template (RD4), so deletion is always free.
import { DomainError } from "../pilots/errors.js";

export { DomainError, ValidationError } from "../pilots/errors.js";

export class TemplateNotFoundError extends DomainError {
  readonly code = "TEMPLATE_NOT_FOUND";
  constructor(message: string) {
    super(message);
  }
}
