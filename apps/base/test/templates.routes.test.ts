import { describe, expect, it } from "vitest";
import { stockModelIdFor } from "@soarscore/shared";
import { buildApp } from "../src/app.js";

function makeApp() {
  return buildApp({ dbPath: ":memory:" });
}

const F3J = stockModelIdFor("F3J");
const F3K = stockModelIdFor("F3K");

const templatePayload = {
  name: "Club F3J",
  classModelId: F3J,
  pilotNumbersEnabled: true,
  pilotClassesEnabled: true,
  pilotClasses: ["Open", "Sports"],
};

const competitionPayload = {
  name: "Spring Cup",
  date: "2026-09-12",
  venue: "Rotorua",
  classModelId: F3K,
  pilotNumbersEnabled: true,
  pilotClassesEnabled: true,
  pilotClasses: ["Junior", "Open"],
};

describe("template routes", () => {
  it("creates a template (201) and lists it", async () => {
    const app = makeApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/templates",
      payload: templatePayload,
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ name: "Club F3J", classModelId: F3J });

    const list = await app.inject({ method: "GET", url: "/api/templates" });
    expect(list.json()).toHaveLength(1);
  });

  it("RD3: a colliding name is a 400 naming the field", async () => {
    const app = makeApp();
    await app.inject({ method: "POST", url: "/api/templates", payload: templatePayload });

    const response = await app.inject({
      method: "POST",
      url: "/api/templates",
      payload: { ...templatePayload, name: "  club f3j " },
    });
    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.details.fieldErrors.name).toEqual([
      'A template named "Club F3J" already exists',
    ]);
  });

  it("updates a template (200) and deletes it (204, then 404)", async () => {
    const app = makeApp();
    const created = await app.inject({
      method: "POST",
      url: "/api/templates",
      payload: templatePayload,
    });
    const id = created.json().id;

    const updated = await app.inject({
      method: "PUT",
      url: `/api/templates/${id}`,
      payload: { ...templatePayload, name: "Club F3J v2" },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().name).toBe("Club F3J v2");

    const deleted = await app.inject({ method: "DELETE", url: `/api/templates/${id}` });
    expect(deleted.statusCode).toBe(204);

    const getDeleted = await app.inject({ method: "GET", url: `/api/templates/${id}` });
    expect(getDeleted.statusCode).toBe(404);
    expect(getDeleted.json().code).toBe("TEMPLATE_NOT_FOUND");
  });

  it("AC1: save-as-template captures a competition's configuration (201)", async () => {
    const app = makeApp();
    const competition = await app.inject({
      method: "POST",
      url: "/api/competitions",
      payload: competitionPayload,
    });
    const competitionId = competition.json().id;

    const response = await app.inject({
      method: "POST",
      url: `/api/competitions/${competitionId}/save-as-template`,
      payload: { name: "From Spring Cup" },
    });
    expect(response.statusCode).toBe(201);
    const template = response.json();
    expect(template).toMatchObject({
      name: "From Spring Cup",
      classModelId: F3K,
      pilotNumbersEnabled: true,
      pilotClassesEnabled: true,
      pilotClasses: ["Junior", "Open"],
    });
    expect(template).not.toHaveProperty("date");
    expect(template).not.toHaveProperty("venue");
  });

  it("AC1: save-as-template from an unknown competition is a 404", async () => {
    const app = makeApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/competitions/missing/save-as-template",
      payload: { name: "X" },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("COMPETITION_NOT_FOUND");
  });

  it("AC2: seed creates a competition from the template plus supplied identity (201)", async () => {
    const app = makeApp();
    const created = await app.inject({
      method: "POST",
      url: "/api/templates",
      payload: templatePayload,
    });
    const templateId = created.json().id;

    const response = await app.inject({
      method: "POST",
      url: `/api/templates/${templateId}/seed`,
      payload: { name: "Autumn Open", date: "2026-11-07", venue: "Taupo" },
    });
    expect(response.statusCode).toBe(201);
    const competition = response.json();
    expect(competition).toMatchObject({
      name: "Autumn Open",
      date: "2026-11-07",
      venue: "Taupo",
      classModelId: F3J,
      pilotNumbersEnabled: true,
      pilotClassesEnabled: true,
      pilotClasses: ["Open", "Sports"],
    });

    const list = await app.inject({ method: "GET", url: "/api/competitions" });
    expect(list.json().map((c: { id: string }) => c.id)).toContain(competition.id);
  });

  it("AC2: seed with missing identity fields is a field-named 400", async () => {
    const app = makeApp();
    const created = await app.inject({
      method: "POST",
      url: "/api/templates",
      payload: templatePayload,
    });
    const templateId = created.json().id;

    const response = await app.inject({
      method: "POST",
      url: `/api/templates/${templateId}/seed`,
      payload: { name: "", date: "not-a-date" },
    });
    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.details.fieldErrors.name).toEqual(["Name is required"]);
    expect(body.details.fieldErrors.date).toEqual(["A valid date is required"]);
  });

  it("seed from an unknown template is a 404", async () => {
    const app = makeApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/templates/missing/seed",
      payload: { name: "X", date: "2026-01-01" },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("TEMPLATE_NOT_FOUND");
  });

  it("AC4: deleting a seeded-from template succeeds and leaves the competition intact", async () => {
    const app = makeApp();
    const created = await app.inject({
      method: "POST",
      url: "/api/templates",
      payload: templatePayload,
    });
    const templateId = created.json().id;

    const seeded = await app.inject({
      method: "POST",
      url: `/api/templates/${templateId}/seed`,
      payload: { name: "Kept", date: "2026-11-07" },
    });
    const competitionId = seeded.json().id;

    const deleted = await app.inject({ method: "DELETE", url: `/api/templates/${templateId}` });
    expect(deleted.statusCode).toBe(204);

    const competition = await app.inject({
      method: "GET",
      url: `/api/competitions/${competitionId}`,
    });
    expect(competition.statusCode).toBe(200);
    expect(competition.json().pilotClasses).toEqual(["Open", "Sports"]);
  });
});
