import { describe, expect, it } from "vitest";
import { stockModelIdFor } from "@soarscore/shared";
import { buildApp } from "../src/app.js";

// RD1 closed end-to-end: buildApp's default checker now answers from real
// roster + competition state, so pilot deletion hard-blocks while rostered.
function makeApp() {
  return buildApp({ dbPath: ":memory:" });
}

type App = ReturnType<typeof makeApp>;

async function createCompetition(app: App, name: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/competitions",
    payload: { name, date: "2026-09-12", venue: null, classModelId: stockModelIdFor("F3J") },
  });
  return response.json().id as string;
}

async function createPilot(app: App, name: string) {
  const response = await app.inject({ method: "POST", url: "/api/pilots", payload: { name } });
  return response.json().id as string;
}

async function addEntry(app: App, competitionId: string, pilotId: string) {
  const response = await app.inject({
    method: "POST",
    url: `/api/competitions/${competitionId}/roster`,
    payload: { pilotId },
  });
  return response.json().id as string;
}

describe("pilot deletion vs roster references (RD1)", () => {
  it("409 names the referencing competitions; no force/override", async () => {
    const app = makeApp();
    const competitionId = await createCompetition(app, "Spring Cup");
    const pilotId = await createPilot(app, "Alice");
    await addEntry(app, competitionId, pilotId);

    const response = await app.inject({ method: "DELETE", url: `/api/pilots/${pilotId}` });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("PILOT_REFERENCED");
    expect(response.json().details.competitions).toEqual([
      { id: competitionId, name: "Spring Cup" },
    ]);
  });

  it("deleting after roster removal succeeds", async () => {
    const app = makeApp();
    const competitionId = await createCompetition(app, "Spring Cup");
    const pilotId = await createPilot(app, "Alice");
    const entryId = await addEntry(app, competitionId, pilotId);

    await app.inject({
      method: "DELETE",
      url: `/api/competitions/${competitionId}/roster/${entryId}`,
    });
    const response = await app.inject({ method: "DELETE", url: `/api/pilots/${pilotId}` });
    expect(response.statusCode).toBe(204);
  });

  it("a roster on a deleted competition does not block", async () => {
    const app = makeApp();
    const competitionId = await createCompetition(app, "Spring Cup");
    const pilotId = await createPilot(app, "Alice");
    await addEntry(app, competitionId, pilotId);

    const deletedCompetition = await app.inject({
      method: "DELETE",
      url: `/api/competitions/${competitionId}`,
      payload: { confirmDestroysResults: false },
    });
    expect(deletedCompetition.statusCode).toBe(204);

    const response = await app.inject({ method: "DELETE", url: `/api/pilots/${pilotId}` });
    expect(response.statusCode).toBe(204);
  });
});
