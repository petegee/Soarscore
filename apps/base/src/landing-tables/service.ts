import crypto from "node:crypto";
import { z, type ZodType } from "zod";
import {
  createLandingTableRequestSchema,
  updateLandingTableRequestSchema,
  landingTableToCreatedPayload,
  type Attribution,
  type LandingBonusTable,
} from "@soarscore/shared";
import type { EventStore } from "../eventstore/event-store.js";
import type { LandingTableProjection } from "./projection.js";
import type { LandingTableReferenceChecker } from "./table-reference-checker.js";
import { LandingTableNotFoundError, ReferencedLandingTableError, ValidationError } from "./errors.js";

const SCOPE = "master-data";

export class LandingTableService {
  constructor(
    private readonly eventStore: EventStore,
    private readonly projection: LandingTableProjection,
    private readonly referenceChecker: LandingTableReferenceChecker,
  ) {}

  list(): LandingBonusTable[] {
    return this.projection.getAll();
  }

  get(id: string): LandingBonusTable {
    const table = this.projection.getById(id);
    if (!table) throw new LandingTableNotFoundError(`Landing table ${id} not found`);
    return table;
  }

  create(input: unknown, attribution: Attribution): LandingBonusTable {
    const parsed = parseOrThrow(createLandingTableRequestSchema, input);
    const table: LandingBonusTable = {
      id: crypto.randomUUID(),
      name: parsed.name,
      entries: parsed.entries.map((e) => ({ ...e })),
    };

    const record = this.eventStore.append({
      scope: SCOPE,
      type: "landingTable.created",
      payload: landingTableToCreatedPayload(table),
      attribution,
    });
    this.projection.apply(record);
    return table;
  }

  update(id: string, input: unknown, attribution: Attribution): LandingBonusTable {
    if (!this.projection.getById(id)) {
      throw new LandingTableNotFoundError(`Landing table ${id} not found`);
    }
    const parsed = parseOrThrow(updateLandingTableRequestSchema, input);
    const table: LandingBonusTable = {
      id,
      name: parsed.name,
      entries: parsed.entries.map((e) => ({ ...e })),
    };

    const record = this.eventStore.append({
      scope: SCOPE,
      type: "landingTable.updated",
      payload: landingTableToCreatedPayload(table),
      attribution,
    });
    this.projection.apply(record);
    return table;
  }

  duplicate(id: string, attribution: Attribution): LandingBonusTable {
    const source = this.get(id);
    const table: LandingBonusTable = {
      id: crypto.randomUUID(),
      name: source.name,
      entries: source.entries.map((e) => ({ ...e })),
    };

    const record = this.eventStore.append({
      scope: SCOPE,
      type: "landingTable.created",
      payload: landingTableToCreatedPayload(table),
      attribution,
    });
    this.projection.apply(record);
    return table;
  }

  delete(id: string, attribution: Attribution): void {
    if (!this.projection.getById(id)) {
      throw new LandingTableNotFoundError(`Landing table ${id} not found`);
    }

    const referencing = this.referenceChecker.getReferencingCompetitions(id);
    if (referencing.length > 0) {
      const names = referencing.map((c) => c.name).join(", ");
      throw new ReferencedLandingTableError(
        `Landing table is used by: ${names}`,
        referencing,
      );
    }

    const record = this.eventStore.append({
      scope: SCOPE,
      type: "landingTable.deleted",
      payload: { tableId: id },
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
