import crypto from "node:crypto";
import { z, type ZodType } from "zod";
import {
  createCompetitionRequestSchema,
  updateCompetitionRequestSchema,
  competitionToCreatedPayload,
  type Attribution,
  type Competition,
} from "@soarscore/shared";
import type { EventStore } from "../eventstore/event-store.js";
import type { CompetitionProjection } from "./projection.js";
import type { CapturedScoresProvider, LockStateProvider } from "./state-providers.js";
import {
  CompetitionDeleteNeedsConfirmationError,
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
    private readonly lockState: LockStateProvider,
    private readonly capturedScores: CapturedScoresProvider,
  ) {}

  list(): Competition[] {
    return this.projection.getAll();
  }

  get(id: string): Competition {
    const competition = this.projection.getById(id);
    if (!competition) throw new CompetitionNotFoundError(`Competition ${id} not found`);
    return competition;
  }

  create(input: unknown, attribution: Attribution): Competition {
    const parsed = parseOrThrow(createCompetitionRequestSchema, input);
    const competition: Competition = {
      id: crypto.randomUUID(),
      name: parsed.name,
      date: parsed.date,
      venue: parsed.venue ?? null,
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
    if (!this.projection.getById(id)) {
      throw new CompetitionNotFoundError(`Competition ${id} not found`);
    }
    const parsed = parseOrThrow(updateCompetitionRequestSchema, input);
    // Whole-aggregate identity update over the same id — rename never breaks
    // id-keyed references.
    const competition: Competition = {
      id,
      name: parsed.name,
      date: parsed.date,
      venue: parsed.venue ?? null,
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
