import crypto from "node:crypto";
import { z, type ZodType } from "zod";
import {
  addRosterEntryRequestSchema,
  replaceRosterEntryRequestSchema,
  updateRosterEntryRequestSchema,
  rosterEntryToPayload,
  type Attribution,
  type Competition,
  type RosterEntry,
  type RosterEntryView,
} from "@soarscore/shared";
import type { EventStore } from "../eventstore/event-store.js";
import type { PilotLibraryProjection } from "../pilots/projection.js";
import type { CompetitionProjection } from "../competitions/projection.js";
import { NotFoundError } from "../pilots/errors.js";
import { CompetitionNotFoundError } from "../competitions/errors.js";
import type { RosterProjection } from "./projection.js";
import type {
  DrawStateProvider,
  EntryScoresProvider,
  RetirementStateProvider,
} from "./state-providers.js";
import {
  DuplicateRosterEntryError,
  RosterEntryHasFlownError,
  RosterEntryNotFoundError,
  RosterEntryRetiredError,
  RosterRemoveRequiresReplacementError,
  RosterReplaceNeedsConfirmationError,
  ValidationError,
} from "./errors.js";

export class RosterService {
  constructor(
    private readonly eventStore: EventStore,
    private readonly rosterProjection: RosterProjection,
    private readonly competitionProjection: CompetitionProjection,
    private readonly pilotProjection: PilotLibraryProjection,
    private readonly drawState: DrawStateProvider,
    private readonly retirementState: RetirementStateProvider,
    private readonly entryScores: EntryScoresProvider,
  ) {}

  list(competitionId: string): RosterEntryView[] {
    const competition = this.getCompetition(competitionId);
    const retired = this.retirementState.getRetiredEntryIds(competitionId);
    const views = this.rosterProjection
      .getRoster(competitionId)
      .map((entry) => this.toView(competition, entry, retired));
    // Sort by pilot number (nulls last), then pilot name.
    return views.sort((a, b) => {
      if (a.pilotNumber !== null || b.pilotNumber !== null) {
        if (a.pilotNumber === null) return 1;
        if (b.pilotNumber === null) return -1;
        if (a.pilotNumber !== b.pilotNumber) return a.pilotNumber - b.pilotNumber;
      }
      const byName = a.pilotName.localeCompare(b.pilotName, undefined, { sensitivity: "base" });
      return byName !== 0 ? byName : a.id.localeCompare(b.id);
    });
  }

  add(competitionId: string, input: unknown, attribution: Attribution): RosterEntryView {
    const competition = this.getCompetition(competitionId);
    const parsed = parseOrThrow(addRosterEntryRequestSchema, input);
    if (!this.pilotProjection.getById(parsed.pilotId)) {
      throw new NotFoundError(`Pilot ${parsed.pilotId} not found`);
    }
    if (this.rosterProjection.hasPilot(competitionId, parsed.pilotId)) {
      throw new DuplicateRosterEntryError("Pilot is already on this competition's roster");
    }
    const attributes = this.validateAttributes(
      competition,
      parsed.pilotNumber,
      parsed.pilotClass,
      this.rosterProjection.usedPilotNumbers(competitionId),
    );
    const entry: RosterEntry = {
      id: crypto.randomUUID(),
      competitionId,
      pilotId: parsed.pilotId,
      ...attributes,
    };

    const record = this.eventStore.append({
      scope: competitionId,
      type: "roster.entryAdded",
      payload: rosterEntryToPayload(entry),
      attribution,
    });
    this.rosterProjection.apply(record);
    return this.toView(competition, entry, this.retirementState.getRetiredEntryIds(competitionId));
  }

  update(
    competitionId: string,
    entryId: string,
    input: unknown,
    attribution: Attribution,
  ): RosterEntryView {
    // Ordered guards (load-bearing): not-found → retired → attribute rules.
    const competition = this.getCompetition(competitionId);
    const existing = this.getEntryOrThrow(competitionId, entryId);
    this.refuseIfRetired(competitionId, entryId, "edit");
    const parsed = parseOrThrow(updateRosterEntryRequestSchema, input);
    // Uniqueness excludes this entry's own number so resubmitting it passes.
    const used = this.rosterProjection.usedPilotNumbers(competitionId);
    if (existing.pilotNumber !== null) used.delete(existing.pilotNumber);
    const attributes = this.validateAttributes(
      competition,
      parsed.pilotNumber,
      parsed.pilotClass,
      used,
    );
    // Same entry id, same occupant — attributes only. No pilot.* event is
    // ever appended: AC2's isolation is structural.
    const entry: RosterEntry = { ...existing, ...attributes };

    const record = this.eventStore.append({
      scope: competitionId,
      type: "roster.entryUpdated",
      payload: rosterEntryToPayload(entry),
      attribution,
    });
    this.rosterProjection.apply(record);
    return this.toView(competition, entry, this.retirementState.getRetiredEntryIds(competitionId));
  }

  remove(competitionId: string, entryId: string, attribution: Attribution): void {
    // Ordered guards: not-found → retired → draw gate.
    this.getCompetition(competitionId);
    this.getEntryOrThrow(competitionId, entryId);
    this.refuseIfRetired(competitionId, entryId, "remove");
    if (this.drawState.hasAcceptedDraw(competitionId)) {
      throw new RosterRemoveRequiresReplacementError(
        "An accepted draw exists; replace this entrant instead of removing them",
      );
    }

    const record = this.eventStore.append({
      scope: competitionId,
      type: "roster.entryRemoved",
      payload: { rosterEntryId: entryId, competitionId },
      attribution,
    });
    this.rosterProjection.apply(record);
  }

  replace(
    competitionId: string,
    entryId: string,
    input: unknown,
    attribution: Attribution,
  ): { entry: RosterEntryView; drawAffected: boolean } {
    // Ordered guards: not-found → retired → flown seat → replacement pilot →
    // duplicate → acknowledgment.
    const competition = this.getCompetition(competitionId);
    const existing = this.getEntryOrThrow(competitionId, entryId);
    this.refuseIfRetired(competitionId, entryId, "replace");
    if (this.entryScores.hasCapturedScores(competitionId, entryId)) {
      throw new RosterEntryHasFlownError(
        "This entrant has captured scores; ask the Contest Director to retire them (retirement re-draws)",
      );
    }
    const parsed = parseOrThrow(replaceRosterEntryRequestSchema, input);
    if (!this.pilotProjection.getById(parsed.pilotId)) {
      throw new NotFoundError(`Pilot ${parsed.pilotId} not found`);
    }
    // Covers both an already-rostered replacement and this entry's current
    // occupant — a pilot holds at most one seat per roster.
    if (this.rosterProjection.hasPilot(competitionId, parsed.pilotId)) {
      throw new DuplicateRosterEntryError("Pilot is already on this competition's roster");
    }
    const drawAffected = this.drawState.hasAcceptedDraw(competitionId);
    if (drawAffected && parsed.confirmDrawAffected !== true) {
      throw new RosterReplaceNeedsConfirmationError(
        "Replacing this entrant affects the accepted draw and lane allocations",
      );
    }

    // Same seat, new occupant (RD4): the entry id and its pilotNumber /
    // pilotClass are unchanged (attribute edits are a separate update); the
    // previous occupant stays visible in the log — supersede, never overwrite.
    const entry: RosterEntry = { ...existing, pilotId: parsed.pilotId };
    const record = this.eventStore.append({
      scope: competitionId,
      type: "roster.entryReplaced",
      payload: {
        rosterEntryId: entry.id,
        competitionId,
        previousPilotId: existing.pilotId,
        pilotId: entry.pilotId,
        pilotNumber: entry.pilotNumber,
        pilotClass: entry.pilotClass,
      },
      attribution,
    });
    this.rosterProjection.apply(record);
    return {
      entry: this.toView(competition, entry, this.retirementState.getRetiredEntryIds(competitionId)),
      drawAffected,
    };
  }

  private getCompetition(competitionId: string): Competition {
    const competition = this.competitionProjection.getById(competitionId);
    if (!competition) {
      throw new CompetitionNotFoundError(`Competition ${competitionId} not found`);
    }
    return competition;
  }

  private getEntryOrThrow(competitionId: string, entryId: string): RosterEntry {
    const entry = this.rosterProjection.getEntry(competitionId, entryId);
    if (!entry) {
      throw new RosterEntryNotFoundError(`Roster entry ${entryId} not found`);
    }
    return entry;
  }

  private refuseIfRetired(competitionId: string, entryId: string, action: string): void {
    if (this.retirementState.getRetiredEntryIds(competitionId).has(entryId)) {
      throw new RosterEntryRetiredError(
        `Cannot ${action} a retired entrant; retired state is the Contest Director's to change`,
      );
    }
  }

  // Attribute rules shared by add/update, enforced against the *live*
  // competition projection — toggle state is never cached on the entry.
  private validateAttributes(
    competition: Competition,
    pilotNumber: number | null,
    pilotClass: string | null,
    usedNumbers: Set<number>,
  ): { pilotNumber: number | null; pilotClass: string | null } {
    let resultNumber: number | null = null;
    if (!competition.pilotNumbersEnabled) {
      if (pilotNumber !== null) {
        throw fieldValidationError("pilotNumber", "Pilot numbers are not enabled for this competition");
      }
    } else if (pilotNumber === null) {
      // Auto-assign the lowest free integer from 1 (RD5).
      let candidate = 1;
      while (usedNumbers.has(candidate)) candidate += 1;
      resultNumber = candidate;
    } else if (usedNumbers.has(pilotNumber)) {
      throw fieldValidationError("pilotNumber", `Pilot number ${pilotNumber} is already in use`);
    } else {
      resultNumber = pilotNumber;
    }

    let resultClass: string | null = null;
    if (!competition.pilotClassesEnabled) {
      if (pilotClass !== null) {
        throw fieldValidationError("pilotClass", "Pilot classes are not enabled for this competition");
      }
    } else if (pilotClass === null) {
      throw fieldValidationError("pilotClass", "A pilot class is required");
    } else {
      // Case-insensitive match; store the canonical casing from the set (RD6).
      const canonical = competition.pilotClasses.find(
        (name) => name.toLowerCase() === pilotClass.toLowerCase(),
      );
      if (canonical === undefined) {
        throw fieldValidationError(
          "pilotClass",
          `Pilot class must be one of: ${competition.pilotClasses.join(", ")}`,
        );
      }
      resultClass = canonical;
    }

    return { pilotNumber: resultNumber, pilotClass: resultClass };
  }

  private toView(
    competition: Competition,
    entry: RosterEntry,
    retiredIds: Set<string>,
  ): RosterEntryView {
    return {
      ...entry,
      // Disable-later reconciliation: when the owning competition's option is
      // now off, surface the attribute as null — the stored value stays in
      // the log/projection but is ignored.
      pilotNumber: competition.pilotNumbersEnabled ? entry.pilotNumber : null,
      pilotClass: competition.pilotClassesEnabled ? entry.pilotClass : null,
      pilotName: this.pilotProjection.getById(entry.pilotId)?.name ?? "Unknown pilot",
      retired: retiredIds.has(entry.id),
    };
  }
}

// Mirrors the Zod flatten() shape so the client's fieldErrors idiom applies.
function fieldValidationError(field: string, message: string): ValidationError {
  return new ValidationError("Validation failed", {
    formErrors: [],
    fieldErrors: { [field]: [message] },
  });
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
