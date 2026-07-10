import crypto from "node:crypto";
import { z, type ZodType } from "zod";
import {
  cloneClassModelRequestSchema,
  updateClassModelRequestSchema,
  classModelToCreatedPayload,
  deriveDeviations,
  STOCK_CLASS_MODELS,
  type Attribution,
  type ContestClassModel,
  type ModelFieldDeviation,
} from "@soarscore/shared";
import type { EventStore } from "../eventstore/event-store.js";
import type { ClassModelProjection } from "./projection.js";
import type { ClassModelReferenceChecker } from "./class-model-reference-checker.js";
import {
  ClassModelNotFoundError,
  ReferencedClassModelError,
  StockModelReadonlyError,
  ValidationError,
} from "./errors.js";

const SCOPE = "master-data";

// System attribution for the seed: stock models are appended by the base itself
// on init, not by an Organiser.
const SEED_ATTRIBUTION: Attribution = {
  actorName: "system",
  originClient: "base-seed",
  authority: "system",
};

export interface ClassModelWithDeviations {
  model: ContestClassModel;
  deviations: ModelFieldDeviation[];
  readOnly: boolean;
}

export class ClassModelService {
  constructor(
    private readonly eventStore: EventStore,
    private readonly projection: ClassModelProjection,
    private readonly referenceChecker: ClassModelReferenceChecker,
  ) {}

  list(): ContestClassModel[] {
    return this.projection.getAll();
  }

  get(id: string): ContestClassModel {
    const model = this.projection.getById(id);
    if (!model) throw new ClassModelNotFoundError(`Class model ${id} not found`);
    return model;
  }

  // GET /:id detail: a custom model carries its stock-vs-chosen deviation set
  // (AC6), derived on read (never stored stale, D4); a stock model has none.
  getWithDeviations(id: string): ClassModelWithDeviations {
    const model = this.get(id);
    let deviations: ModelFieldDeviation[] = [];
    if (model.origin === "custom" && model.sourceModelId) {
      const source = this.projection.getById(model.sourceModelId);
      if (source) deviations = deriveDeviations(model, source);
    }
    return { model, deviations, readOnly: model.origin === "stock" };
  }

  // Seed-on-init (AC1). Idempotent: any stock model already present (by its
  // deterministic id) is skipped, so a restart never duplicates or orphans a
  // referencing competition. Runs on the single synchronous SQLite writer.
  seedStockModels(attribution: Attribution = SEED_ATTRIBUTION): void {
    for (const def of STOCK_CLASS_MODELS) {
      if (this.projection.getById(def.id)) continue;
      const record = this.eventStore.append({
        scope: SCOPE,
        type: "classModel.seeded",
        payload: classModelToCreatedPayload(def),
        attribution,
      });
      this.projection.apply(record);
    }
  }

  // Clone a source model (stock or custom) into a named, editable custom model
  // (AC5). Rule-fixed values are deep-copied; the source is left untouched.
  clone(sourceId: string, input: unknown, attribution: Attribution): ContestClassModel {
    const source = this.get(sourceId);
    const parsed = parseOrThrow(cloneClassModelRequestSchema, input);
    this.assertNameAvailable(parsed.name);

    const id = crypto.randomUUID();
    const model: ContestClassModel = {
      id,
      name: parsed.name,
      sourceClass: source.sourceClass,
      origin: "custom",
      sourceModelId: source.id,
      basis: source.basis,
      speedInverted: source.speedInverted,
      pointsPerSecond: source.pointsPerSecond,
      dropWorst: { ...source.dropWorst },
      landingTable: source.landingTable
        ? {
            id: source.landingTable.id,
            name: source.landingTable.name,
            entries: source.landingTable.entries.map((e) => ({ ...e })),
          }
        : null,
    };

    const record = this.eventStore.append({
      scope: SCOPE,
      type: "classModel.created",
      payload: classModelToCreatedPayload(model),
      attribution,
    });
    this.projection.apply(record);
    return model;
  }

  // Edit a custom model's rule-fixed values (AC7). Stock edits are refused —
  // the Organiser must clone first. origin / sourceModelId / sourceClass are
  // preserved over the same id.
  update(id: string, input: unknown, attribution: Attribution): ContestClassModel {
    const existing = this.get(id);
    if (existing.origin === "stock") {
      throw new StockModelReadonlyError(
        "Stock models are read-only — clone the model into a custom model to vary it",
      );
    }
    const parsed = parseOrThrow(updateClassModelRequestSchema, input);
    this.assertNameAvailable(parsed.name, id);

    const model: ContestClassModel = {
      id,
      name: parsed.name,
      sourceClass: existing.sourceClass,
      origin: existing.origin,
      sourceModelId: existing.sourceModelId,
      basis: parsed.basis,
      speedInverted: parsed.speedInverted,
      pointsPerSecond: parsed.pointsPerSecond,
      dropWorst: { ...parsed.dropWorst },
      landingTable: parsed.landingTable
        ? {
            // Preserve the table id where the edit kept one; mint otherwise.
            id: parsed.landingTable.id ?? crypto.randomUUID(),
            name: parsed.landingTable.name,
            entries: parsed.landingTable.entries.map((e) => ({ ...e })),
          }
        : null,
    };

    const record = this.eventStore.append({
      scope: SCOPE,
      type: "classModel.updated",
      payload: classModelToCreatedPayload(model),
      attribution,
    });
    this.projection.apply(record);
    return model;
  }

  // Delete a custom model (AC9). Stock models are never deletable; an in-use
  // model is refused, naming the referencing competitions. Both guards are
  // API-authoritative, not UI-only.
  delete(id: string, attribution: Attribution): void {
    const existing = this.get(id);
    if (existing.origin === "stock") {
      throw new StockModelReadonlyError("Stock models cannot be deleted");
    }
    const referencing = this.referenceChecker.getReferencingCompetitions(id);
    if (referencing.length > 0) {
      const names = referencing.map((c) => c.name).join(", ");
      throw new ReferencedClassModelError(
        `Class model is used by: ${names}`,
        referencing,
      );
    }

    const record = this.eventStore.append({
      scope: SCOPE,
      type: "classModel.deleted",
      payload: { modelId: id },
      attribution,
    });
    this.projection.apply(record);
  }

  // AC10: names unique after trimming, case-insensitively, across ALL models
  // (stock names included). Checked against projection state at command time;
  // the single synchronous writer makes it race-free. Blank is caught by Zod.
  private assertNameAvailable(name: string, excludeId?: string): void {
    const existing = this.projection.findByName(name);
    if (existing && existing.id !== excludeId) {
      throw new ValidationError("Validation failed", {
        formErrors: [],
        fieldErrors: { name: [`A class model named "${existing.name}" already exists`] },
      });
    }
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
