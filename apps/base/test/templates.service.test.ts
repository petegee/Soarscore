import { describe, expect, it } from "vitest";
import { stockModelIdFor } from "@soarscore/shared";
import { EventStore } from "../src/eventstore/event-store.js";
import { CompetitionProjection } from "../src/competitions/projection.js";
import { ClassModelProjection } from "../src/class-models/projection.js";
import { ClassModelService } from "../src/class-models/service.js";
import {
  AlwaysUnlockedProvider,
  NoScoresYetProvider,
  type CapturedScoresProvider,
} from "../src/competitions/state-providers.js";
import { CompetitionService } from "../src/competitions/service.js";
import {
  CompetitionDisciplineLockedError,
  CompetitionNotFoundError,
} from "../src/competitions/errors.js";
import { TemplateProjection } from "../src/templates/projection.js";
import { TemplateService } from "../src/templates/service.js";
import { TemplateNotFoundError, ValidationError } from "../src/templates/errors.js";

const attribution = { actorName: "tester", originClient: "test-client", authority: "organiser" };

const F3J = stockModelIdFor("F3J");
const F3K = stockModelIdFor("F3K");
const F5J = stockModelIdFor("F5J");

function buildServices(capturedScores: CapturedScoresProvider = new NoScoresYetProvider()) {
  const eventStore = new EventStore(":memory:");
  const classModelProjection = new ClassModelProjection();
  new ClassModelService(eventStore, classModelProjection, {
    getReferencingCompetitions: () => [],
  }).seedStockModels();
  const competitionProjection = new CompetitionProjection();
  const competitionService = new CompetitionService(
    eventStore,
    competitionProjection,
    classModelProjection,
    new AlwaysUnlockedProvider(),
    capturedScores,
  );
  const projection = new TemplateProjection();
  const service = new TemplateService(
    eventStore,
    projection,
    competitionProjection,
    classModelProjection,
    competitionService,
  );
  return { eventStore, projection, service, competitionService };
}

const sampleTemplate = {
  name: "Club F3J",
  classModelId: F3J,
  pilotNumbersEnabled: true,
  pilotClassesEnabled: true,
  pilotClasses: ["Open", "Sports"],
};

const sampleCompetition = {
  name: "Spring Cup",
  date: "2026-09-12",
  venue: "Rotorua",
  classModelId: F3K,
  pilotNumbersEnabled: true,
  pilotClassesEnabled: true,
  pilotClasses: ["Junior", "Open"],
};

describe("TemplateService", () => {
  it("creates, updates, and lists templates; rebuild reproduces state", () => {
    const { eventStore, service } = buildServices();
    const created = service.create(sampleTemplate, attribution);
    expect(created.name).toBe("Club F3J");
    expect(created.classModelId).toBe(F3J);
    expect(created.pilotClasses).toEqual(["Open", "Sports"]);

    const updated = service.update(
      created.id,
      { ...sampleTemplate, name: "Club F3J v2", pilotNumbersEnabled: false },
      attribution,
    );
    expect(updated.pilotNumbersEnabled).toBe(false);
    expect(service.get(created.id).name).toBe("Club F3J v2");

    const fresh = new TemplateProjection();
    fresh.rebuild(eventStore.readAll());
    expect(fresh.getAll()).toEqual(service.list());
  });

  it("delete is a tombstone — the created event stays in the log", () => {
    const { eventStore, service } = buildServices();
    const created = service.create(sampleTemplate, attribution);
    service.delete(created.id, attribution);

    expect(() => service.get(created.id)).toThrow(TemplateNotFoundError);
    const types = eventStore.readAll().map((e) => e.type);
    expect(types).toContain("contestTemplate.created");
    expect(types).toContain("contestTemplate.deleted");
  });

  it("fails to update, get, or delete an unknown id", () => {
    const { service } = buildServices();
    expect(() => service.get("missing")).toThrow(TemplateNotFoundError);
    expect(() => service.update("missing", sampleTemplate, attribution)).toThrow(
      TemplateNotFoundError,
    );
    expect(() => service.delete("missing", attribution)).toThrow(TemplateNotFoundError);
  });

  it("RD3: refuses a colliding name — exact, case-only, and whitespace variants", () => {
    const { service } = buildServices();
    service.create(sampleTemplate, attribution);

    for (const name of ["Club F3J", "club f3j", "  Club F3J  "]) {
      try {
        service.create({ ...sampleTemplate, name }, attribution);
        throw new Error("expected ValidationError");
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const details = (error as ValidationError).details as {
          fieldErrors: Record<string, string[]>;
        };
        expect(details.fieldErrors.name).toEqual(['A template named "Club F3J" already exists']);
      }
    }
    expect(service.list()).toHaveLength(1);
  });

  it("RD3: update colliding with a different template is refused; own name re-case is allowed", () => {
    const { service } = buildServices();
    const a = service.create(sampleTemplate, attribution);
    service.create({ ...sampleTemplate, name: "Other" }, attribution);

    expect(() => service.update(a.id, { ...sampleTemplate, name: "other" }, attribution)).toThrow(
      ValidationError,
    );

    // Keeping or re-casing the template's own name is legal.
    const kept = service.update(a.id, { ...sampleTemplate, name: "Club F3J" }, attribution);
    expect(kept.name).toBe("Club F3J");
    const recased = service.update(a.id, { ...sampleTemplate, name: "CLUB F3J" }, attribution);
    expect(recased.name).toBe("CLUB F3J");
  });

  it("enforces the entry-option invariants inside the template", () => {
    const { service } = buildServices();

    // Enabled toggle with zero usable classes is refused.
    expect(() =>
      service.create(
        { ...sampleTemplate, pilotClassesEnabled: true, pilotClasses: ["  "] },
        attribution,
      ),
    ).toThrow(ValidationError);

    // Classes deduped case-insensitively.
    const deduped = service.create(
      { ...sampleTemplate, name: "Deduped", pilotClasses: ["Open", "open", "Sports"] },
      attribution,
    );
    expect(deduped.pilotClasses).toEqual(["Open", "Sports"]);

    // Classes discarded when the toggle is off.
    const off = service.create(
      { ...sampleTemplate, name: "Off", pilotClassesEnabled: false, pilotClasses: ["Open"] },
      attribution,
    );
    expect(off.pilotClasses).toEqual([]);
  });

  it("AC1: save-as-template copies configuration only, never identity", () => {
    const { service, competitionService } = buildServices();
    const source = competitionService.create(sampleCompetition, attribution);

    const template = service.createFromCompetition(
      source.id,
      { name: "From Spring Cup" },
      attribution,
    );
    expect(template.name).toBe("From Spring Cup");
    expect(template.classModelId).toBe(F3K);
    expect(template.pilotNumbersEnabled).toBe(true);
    expect(template.pilotClassesEnabled).toBe(true);
    expect(template.pilotClasses).toEqual(["Junior", "Open"]);
    // Configuration only — no identity fields ride along.
    expect(template).not.toHaveProperty("date");
    expect(template).not.toHaveProperty("venue");
  });

  it("AC1: save-as-template refuses an unknown or deleted source competition (404)", () => {
    const { service, competitionService } = buildServices();
    expect(() =>
      service.createFromCompetition("missing", { name: "X" }, attribution),
    ).toThrow(CompetitionNotFoundError);

    const source = competitionService.create(sampleCompetition, attribution);
    competitionService.delete(source.id, { confirmDestroysResults: false }, attribution);
    expect(() =>
      service.createFromCompetition(source.id, { name: "X" }, attribution),
    ).toThrow(CompetitionNotFoundError);
  });

  it("AC1: save-as-template refuses a colliding template name", () => {
    const { service, competitionService } = buildServices();
    service.create(sampleTemplate, attribution);
    const source = competitionService.create(sampleCompetition, attribution);
    expect(() =>
      service.createFromCompetition(source.id, { name: "club f3j" }, attribution),
    ).toThrow(ValidationError);
  });

  it("AC2: seed merges template configuration with supplied identity via the ordinary create", () => {
    const { eventStore, service, competitionService } = buildServices();
    const template = service.create(sampleTemplate, attribution);

    const competition = service.seedCompetition(
      template.id,
      { name: "Autumn Open", date: "2026-11-07", venue: "Taupo" },
      attribution,
    );
    expect(competition.name).toBe("Autumn Open");
    expect(competition.date).toBe("2026-11-07");
    expect(competition.venue).toBe("Taupo");
    expect(competition.classModelId).toBe(F3J);
    expect(competition.pilotNumbersEnabled).toBe(true);
    expect(competition.pilotClassesEnabled).toBe(true);
    expect(competition.pilotClasses).toEqual(["Open", "Sports"]);

    // Indistinguishable from a hand-configured competition: listed and fully
    // editable via the ordinary update path.
    expect(competitionService.list().map((c) => c.id)).toContain(competition.id);
    const edited = competitionService.update(
      competition.id,
      { ...sampleCompetition, name: "Autumn Open v2", classModelId: F3J },
      attribution,
    );
    expect(edited.name).toBe("Autumn Open v2");

    // Audit event carries the right ids and the denormalised template name.
    const seeded = eventStore.readAll().find((e) => e.type === "contestTemplate.seeded");
    expect(seeded?.payload).toEqual({
      templateId: template.id,
      templateName: template.name,
      competitionId: competition.id,
    });
  });

  it("AC2: missing or invalid identity fields are refused with field-named errors", () => {
    const { service } = buildServices();
    const template = service.create(sampleTemplate, attribution);

    try {
      service.seedCompetition(template.id, { name: "", date: "not-a-date" }, attribution);
      throw new Error("expected ValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const details = (error as ValidationError).details as {
        fieldErrors: Record<string, string[]>;
      };
      expect(details.fieldErrors.name).toEqual(["Name is required"]);
      expect(details.fieldErrors.date).toEqual(["A valid date is required"]);
    }
  });

  it("seed from an unknown template is a 404-shaped refusal", () => {
    const { service } = buildServices();
    expect(() =>
      service.seedCompetition("missing", { name: "X", date: "2026-01-01" }, attribution),
    ).toThrow(TemplateNotFoundError);
  });

  it("AC3: the class-change guard applies to a seeded competition unchanged", () => {
    // Unlocked / score-free: the seeded competition's class is editable.
    const free = buildServices();
    const freeTemplate = free.service.create(sampleTemplate, attribution);
    const freeCompetition = free.service.seedCompetition(
      freeTemplate.id,
      { name: "Editable", date: "2026-11-07" },
      attribution,
    );
    const changed = free.competitionService.update(
      freeCompetition.id,
      { name: "Editable", date: "2026-11-07", classModelId: F5J },
      attribution,
    );
    expect(changed.classModelId).toBe(F5J);

    // With captured scores: the existing guard fires.
    const guarded = buildServices({ hasCapturedScores: () => true });
    const guardedTemplate = guarded.service.create(sampleTemplate, attribution);
    const guardedCompetition = guarded.service.seedCompetition(
      guardedTemplate.id,
      { name: "Guarded", date: "2026-11-07" },
      attribution,
    );
    expect(() =>
      guarded.competitionService.update(
        guardedCompetition.id,
        { name: "Guarded", date: "2026-11-07", classModelId: F5J },
        attribution,
      ),
    ).toThrow(CompetitionDisciplineLockedError);
  });

  it("AC4: template edit and delete never touch seeded competitions", () => {
    const { service, competitionService } = buildServices();
    const template = service.create(sampleTemplate, attribution);
    const first = service.seedCompetition(
      template.id,
      { name: "First", date: "2026-01-10" },
      attribution,
    );
    const second = service.seedCompetition(
      template.id,
      { name: "Second", date: "2026-02-10" },
      attribution,
    );

    service.update(
      template.id,
      { ...sampleTemplate, pilotClassesEnabled: false, pilotClasses: [] },
      attribution,
    );
    // Deletion is always free — no reference error (RD4).
    service.delete(template.id, attribution);

    expect(competitionService.get(first.id).pilotClasses).toEqual(["Open", "Sports"]);
    expect(competitionService.get(second.id).pilotClasses).toEqual(["Open", "Sports"]);
    expect(competitionService.get(first.id).pilotClassesEnabled).toBe(true);
  });

  it("aliasing: a seeded competition and its template never share a pilotClasses array", () => {
    const { service, competitionService } = buildServices();
    const template = service.create(sampleTemplate, attribution);
    const competition = service.seedCompetition(
      template.id,
      { name: "Seeded", date: "2026-01-10" },
      attribution,
    );

    // Mutate the competition's classes — the template is unchanged.
    competitionService.update(
      competition.id,
      {
        name: "Seeded",
        date: "2026-01-10",
        classModelId: F3J,
        pilotNumbersEnabled: true,
        pilotClassesEnabled: true,
        pilotClasses: ["Solo"],
      },
      attribution,
    );
    expect(service.get(template.id).pilotClasses).toEqual(["Open", "Sports"]);

    // And vice versa.
    service.update(
      template.id,
      { ...sampleTemplate, pilotClasses: ["Rebuilt"] },
      attribution,
    );
    expect(competitionService.get(competition.id).pilotClasses).toEqual(["Solo"]);
  });
});
