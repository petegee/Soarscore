import crypto from "node:crypto";
import { z, type ZodType } from "zod";
import {
  createCompetitionRequestSchema,
  updateCompetitionRequestSchema,
  competitionToCreatedPayload,
  type Attribution,
  type Competition,
  type FinalisationOutcome,
  type LifecycleStateResponse,
  type OutstandingItem,
  type SetupSubState,
} from "@soarscore/shared";
import type { EventStore } from "../eventstore/event-store.js";
import type { CompetitionProjection } from "./projection.js";
import type { ClassModelProjection } from "../class-models/projection.js";
import type {
  CapturedScoresProvider,
  FinalisationProgressProvider,
  LockStateProvider,
} from "./state-providers.js";
import type { LifecycleProjection } from "../lifecycle/projection.js";
import type { LifecycleGuard } from "../lifecycle/guard.js";
import {
  CompetitionDeleteNeedsConfirmationError,
  CompetitionClassLockedError,
  CompetitionLockedError,
  CompetitionNotFoundError,
  CompetitionNotReadyError,
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
    // STORY-001-026: the completed-round/task counts the Lock finalisation guard
    // reads, through the seam so Lock is decoupled from the not-yet-built
    // round/scoring emitters. Injected via AppOptions (the established idiom).
    private readonly progress: FinalisationProgressProvider,
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

  // Start Proceedings (STORY-001-025): the single deliberate CD action that
  // transitions a competition from Setup to Running (BetweenGroups). Mirrors the
  // delete command idiom — not-found → read state → readiness split → guard
  // assert → append → apply → return the fresh read DTO. Appends exactly one
  // event on success and none on any rejection (AC7).
  start(id: string, attribution: Attribution): LifecycleStateResponse {
    // Not-found: a never-existed id 404s; a Deleted tombstone falls through to
    // the guard, which rejects Start from Deleted (AC7).
    if (!this.projection.getById(id) && !this.lifecycleProjection.isDeleted(id)) {
      throw new CompetitionNotFoundError(`Competition ${id} not found`);
    }
    const state = this.lifecycleProjection.getState(id);
    // Readiness split (load-bearing): a Setup competition below DrawAccepted is
    // blocked with the outstanding-prerequisite list (AC2/AC3) — the list is
    // computed here, never in the pure guard. Every other state defers to the
    // guard, which admits Setup/DrawAccepted and rejects the rest (AC7).
    if (state.state === "Setup" && state.setupSubState !== "DrawAccepted") {
      throw new CompetitionNotReadyError(
        "The competition is not ready to start",
        this.outstandingItemsFor(state.setupSubState ?? "Draft"),
      );
    }
    this.lifecycleGuard.assertAdmissible(state, "Start");
    const record = this.eventStore.append({
      scope: SCOPE,
      type: "competition.started",
      payload: { competitionId: id },
      attribution,
    });
    this.lifecycleProjection.apply(record);
    return this.getLifecycleState(id);
  }

  // Lock & Finalisation (STORY-001-026): the single deliberate CD action that
  // seals a Running/BetweenGroups competition into the terminal Locked state,
  // resolving and recording the finalisation outcome. Mirrors the start() command
  // idiom exactly — not-found → read state → guard assert → (new) resolve
  // finalisation → append one enriched event → apply → return the fresh read DTO.
  // Appends exactly one competition.locked event on success and none on any
  // rejection. Lock is NEVER blocked by a short round count: the count only
  // selects OfficialResults vs NoContest; a below-minimum contest still locks.
  lock(id: string, attribution: Attribution): LifecycleStateResponse {
    // Not-found: a never-existed id 404s; a Deleted tombstone falls through to
    // the guard, which rejects Lock from Deleted.
    if (!this.projection.getById(id) && !this.lifecycleProjection.isDeleted(id)) {
      throw new CompetitionNotFoundError(`Competition ${id} not found`);
    }
    const state = this.lifecycleProjection.getState(id);
    // Legality is the pure guard's alone: Lock is admissible only from
    // Running/BetweenGroups, so Setup / GroupInProgress / Suspended / Locked /
    // Deleted are rejected with TransitionNotAllowedError — a mid-group lock and
    // a double-lock (Locked is terminal) fall out for free. Appends nothing on
    // rejection.
    this.lifecycleGuard.assertAdmissible(state, "Lock");
    // Resolve the outcome ONCE at Lock and freeze it on the terminal event — a
    // locked contest's round count is immutable, so no read-time re-derivation.
    const outcome = this.resolveFinalisation(id);
    const completedRounds = this.progress.completedRounds(id);
    const record = this.eventStore.append({
      scope: SCOPE,
      type: "competition.locked",
      payload: { competitionId: id, outcome, completedRounds },
      attribution,
    });
    this.lifecycleProjection.apply(record);
    return this.getLifecycleState(id);
  }

  // The class-agnostic minimum-rounds validity guard (STORY-001-026). Reads only
  // the class model's minimumForValidContest scalar shape and the derived counts
  // and compares generically — NO branch on discipline/sourceClass (CLAUDE.md
  // class-model law). F3B's compound {rounds,tasks} and F5K's null are handled by
  // the same predicate. Never conflates minimumForValidContest with
  // dropWorst.threshold (different numbers).
  private resolveFinalisation(competitionId: string): FinalisationOutcome {
    const competition = this.get(competitionId);
    const model = this.classModelProjection.getById(competition.classModelId);
    const min = model?.minimumForValidContest ?? null;
    // null is "no rule to test against" (F5K) — the CD's judgement, always
    // OfficialResults. Must NOT collapse into { rounds: 0 }.
    if (min === null) return "OfficialResults";
    const roundsMet = this.progress.completedRounds(competitionId) >= min.rounds;
    const tasksMet =
      min.tasks === null || this.progress.completedTasks(competitionId) >= min.tasks;
    return roundsMet && tasksMet ? "OfficialResults" : "NoContest";
  }

  // Derive the unmet Start prerequisites from the Setup readiness ladder — no
  // new reads (STORY-001-025, AC2/AC3). Draft → both items; any rung below
  // DrawAccepted → the draw item. The ladder forbids an accepted draw over an
  // empty roster, so "draw not accepted" alone with an empty roster is
  // unreachable (asserted in tests).
  private outstandingItemsFor(subState: SetupSubState): OutstandingItem[] {
    const items: OutstandingItem[] = [];
    if (subState === "Draft") {
      items.push({ code: "ROSTER_INCOMPLETE", message: "The roster is not complete" });
    }
    if (subState !== "DrawAccepted") {
      items.push({ code: "DRAW_NOT_ACCEPTED", message: "The draw has not been accepted" });
    }
    return items;
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
