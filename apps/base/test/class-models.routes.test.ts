import { describe, expect, it } from "vitest";
import { stockModelIdFor } from "@soarscore/shared";
import { buildApp } from "../src/app.js";

function makeApp() {
  return buildApp({ dbPath: ":memory:" });
}

describe("class-model routes", () => {
  it("AC1: GET lists exactly six read-only stock models", async () => {
    const app = makeApp();
    const response = await app.inject({ method: "GET", url: "/api/class-models" });
    expect(response.statusCode).toBe(200);
    const models = response.json();
    expect(models).toHaveLength(6);
    expect(models.map((m: { name: string }) => m.name).sort()).toEqual([
      "F3B",
      "F3J",
      "F3K",
      "F5J",
      "F5K",
      "F5L",
    ]);

    const detail = await app.inject({
      method: "GET",
      url: `/api/class-models/${stockModelIdFor("F3J")}`,
    });
    expect(detail.json().readOnly).toBe(true);
    expect(detail.json().deviations).toEqual([]);
  });

  it("AC2/AC3: F5L carries its owned table and its rule numbers", async () => {
    const app = makeApp();
    const response = await app.inject({
      method: "GET",
      url: `/api/class-models/${stockModelIdFor("F5L")}`,
    });
    const { model } = response.json();
    expect(model.tasks[0].pointsPerSecond).toBe(2);
    expect(model.dropWorst).toEqual({ threshold: 5, unit: "round" });
    expect(model.tasks[0].landingTable.entries[0]).toEqual({ distanceM: 0.2, points: 100 });
  });

  it("AC4: F3B is separate-per-task with a per-task drop-worst unit", async () => {
    const app = makeApp();
    const response = await app.inject({
      method: "GET",
      url: `/api/class-models/${stockModelIdFor("F3B")}`,
    });
    const { model } = response.json();
    expect(model.basis).toBe("separate-per-task");
    expect(model.dropWorst.unit).toBe("task");
  });

  it("AC5: POST /:id/clone creates a custom model (201)", async () => {
    const app = makeApp();
    const response = await app.inject({
      method: "POST",
      url: `/api/class-models/${stockModelIdFor("F5L")}/clone`,
      payload: { name: "F5L – local rule" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      name: "F5L – local rule",
      origin: "custom",
      sourceModelId: stockModelIdFor("F5L"),
    });
  });

  it("AC7: PUT on a stock model is a 409 clone-first refusal", async () => {
    const app = makeApp();
    const response = await app.inject({
      method: "PUT",
      url: `/api/class-models/${stockModelIdFor("F3J")}`,
      payload: {
        name: "F3J",
        basis: "single-group",
        speedInverted: false,
        dropWorst: { threshold: 3, unit: "round" },
        tasks: [],
      },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("CLASS_MODEL_STOCK_READONLY");
  });

  it("AC9: DELETE of a stock model is a 409", async () => {
    const app = makeApp();
    const response = await app.inject({
      method: "DELETE",
      url: `/api/class-models/${stockModelIdFor("F3J")}`,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("CLASS_MODEL_STOCK_READONLY");
  });

  it("AC9: DELETE of an in-use custom model is a 409 naming the competition", async () => {
    const app = makeApp();
    const clone = await app.inject({
      method: "POST",
      url: `/api/class-models/${stockModelIdFor("F5L")}/clone`,
      payload: { name: "Local F5L" },
    });
    const modelId = clone.json().id;

    const competition = await app.inject({
      method: "POST",
      url: "/api/competitions",
      payload: { name: "Spring Cup", date: "2026-09-12", venue: null, classModelId: modelId },
    });
    expect(competition.statusCode).toBe(201);

    const response = await app.inject({ method: "DELETE", url: `/api/class-models/${modelId}` });
    expect(response.statusCode).toBe(409);
    const body = response.json();
    expect(body.code).toBe("CLASS_MODEL_REFERENCED");
    expect(body.details.competitions).toEqual([{ id: competition.json().id, name: "Spring Cup" }]);
  });

  it("AC10: cloning with a blank name is a 400 field error", async () => {
    const app = makeApp();
    const response = await app.inject({
      method: "POST",
      url: `/api/class-models/${stockModelIdFor("F5L")}/clone`,
      payload: { name: "  " },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_FAILED");
    expect(response.json().details.fieldErrors.name).toBeDefined();
  });

  it("AC10: cloning with a name already used by a stock model is a 400", async () => {
    const app = makeApp();
    const response = await app.inject({
      method: "POST",
      url: `/api/class-models/${stockModelIdFor("F5L")}/clone`,
      payload: { name: "f5l" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_FAILED");
  });

  it("GET of an unknown model id is a 404", async () => {
    const app = makeApp();
    const response = await app.inject({ method: "GET", url: "/api/class-models/nope" });
    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("CLASS_MODEL_NOT_FOUND");
  });
});
