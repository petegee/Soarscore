import crypto from "node:crypto";
import { z, type ZodType } from "zod";
import {
  createContestTemplateRequestSchema,
  updateContestTemplateRequestSchema,
  saveAsTemplateRequestSchema,
  contestTemplateToCreatedPayload,
  type Attribution,
  type Competition,
  type ContestTemplate,
} from "@soarscore/shared";
import type { EventStore } from "../eventstore/event-store.js";
import type { TemplateProjection } from "./projection.js";
import type { CompetitionProjection } from "../competitions/projection.js";
import type { CompetitionService } from "../competitions/service.js";
import { CompetitionNotFoundError } from "../competitions/errors.js";
import { TemplateNotFoundError, ValidationError } from "./errors.js";

const SCOPE = "master-data";

export class TemplateService {
  constructor(
    private readonly eventStore: EventStore,
    private readonly projection: TemplateProjection,
    private readonly competitionProjection: CompetitionProjection,
    private readonly competitionService: CompetitionService,
  ) {}

  list(): ContestTemplate[] {
    return this.projection.getAll();
  }

  get(id: string): ContestTemplate {
    const template = this.projection.getById(id);
    if (!template) throw new TemplateNotFoundError(`Template ${id} not found`);
    return template;
  }

  create(input: unknown, attribution: Attribution): ContestTemplate {
    const parsed = parseOrThrow(createContestTemplateRequestSchema, input);
    this.assertNameAvailable(parsed.name);
    const template: ContestTemplate = {
      id: crypto.randomUUID(),
      name: parsed.name,
      discipline: parsed.discipline,
      pilotNumbersEnabled: parsed.pilotNumbersEnabled,
      pilotClassesEnabled: parsed.pilotClassesEnabled,
      pilotClasses: parsed.pilotClasses,
    };

    const record = this.eventStore.append({
      scope: SCOPE,
      type: "contestTemplate.created",
      payload: contestTemplateToCreatedPayload(template),
      attribution,
    });
    this.projection.apply(record);
    return template;
  }

  update(id: string, input: unknown, attribution: Attribution): ContestTemplate {
    if (!this.projection.getById(id)) {
      throw new TemplateNotFoundError(`Template ${id} not found`);
    }
    const parsed = parseOrThrow(updateContestTemplateRequestSchema, input);
    // Excluding the template itself keeps case-only renames of its own name legal.
    this.assertNameAvailable(parsed.name, id);
    const template: ContestTemplate = {
      id,
      name: parsed.name,
      discipline: parsed.discipline,
      pilotNumbersEnabled: parsed.pilotNumbersEnabled,
      pilotClassesEnabled: parsed.pilotClassesEnabled,
      pilotClasses: parsed.pilotClasses,
    };

    const record = this.eventStore.append({
      scope: SCOPE,
      type: "contestTemplate.updated",
      payload: contestTemplateToCreatedPayload(template),
      attribution,
    });
    this.projection.apply(record);
    return template;
  }

  delete(id: string, attribution: Attribution): void {
    if (!this.projection.getById(id)) {
      throw new TemplateNotFoundError(`Template ${id} not found`);
    }

    // No reference check (RD4/AC4): copy-on-seed means nothing ever references
    // a template, so deletion is always free.
    const record = this.eventStore.append({
      scope: SCOPE,
      type: "contestTemplate.deleted",
      payload: { templateId: id },
      attribution,
    });
    this.projection.apply(record);
  }

  // AC1 capture: snapshot a competition's configuration under a new name.
  // Copies configuration only — never identity (name/date/venue), roster, or
  // results. A colliding name is refused with a named error (MVP decision);
  // the Organiser edits the existing template instead.
  createFromCompetition(
    competitionId: string,
    input: unknown,
    attribution: Attribution,
  ): ContestTemplate {
    const source = this.competitionProjection.getById(competitionId);
    if (!source) {
      throw new CompetitionNotFoundError(`Competition ${competitionId} not found`);
    }
    const parsed = parseOrThrow(saveAsTemplateRequestSchema, input);
    this.assertNameAvailable(parsed.name);
    const template: ContestTemplate = {
      id: crypto.randomUUID(),
      name: parsed.name,
      discipline: source.discipline,
      pilotNumbersEnabled: source.pilotNumbersEnabled,
      pilotClassesEnabled: source.pilotClassesEnabled,
      pilotClasses: [...source.pilotClasses],
    };

    const record = this.eventStore.append({
      scope: SCOPE,
      type: "contestTemplate.created",
      payload: contestTemplateToCreatedPayload(template),
      attribution,
    });
    this.projection.apply(record);
    return template;
  }

  // AC2 seed: copy-on-seed. Merges the template's configuration with the
  // Organiser-supplied identity and delegates to CompetitionService.create —
  // delegation is load-bearing: never append competition.created here, or the
  // competition invariants fork. Identity-field validation errors surface from
  // the delegated create's own parseOrThrow with field-named errors.
  seedCompetition(templateId: string, input: unknown, attribution: Attribution): Competition {
    const template = this.get(templateId);
    // Identity fields come from the body; configuration only ever from the
    // template, so a request can never smuggle configuration past the snapshot.
    const body = (input ?? {}) as { name?: unknown; date?: unknown; venue?: unknown };
    const competition = this.competitionService.create(
      {
        name: body.name,
        date: body.date,
        venue: body.venue,
        discipline: template.discipline,
        pilotNumbersEnabled: template.pilotNumbersEnabled,
        pilotClassesEnabled: template.pilotClassesEnabled,
        pilotClasses: [...template.pilotClasses],
      },
      attribution,
    );

    // Audit-only provenance (RD4) — no projection consumes it.
    const record = this.eventStore.append({
      scope: SCOPE,
      type: "contestTemplate.seeded",
      payload: {
        templateId: template.id,
        templateName: template.name,
        competitionId: competition.id,
      },
      attribution,
    });
    this.projection.apply(record);
    return competition;
  }

  // RD3: template names unique after trimming, case-insensitively, across live
  // templates. Checked against projection state at command time (Zod cannot
  // see sibling templates); the single synchronous writer makes it race-free.
  private assertNameAvailable(name: string, excludeId?: string): void {
    const existing = this.projection.findByName(name);
    if (existing && existing.id !== excludeId) {
      throw new ValidationError("Validation failed", {
        formErrors: [],
        fieldErrors: { name: [`A template named "${existing.name}" already exists`] },
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
