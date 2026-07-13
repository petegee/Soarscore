import crypto from "node:crypto";
import { z, type ZodType } from "zod";
import {
  createCompetitionRequestSchema,
  updateCompetitionRequestSchema,
  competitionToCreatedPayload,
  type Attribution,
  type Competition,
  type LifecycleStateResponse,
} from "@soarscore/shared";
import type { EventStore } from "../eventstore/event-store.js";
import type { CompetitionProjection } from "./projection.js";
import type { ClassModelProjection } from "../class-models/projection.js";
import type { CapturedScoresProvider, LockStateProvider } from "./state-providers.js";
import type { LifecycleProjection } from "../lifecycle/projection.js";
import type { LifecycleGuard } from "../lifecycle/guard.js";
import {
  CompetitionDeleteNeedsConfirmationError,
  CompetitionClassLockedError,
  CompetitionLockedError,
  CompetitionNotFoundError,
  ValidationError,
} from "./errors.js";

const SCOPE = "competitions";

export interface DeleteCompetitionRequest {
  confirmDestroysResults: boolean;
}

export class CompetitionService {
  constructor(
    private readonly eventStore: EventStore,
    private readonly projection: CompetitionProjection,
    private readonly classModelProjection: ClassModelProjection,
    private readonly lockState: LockStateProvider,
    private readonly capturedScores: CapturedScoresProvider,
    // STORY-001-024: the authoritative lifecycle layer. Delete legality is now
    // decided against the derived state so it lives in one place; the read side
    // exposes the current state and what may be done now.
    private readonly lifecycleProjection: LifecycleProjection,
    private readonly lifecycleGuard: LifecycleGuard,
  ) {}

  list(): Competition[] {
    return this.projection.getAll();
  }

  get(id: string): Competition {
    const competition = this.projection.getById(id);
    if (!competition) throw new CompetitionNotFoundError(`Competition ${id} not found`);
    return competition;
  }

  // The derived lifecycle state + what may be done now (STORY-001-024). A
  // Deleted competition still answers (200, state "Deleted") off its tombstone
  // — 404 only for an id that never existed (AC1/observability).
  getLifecycleState(id: string): LifecycleStateResponse {
    if (!this.projection.getById(id) && !this.lifecycleProjection.isDeleted(id)) {
      throw new CompetitionNotFoundError(`Competition ${id} not found`);
    }
    const state = this.lifecycleProjection.getState(id);
    return {
      state: state.state,
      subState: state.setupSubState ?? state.runningSubState ?? null,
      admissibleActions: this.lifecycleGuard.admissibleActions(state),
    };
  }

  create(input: unknown, attribution: Attribution): Competition {
    const parsed = parseOrThrow(createCompetitionRequestSchema, input);
    this.assertClassModelExists(parsed.classModelId);
    // Schema has already deduped / discarded pilotClasses per the toggle.
    const competition: Competition = {
      id: crypto.randomUUID(),
      name: parsed.name,
      date: parsed.date,
      venue: parsed.venue ?? null,
      classModelId: parsed.classModelId,
      pilotNumbersEnabled: parsed.pilotNumbersEnabled,
      pilotClassesEnabled: parsed.pilotClassesEnabled,
      pilotClasses: parsed.pilotClasses,
    };

    const record = this.eventStore.append({
      scope: SCOPE,
      type: "competition.created",
      payload: competitionToCreatedPayload(competition),
      attribution,
    });
    this.projection.apply(record);
    return competition;
  }

  update(id: string, input: unknown, attribution: Attribution): Competition {
    const existing = this.projection.getById(id);
    if (!existing) {
      throw new CompetitionNotFoundError(`Competition ${id} not found`);
    }
    const parsed = parseOrThrow(updateCompetitionRequestSchema, input);
    this.assertClassModelExists(parsed.classModelId);
    // Class-change guard (RD2/RD5): fires only when the submitted class model
    // differs from the stored one. Ordered locked → captured-scores so a
    // locked-with-scores competition reports locked. No acknowledgment flag; an
    // unchanged class or a pure identity/toggle edit passes freely. The richer
    // change-with-scores selection UX is STORY-001-004.
    if (parsed.classModelId !== existing.classModelId) {
      if (this.lockState.isLocked(id)) {
        throw new CompetitionLockedError("Cannot change the contest class of a locked competition");
      }
      if (this.capturedScores.hasCapturedScores(id)) {
        throw new CompetitionClassLockedError(
          "Cannot change the contest class once scores are captured",
        );
      }
    }
    // Whole-aggregate identity update over the same id — rename never breaks
    // id-keyed references. Schema has already deduped / discarded pilotClasses.
    const competition: Competition = {
      id,
      name: parsed.name,
      date: parsed.date,
      venue: parsed.venue ?? null,
      classModelId: parsed.classModelId,
      pilotNumbersEnabled: parsed.pilotNumbersEnabled,
      pilotClassesEnabled: parsed.pilotClassesEnabled,
      pilotClasses: parsed.pilotClasses,
    };

    const record = this.eventStore.append({
      scope: SCOPE,
      type: "competition.updated",
      payload: competitionToCreatedPayload(competition),
      attribution,
    });
    this.projection.apply(record);
    return competition;
  }

  // A competition must reference an existing class model (AC8). Checked against
  // the class-model projection at command time (Zod cannot see sibling
  // aggregates); field-named so the companion surfaces it on the class selector.
  private assertClassModelExists(classModelId: string): void {
    if (!this.classModelProjection.getById(classModelId)) {
      throw new ValidationError("Validation failed", {
        formErrors: [],
        fieldErrors: { classModelId: ["Selected contest class no longer exists"] },
      });
    }
  }

  delete(id: string, req: DeleteCompetitionRequest, attribution: Attribution): void {
    // Ordered guard (load-bearing): not-found → locked → captured-scores →
    // tombstone. Locked must precede captured-scores so a locked-with-scores
    // competition can never slip through on the acknowledgment flag.
    if (!this.projection.getById(id)) {
      throw new CompetitionNotFoundError(`Competition ${id} not found`);
    }
    if (this.lockState.isLocked(id)) {
      throw new CompetitionLockedError("Cannot delete a locked competition");
    }
    // Authoritative state-machine guard (STORY-001-024): Delete is admissible
    // only from Setup, so a Running / Suspended / (event-)Locked competition is
    // rejected uniformly with TransitionNotAllowedError and no state change
    // (AC4/AC7). A Setup-state competition passes through to the captured-scores
    // confirmation flow below, unchanged (STORY-001-003).
    this.lifecycleGuard.assertAdmissible(this.lifecycleProjection.getState(id), "Delete");
    if (this.capturedScores.hasCapturedScores(id) && !req.confirmDestroysResults) {
      throw new CompetitionDeleteNeedsConfirmationError(
        "This competition has captured scores; deletion will destroy them",
      );
    }

    // Tombstone, not a purge (D4 immutable log) — the projection drops the
    // competition on apply and on rebuild; the created event is retained.
    const record = this.eventStore.append({
      scope: SCOPE,
      type: "competition.deleted",
      payload: { competitionId: id },
      attribution,
    });
    this.projection.apply(record);
  }
}

function parseOrThrow<S extends ZodType<unknown, z.ZodTypeDef, unknown>>(
  schema: S,
  input: unknown,
): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError("Validation failed", result.error.flatten());
  }
  return result.data;
}
