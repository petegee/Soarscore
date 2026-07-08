import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { RosterReferenceChecker } from "../src/pilots/roster-reference-checker.js";
import type { CompetitionRef } from "@soarscore/shared";

function makeApp(referenceChecker?: RosterReferenceChecker) {
  return buildApp({ dbPath: ":memory:", referenceChecker });
}

describe("pilot routes", () => {
  it("AC1: creates a pilot with only a name", async () => {
    const app = makeApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/pilots",
      payload: { name: "Minimal Pilot" },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toMatchObject({
      name: "Minimal Pilot",
      registrationId: null,
      club: null,
      contact: null,
    });
  });

  it("AC2: creates a pilot with all fields populated", async () => {
    const app = makeApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/pilots",
      payload: { name: "Full Pilot", registrationId: "R1", club: "Club A", contact: "a@b.com" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      name: "Full Pilot",
      registrationId: "R1",
      club: "Club A",
      contact: "a@b.com",
    });
  });

  it("AC3: rejects empty and whitespace-only names, leaving the list unchanged", async () => {
    const app = makeApp();

    const empty = await app.inject({ method: "POST", url: "/api/pilots", payload: { name: "" } });
    expect(empty.statusCode).toBe(400);
    expect(empty.json().code).toBe("VALIDATION_FAILED");

    const whitespace = await app.inject({
      method: "POST",
      url: "/api/pilots",
      payload: { name: "   " },
    });
    expect(whitespace.statusCode).toBe(400);

    const list = await app.inject({ method: "GET", url: "/api/pilots" });
    expect(list.json()).toHaveLength(0);
  });

  it("AC4: edits are reflected in library reads, isolated from roster concerns", async () => {
    const app = makeApp();
    const created = await app.inject({
      method: "POST",
      url: "/api/pilots",
      payload: { name: "Before Edit" },
    });
    const id = created.json().id;

    const updated = await app.inject({
      method: "PUT",
      url: `/api/pilots/${id}`,
      payload: { name: "After Edit", registrationId: null, club: null, contact: null },
    });
    expect(updated.statusCode).toBe(200);

    const fetched = await app.inject({ method: "GET", url: `/api/pilots/${id}` });
    expect(fetched.json().name).toBe("After Edit");
  });

  it("AC5: deletes an unreferenced pilot, removing it from the library", async () => {
    const app = makeApp();
    const created = await app.inject({
      method: "POST",
      url: "/api/pilots",
      payload: { name: "To Delete" },
    });
    const id = created.json().id;

    const before = await app.inject({ method: "GET", url: "/api/pilots" });
    expect(before.json()).toHaveLength(1);

    const deleted = await app.inject({ method: "DELETE", url: `/api/pilots/${id}` });
    expect(deleted.statusCode).toBe(204);

    const after = await app.inject({ method: "GET", url: "/api/pilots" });
    expect(after.json()).toHaveLength(0);

    const getDeleted = await app.inject({ method: "GET", url: `/api/pilots/${id}` });
    expect(getDeleted.statusCode).toBe(404);
  });

  it("AC6: refuses to delete a pilot referenced by a competition, naming it", async () => {
    const referencing: CompetitionRef[] = [{ id: "comp-1", name: "Spring Cup" }];
    const stubChecker: RosterReferenceChecker = {
      getReferencingCompetitions: () => referencing,
    };
    const app = makeApp(stubChecker);

    const created = await app.inject({
      method: "POST",
      url: "/api/pilots",
      payload: { name: "Referenced Pilot" },
    });
    const id = created.json().id;

    const response = await app.inject({ method: "DELETE", url: `/api/pilots/${id}` });
    expect(response.statusCode).toBe(409);
    const body = response.json();
    expect(body.code).toBe("PILOT_REFERENCED");
    expect(body.message).toContain("Spring Cup");
    expect(body.details.competitions).toEqual(referencing);
  });

  it("AC7: retains two pilots sharing a name, distinguished by other fields", async () => {
    const app = makeApp();
    await app.inject({
      method: "POST",
      url: "/api/pilots",
      payload: { name: "John Brown", club: "North Club" },
    });
    await app.inject({
      method: "POST",
      url: "/api/pilots",
      payload: { name: "John Brown", club: "South Club" },
    });

    const list = await app.inject({ method: "GET", url: "/api/pilots" });
    const names = list.json().map((p: { name: string }) => p.name);
    expect(names).toEqual(["John Brown", "John Brown"]);
    const clubs = list.json().map((p: { club: string }) => p.club);
    expect(clubs.sort()).toEqual(["North Club", "South Club"]);
  });

  it("records attribution from headers, defaulting to unknown when absent", async () => {
    const app = makeApp();

    const withoutHeaders = await app.inject({
      method: "POST",
      url: "/api/pilots",
      payload: { name: "No Header Pilot" },
    });
    expect(withoutHeaders.statusCode).toBe(201);

    const withHeaders = await app.inject({
      method: "POST",
      url: "/api/pilots",
      headers: { "x-actor-name": "Pete", "x-client-id": "client-42" },
      payload: { name: "Headered Pilot" },
    });
    expect(withHeaders.statusCode).toBe(201);
  });
});
