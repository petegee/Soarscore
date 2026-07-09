import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type {
  CapturedScoresProvider,
  LockStateProvider,
} from "../src/competitions/state-providers.js";

function makeApp(overrides?: {
  lockStateProvider?: LockStateProvider;
  capturedScoresProvider?: CapturedScoresProvider;
}) {
  return buildApp({ dbPath: ":memory:", ...overrides });
}

const sample = { name: "Spring Cup", date: "2026-09-12", venue: "Rotorua" };

async function createCompetition(app: ReturnType<typeof makeApp>) {
  const response = await app.inject({ method: "POST", url: "/api/competitions", payload: sample });
  return response.json().id as string;
}

describe("competition routes", () => {
  it("AC1: creates a competition (201) and round-trips identity on read", async () => {
    const app = makeApp();
    const created = await app.inject({ method: "POST", url: "/api/competitions", payload: sample });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject(sample);

    const fetched = await app.inject({ method: "GET", url: `/api/competitions/${created.json().id}` });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json()).toMatchObject(sample);
  });

  it("AC2: rejects a missing date (400) with a field message", async () => {
    const app = makeApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/competitions",
      payload: { name: "No date" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_FAILED");
    expect(response.json().details.fieldErrors.date).toBeDefined();
  });

  it("updates identity (200)", async () => {
    const app = makeApp();
    const id = await createCompetition(app);
    const updated = await app.inject({
      method: "PUT",
      url: `/api/competitions/${id}`,
      payload: { name: "Renamed", date: "2026-09-13", venue: null },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ name: "Renamed", date: "2026-09-13", venue: null });
  });

  it("AC4: deletes an unreferenced competition (204), then 404 on read and re-delete", async () => {
    const app = makeApp();
    const id = await createCompetition(app);
    const deleted = await app.inject({ method: "DELETE", url: `/api/competitions/${id}` });
    expect(deleted.statusCode).toBe(204);

    const getDeleted = await app.inject({ method: "GET", url: `/api/competitions/${id}` });
    expect(getDeleted.statusCode).toBe(404);
    expect(getDeleted.json().code).toBe("COMPETITION_NOT_FOUND");

    const reDelete = await app.inject({ method: "DELETE", url: `/api/competitions/${id}` });
    expect(reDelete.statusCode).toBe(404);
  });

  it("AC5: captured scores need the acknowledgment flag (409, then 204)", async () => {
    const app = makeApp({ capturedScoresProvider: { hasCapturedScores: () => true } });
    const id = await createCompetition(app);

    const blocked = await app.inject({ method: "DELETE", url: `/api/competitions/${id}` });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().code).toBe("COMPETITION_DELETE_NEEDS_CONFIRMATION");

    const confirmed = await app.inject({
      method: "DELETE",
      url: `/api/competitions/${id}`,
      payload: { confirmDestroysResults: true },
    });
    expect(confirmed.statusCode).toBe(204);
  });

  it("AC6: locked competition is a hard 409 even with the flag", async () => {
    const app = makeApp({ lockStateProvider: { isLocked: () => true } });
    const id = await createCompetition(app);

    const response = await app.inject({
      method: "DELETE",
      url: `/api/competitions/${id}`,
      payload: { confirmDestroysResults: true },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("COMPETITION_LOCKED");
  });

  it("returns 404 when updating an unknown id", async () => {
    const app = makeApp();
    const response = await app.inject({
      method: "PUT",
      url: "/api/competitions/missing",
      payload: sample,
    });
    expect(response.statusCode).toBe(404);
  });
});
