import { describe, expect, it } from "vitest";
import { stockModelIdFor } from "@soarscore/shared";
import { buildApp } from "../src/app.js";
import type {
  DrawStateProvider,
  EntryScoresProvider,
  RetirementStateProvider,
} from "../src/roster/state-providers.js";

function makeApp(overrides?: {
  drawStateProvider?: DrawStateProvider;
  retirementStateProvider?: RetirementStateProvider;
  entryScoresProvider?: EntryScoresProvider;
}) {
  return buildApp({ dbPath: ":memory:", ...overrides });
}

type App = ReturnType<typeof makeApp>;

async function createCompetition(app: App, fields?: Record<string, unknown>) {
  const response = await app.inject({
    method: "POST",
    url: "/api/competitions",
    payload: {
      name: "Spring Cup",
      date: "2026-09-12",
      venue: null,
      classModelId: stockModelIdFor("F3J"),
      ...fields,
    },
  });
  return response.json().id as string;
}

async function createPilot(app: App, name: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/pilots",
    payload: { name },
  });
  return response.json().id as string;
}

async function addEntry(app: App, competitionId: string, payload: Record<string, unknown>) {
  return app.inject({
    method: "POST",
    url: `/api/competitions/${competitionId}/roster`,
    payload,
  });
}

describe("roster routes", () => {
  it("201 add, 200 list with pilot name joined, 200 update, 204 remove", async () => {
    const app = makeApp();
    const competitionId = await createCompetition(app, { pilotNumbersEnabled: true });
    const pilotId = await createPilot(app, "Alice");

    const added = await addEntry(app, competitionId, { pilotId });
    expect(added.statusCode).toBe(201);
    const entry = added.json();
    expect(entry).toMatchObject({ pilotId, pilotName: "Alice", pilotNumber: 1, retired: false });

    const listed = await app.inject({ method: "GET", url: `/api/competitions/${competitionId}/roster` });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toHaveLength(1);

    const updated = await app.inject({
      method: "PUT",
      url: `/api/competitions/${competitionId}/roster/${entry.id}`,
      payload: { pilotNumber: 5 },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().pilotNumber).toBe(5);

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/competitions/${competitionId}/roster/${entry.id}`,
    });
    expect(removed.statusCode).toBe(204);
  });

  it("404 for an unknown competition and unknown entry", async () => {
    const app = makeApp();
    const competitionId = await createCompetition(app);

    const badComp = await app.inject({ method: "GET", url: "/api/competitions/nope/roster" });
    expect(badComp.statusCode).toBe(404);
    expect(badComp.json().code).toBe("COMPETITION_NOT_FOUND");

    const badEntry = await app.inject({
      method: "PUT",
      url: `/api/competitions/${competitionId}/roster/nope`,
      payload: {},
    });
    expect(badEntry.statusCode).toBe(404);
    expect(badEntry.json().code).toBe("ROSTER_ENTRY_NOT_FOUND");
  });

  it("409 DUPLICATE_ROSTER_ENTRY on a second add of the same pilot", async () => {
    const app = makeApp();
    const competitionId = await createCompetition(app);
    const pilotId = await createPilot(app, "Alice");
    await addEntry(app, competitionId, { pilotId });

    const duplicate = await addEntry(app, competitionId, { pilotId });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().code).toBe("DUPLICATE_ROSTER_ENTRY");
  });

  it("409 remove and replace gates under an accepted draw, then 200 replace with the flag", async () => {
    const app = makeApp({ drawStateProvider: { hasAcceptedDraw: () => true } });
    const competitionId = await createCompetition(app);
    const alice = await createPilot(app, "Alice");
    const bob = await createPilot(app, "Bob");
    const entry = (await addEntry(app, competitionId, { pilotId: alice })).json();

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/competitions/${competitionId}/roster/${entry.id}`,
    });
    expect(removed.statusCode).toBe(409);
    expect(removed.json().code).toBe("ROSTER_REMOVE_REQUIRES_REPLACEMENT");
    expect(removed.json().details.reason).toBe("accepted-draw");

    const unconfirmed = await app.inject({
      method: "POST",
      url: `/api/competitions/${competitionId}/roster/${entry.id}/replace`,
      payload: { pilotId: bob },
    });
    expect(unconfirmed.statusCode).toBe(409);
    expect(unconfirmed.json().code).toBe("ROSTER_REPLACE_AFFECTS_DRAW");
    expect(unconfirmed.json().details.reason).toBe("draw-and-lanes-affected");

    const confirmed = await app.inject({
      method: "POST",
      url: `/api/competitions/${competitionId}/roster/${entry.id}/replace`,
      payload: { pilotId: bob, confirmDrawAffected: true },
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json().drawAffected).toBe(true);
    expect(confirmed.json().entry).toMatchObject({ id: entry.id, pilotId: bob });
  });

  it("409 ROSTER_ENTRY_HAS_FLOWN hard-blocks replace even with the flag", async () => {
    const app = makeApp({
      entryScoresProvider: { hasCapturedScores: () => true },
    });
    const competitionId = await createCompetition(app);
    const alice = await createPilot(app, "Alice");
    const bob = await createPilot(app, "Bob");
    const entry = (await addEntry(app, competitionId, { pilotId: alice })).json();

    const response = await app.inject({
      method: "POST",
      url: `/api/competitions/${competitionId}/roster/${entry.id}/replace`,
      payload: { pilotId: bob, confirmDrawAffected: true },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("ROSTER_ENTRY_HAS_FLOWN");
    expect(response.json().details.reason).toBe("captured-scores");
  });

  it("409 ROSTER_ENTRY_RETIRED on update of a retired entry; list flags it", async () => {
    const retiredIds = new Set<string>();
    const app = makeApp({
      retirementStateProvider: { getRetiredEntryIds: () => retiredIds },
    });
    const competitionId = await createCompetition(app);
    const pilotId = await createPilot(app, "Alice");
    const entry = (await addEntry(app, competitionId, { pilotId })).json();
    retiredIds.add(entry.id);

    const listed = await app.inject({ method: "GET", url: `/api/competitions/${competitionId}/roster` });
    expect(listed.json()[0].retired).toBe(true);

    const updated = await app.inject({
      method: "PUT",
      url: `/api/competitions/${competitionId}/roster/${entry.id}`,
      payload: {},
    });
    expect(updated.statusCode).toBe(409);
    expect(updated.json().code).toBe("ROSTER_ENTRY_RETIRED");
  });

  it("400 with field errors for attribute violations", async () => {
    const app = makeApp();
    const competitionId = await createCompetition(app);
    const pilotId = await createPilot(app, "Alice");

    const response = await addEntry(app, competitionId, { pilotId, pilotNumber: 3 });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_FAILED");
    expect(response.json().details.fieldErrors.pilotNumber).toContain(
      "Pilot numbers are not enabled for this competition",
    );
  });
});
