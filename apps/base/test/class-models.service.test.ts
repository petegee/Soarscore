import { describe, expect, it } from "vitest";
import { stockModelIdFor, type CompetitionRef } from "@soarscore/shared";
import { EventStore } from "../src/eventstore/event-store.js";
import { ClassModelProjection } from "../src/class-models/projection.js";
import { ClassModelService } from "../src/class-models/service.js";
import type { ClassModelReferenceChecker } from "../src/class-models/class-model-reference-checker.js";
import {
  ClassModelNotFoundError,
  ReferencedClassModelError,
  StockModelReadonlyError,
  ValidationError,
} from "../src/class-models/errors.js";

const attribution = { actorName: "tester", originClient: "test-client", authority: "organiser" };

const NO_REFERENCES: ClassModelReferenceChecker = { getReferencingCompetitions: () => [] };

function buildService(referenceChecker: ClassModelReferenceChecker = NO_REFERENCES) {
  const eventStore = new EventStore(":memory:");
  const projection = new ClassModelProjection();
  const service = new ClassModelService(eventStore, projection, referenceChecker);
  service.seedStockModels();
  return { eventStore, projection, service };
}

describe("ClassModelService — seed (AC1–AC4)", () => {
  it("AC1: seeds exactly six read-only stock models", () => {
    const { service } = buildService();
    const models = service.list();
    expect(models).toHaveLength(6);
    expect(models.map((m) => m.name).sort()).toEqual(["F3B", "F3J", "F3K", "F5J", "F5K", "F5L"]);
    expect(models.every((m) => m.origin === "stock")).toBe(true);
    for (const model of models) {
      expect(service.getWithDeviations(model.id).readOnly).toBe(true);
    }
  });

  it("AC1: re-seeding (restart) adds no duplicates", () => {
    const { eventStore, projection, service } = buildService();
    service.seedStockModels();
    service.seedStockModels();
    expect(service.list()).toHaveLength(6);

    // A fresh replay of the whole log yields the same six models.
    const fresh = new ClassModelProjection();
    fresh.rebuild(eventStore.readAll());
    expect(fresh.getAll()).toEqual(projection.getAll());
  });

  it("AC2: the F5L stock model owns its 100→0 landing table", () => {
    const { service } = buildService();
    const f5l = service.get(stockModelIdFor("F5L"));
    expect(f5l.landingTable).not.toBeNull();
    expect(f5l.landingTable?.entries[0]).toEqual({ distanceM: 0.2, points: 100 });
    expect(f5l.landingTable?.entries.at(-1)?.points).toBe(0);
  });

  it("AC3: F5L is 2 pt/s drop>5; F5J is 1 pt/s drop>4", () => {
    const { service } = buildService();
    const f5l = service.get(stockModelIdFor("F5L"));
    const f5j = service.get(stockModelIdFor("F5J"));
    expect(f5l.pointsPerSecond).toBe(2);
    expect(f5l.dropWorst).toEqual({ threshold: 5, unit: "round" });
    expect(f5j.pointsPerSecond).toBe(1);
    expect(f5j.dropWorst).toEqual({ threshold: 4, unit: "round" });
  });

  it("AC4: F3B normalises separately with a per-task drop-worst unit", () => {
    const { service } = buildService();
    const f3b = service.get(stockModelIdFor("F3B"));
    expect(f3b.basis).toBe("separate-per-task");
    expect(f3b.dropWorst).toEqual({ threshold: 5, unit: "task" });
    expect(f3b.speedInverted).toBe(true);
    // Classes fixing no single rate/table carry nulls, never placeholders.
    expect(f3b.pointsPerSecond).toBeNull();
    expect(f3b.landingTable).toBeNull();
  });
});

describe("ClassModelService — clone / edit (AC5–AC7)", () => {
  it("AC5: cloning a stock model yields a custom model and leaves the stock unchanged", () => {
    const { service } = buildService();
    const before = service.get(stockModelIdFor("F5L"));

    const clone = service.clone(stockModelIdFor("F5L"), { name: "F5L – local rule" }, attribution);
    expect(clone.name).toBe("F5L – local rule");
    expect(clone.origin).toBe("custom");
    expect(clone.sourceModelId).toBe(stockModelIdFor("F5L"));
    expect(clone.id).not.toBe(stockModelIdFor("F5L"));
    expect(clone.pointsPerSecond).toBe(2);

    // The stock model is byte-identical afterwards.
    expect(service.get(stockModelIdFor("F5L"))).toEqual(before);
    // And the clone owns an independent landing-table array.
    expect(clone.landingTable?.entries).not.toBe(before.landingTable?.entries);
  });

  it("AC6: editing a custom model records the correct stock-vs-chosen deviation", () => {
    const { service } = buildService();
    const clone = service.clone(stockModelIdFor("F5L"), { name: "F5L – local rule" }, attribution);

    const edited = service.update(
      clone.id,
      {
        name: "F5L – local rule",
        basis: clone.basis,
        speedInverted: clone.speedInverted,
        pointsPerSecond: clone.pointsPerSecond,
        dropWorst: { threshold: 3, unit: "round" },
        landingTable: clone.landingTable,
      },
      attribution,
    );
    expect(edited.dropWorst.threshold).toBe(3);

    const { deviations, readOnly } = service.getWithDeviations(clone.id);
    expect(readOnly).toBe(false);
    expect(deviations).toEqual([
      { field: "dropWorst.threshold", stockValue: 5, chosenValue: 3 },
    ]);
  });

  it("AC7: editing a stock model is refused with a clone-first error", () => {
    const { service } = buildService();
    expect(() =>
      service.update(
        stockModelIdFor("F3J"),
        {
          name: "F3J",
          basis: "single-group",
          speedInverted: false,
          pointsPerSecond: 2,
          dropWorst: { threshold: 3, unit: "round" },
          landingTable: null,
        },
        attribution,
      ),
    ).toThrow(StockModelReadonlyError);
  });
});

describe("ClassModelService — delete / naming (AC9–AC10)", () => {
  it("AC9: a stock model can never be deleted", () => {
    const { service } = buildService();
    expect(() => service.delete(stockModelIdFor("F3J"), attribution)).toThrow(StockModelReadonlyError);
  });

  it("AC9: an in-use custom model cannot be deleted, naming the competition", () => {
    const referencing: CompetitionRef[] = [{ id: "comp-1", name: "Spring Cup" }];
    const { service } = buildService({ getReferencingCompetitions: () => referencing });
    const clone = service.clone(stockModelIdFor("F5L"), { name: "Local F5L" }, attribution);

    try {
      service.delete(clone.id, attribution);
      throw new Error("expected ReferencedClassModelError");
    } catch (error) {
      expect(error).toBeInstanceOf(ReferencedClassModelError);
      expect((error as ReferencedClassModelError).competitions).toEqual(referencing);
      expect((error as ReferencedClassModelError).message).toContain("Spring Cup");
    }
    expect(service.get(clone.id)).toBeDefined();
  });

  it("deletes an unreferenced custom model (tombstone)", () => {
    const { service } = buildService();
    const clone = service.clone(stockModelIdFor("F5L"), { name: "Disposable" }, attribution);
    service.delete(clone.id, attribution);
    expect(() => service.get(clone.id)).toThrow(ClassModelNotFoundError);
  });

  it("AC10: a blank clone name is refused and no model is created", () => {
    const { service } = buildService();
    expect(() => service.clone(stockModelIdFor("F5L"), { name: "   " }, attribution)).toThrow(
      ValidationError,
    );
    expect(service.list()).toHaveLength(6);
  });

  it("AC10: a name colliding with any model (incl. stock, case-insensitively) is refused", () => {
    const { service } = buildService();
    // Colliding with a stock name.
    expect(() => service.clone(stockModelIdFor("F5L"), { name: "f5l" }, attribution)).toThrow(
      ValidationError,
    );

    // Colliding with an existing custom name.
    service.clone(stockModelIdFor("F5L"), { name: "Local Rule" }, attribution);
    expect(() => service.clone(stockModelIdFor("F3J"), { name: "  local rule " }, attribution)).toThrow(
      ValidationError,
    );
    // Only the one custom model was created.
    expect(service.list()).toHaveLength(7);
  });
});
