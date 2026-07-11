import crypto from "node:crypto";
import { z, type ZodType } from "zod";
import {
  createPilotRequestSchema,
  updatePilotRequestSchema,
  pilotToCreatedPayload,
  type Attribution,
  type CreatePilotRequest,
  type Pilot,
  type UpdatePilotRequest,
} from "@soarscore/shared";
import type { EventStore } from "../eventstore/event-store.js";
import type { PilotLibraryProjection } from "./projection.js";
import type { RosterReferenceChecker } from "./roster-reference-checker.js";
import { NotFoundError, ReferencedPilotError, ValidationError } from "./errors.js";

const SCOPE = "master-data";

export class PilotService {
  constructor(
    private readonly eventStore: EventStore,
    private readonly projection: PilotLibraryProjection,
    private readonly referenceChecker: RosterReferenceChecker,
  ) {}

  list(): Pilot[] {
    return this.projection.getAll();
  }

  get(id: string): Pilot {
    const pilot = this.projection.getById(id);
    if (!pilot) throw new NotFoundError(`Pilot ${id} not found`);
    return pilot;
  }

  create(input: unknown, attribution: Attribution): Pilot {
    const parsed = parseOrThrow(createPilotRequestSchema, input);
    const pilot: Pilot = { id: crypto.randomUUID(), ...toPilotFields(parsed) };

    const record = this.eventStore.append({
      scope: SCOPE,
      type: "pilot.created",
      payload: pilotToCreatedPayload(pilot),
      attribution,
    });
    this.projection.apply(record);
    return pilot;
  }

  update(id: string, input: unknown, attribution: Attribution): Pilot {
    if (!this.projection.getById(id)) {
      throw new NotFoundError(`Pilot ${id} not found`);
    }
    const parsed = parseOrThrow(updatePilotRequestSchema, input);
    const pilot: Pilot = { id, ...toPilotFields(parsed) };

    const record = this.eventStore.append({
      scope: SCOPE,
      type: "pilot.updated",
      payload: pilotToCreatedPayload(pilot),
      attribution,
    });
    this.projection.apply(record);
    return pilot;
  }

  delete(id: string, attribution: Attribution): void {
    if (!this.projection.getById(id)) {
      throw new NotFoundError(`Pilot ${id} not found`);
    }

    const referencing = this.referenceChecker.getReferencingCompetitions(id);
    if (referencing.length > 0) {
      const names = referencing.map((c) => c.name).join(", ");
      throw new ReferencedPilotError(`Pilot is on the roster of: ${names}`, referencing);
    }

    const record = this.eventStore.append({
      scope: SCOPE,
      type: "pilot.deleted",
      payload: { pilotId: id },
      attribution,
    });
    this.projection.apply(record);
  }
}

function toPilotFields(
  parsed: CreatePilotRequest | UpdatePilotRequest,
): Omit<Pilot, "id"> {
  return {
    name: parsed.name,
    registrationId: parsed.registrationId,
    club: parsed.club,
    contact: parsed.contact,
  };
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
