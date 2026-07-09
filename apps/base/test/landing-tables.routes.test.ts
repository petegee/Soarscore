import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { LandingTableReferenceChecker } from "../src/landing-tables/table-reference-checker.js";
import type { CompetitionRef } from "@soarscore/shared";

function makeApp(landingTableReferenceChecker?: LandingTableReferenceChecker) {
  return buildApp({ dbPath: ":memory:", landingTableReferenceChecker });
}

const entries = [
  { distanceM: 0, points: 100 },
  { distanceM: 5, points: 50 },
  { distanceM: 15, points: 0 },
];

describe("landing-table routes", () => {
  it("AC1: creates a table and round-trips entries verbatim (201)", async () => {
    const app = makeApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/landing-tables",
      payload: { name: "Standard", entries },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ name: "Standard", entries });
  });

  it("rejects an empty entry list (400)", async () => {
    const app = makeApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/landing-tables",
      payload: { name: "Empty", entries: [] },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_FAILED");
  });

  it("AC2: edit persists changed points (200)", async () => {
    const app = makeApp();
    const created = await app.inject({
      method: "POST",
      url: "/api/landing-tables",
      payload: { name: "T", entries },
    });
    const id = created.json().id;

    const updated = await app.inject({
      method: "PUT",
      url: `/api/landing-tables/${id}`,
      payload: { name: "T", entries: [{ distanceM: 0, points: 200 }] },
    });
    expect(updated.statusCode).toBe(200);

    const fetched = await app.inject({ method: "GET", url: `/api/landing-tables/${id}` });
    expect(fetched.json().entries).toEqual([{ distanceM: 0, points: 200 }]);
  });

  it("AC3: duplicate yields an independent table (201, distinct id)", async () => {
    const app = makeApp();
    const created = await app.inject({
      method: "POST",
      url: "/api/landing-tables",
      payload: { name: "Source", entries },
    });
    const id = created.json().id;

    const dup = await app.inject({ method: "POST", url: `/api/landing-tables/${id}/duplicate` });
    expect(dup.statusCode).toBe(201);
    expect(dup.json().id).not.toBe(id);
    expect(dup.json().entries).toEqual(entries);

    const list = await app.inject({ method: "GET", url: "/api/landing-tables" });
    expect(list.json()).toHaveLength(2);
  });

  it("AC4: refuses to delete a referenced table, naming it (409)", async () => {
    const referencing: CompetitionRef[] = [{ id: "comp-1", name: "Spring Cup" }];
    const stubChecker: LandingTableReferenceChecker = {
      getReferencingCompetitions: () => referencing,
    };
    const app = makeApp(stubChecker);
    const created = await app.inject({
      method: "POST",
      url: "/api/landing-tables",
      payload: { name: "Used", entries },
    });
    const id = created.json().id;

    const response = await app.inject({ method: "DELETE", url: `/api/landing-tables/${id}` });
    expect(response.statusCode).toBe(409);
    const body = response.json();
    expect(body.code).toBe("LANDING_TABLE_REFERENCED");
    expect(body.message).toContain("Spring Cup");
    expect(body.details.competitions).toEqual(referencing);
  });

  it("AC5: deletes an unreferenced table (204), then 404 on read", async () => {
    const app = makeApp();
    const created = await app.inject({
      method: "POST",
      url: "/api/landing-tables",
      payload: { name: "Temp", entries },
    });
    const id = created.json().id;

    const deleted = await app.inject({ method: "DELETE", url: `/api/landing-tables/${id}` });
    expect(deleted.statusCode).toBe(204);

    const getDeleted = await app.inject({ method: "GET", url: `/api/landing-tables/${id}` });
    expect(getDeleted.statusCode).toBe(404);
    expect(getDeleted.json().code).toBe("LANDING_TABLE_NOT_FOUND");
  });

  it("returns 404 when updating an unknown id", async () => {
    const app = makeApp();
    const response = await app.inject({
      method: "PUT",
      url: "/api/landing-tables/missing",
      payload: { name: "X", entries },
    });
    expect(response.statusCode).toBe(404);
  });
});
