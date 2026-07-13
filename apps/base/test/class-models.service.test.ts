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

  it("AC2: the F5L stock model's task owns its 100→0 landing table", () => {
    const { service } = buildService();
    const f5l = service.get(stockModelIdFor("F5L"));
    const task = f5l.tasks[0];
    expect(task?.landingScored).toBe(true);
    expect(task?.landingTable).not.toBeNull();
    expect(task?.landingTable?.entries[0]).toEqual({ distanceM: 0.2, points: 100 });
    expect(task?.landingTable?.entries.at(-1)?.points).toBe(0);
  });

  it("AC3/AC5: F5L is 2 pt/s drop>5; F5J is 1 pt/s drop>4 (rate on the task)", () => {
    const { service } = buildService();
    const f5l = service.get(stockModelIdFor("F5L"));
    const f5j = service.get(stockModelIdFor("F5J"));
    expect(f5l.tasks[0]?.pointsPerSecond).toBe(2);
    expect(f5l.dropWorst).toEqual({ threshold: 5, unit: "round" });
    expect(f5j.tasks[0]?.pointsPerSecond).toBe(1);
    expect(f5j.dropWorst).toEqual({ threshold: 4, unit: "round" });
  });

  it("AC2: timing precision defaults per class (F3J 0.1 s nearest; F3K 0.1 s truncated)", () => {
    const { service } = buildService();
    const f3j = service.get(stockModelIdFor("F3J"));
    const f3k = service.get(stockModelIdFor("F3K"));
    expect(f3j.tasks[0]?.timingPrecision).toEqual({ stepSeconds: 0.1, rounding: "nearest" });
    expect(f3k.tasks[0]?.timingPrecision).toEqual({ stepSeconds: 0.1, rounding: "truncate" });
  });

  it("AC1: F3K alone allows per-round working-time overrides", () => {
    const { service } = buildService();
    const allowFlags = ["F3J", "F3K", "F5J", "F5K", "F5L", "F3B"].map((d) =>
      service.get(stockModelIdFor(d as never)).tasks.some((t) => t.perRoundOverrideAllowed),
    );
    // Only F3K (index 1) permits overrides.
    expect(allowFlags).toEqual([false, true, false, false, false, false]);
  });

  it("AC6: F5K seeds NLH-applicable tasks with the rule-fixed coefficients", () => {
    const { service } = buildService();
    const f5k = service.get(stockModelIdFor("F5K"));
    expect(f5k.tasks).toHaveLength(5);
    expect(f5k.tasks.every((t) => t.nlhApplicable)).toBe(true);
    expect(f5k.tasks[0]?.nlhCoefficients).toEqual({
      belowPerMetre: 0.5,
      above1to10PerMetre: -1.0,
      above11PlusPerMetre: -3.0,
    });
  });

  it("AC4: F3B normalises separately with a per-task drop-worst unit and three tasks", () => {
    const { service } = buildService();
    const f3b = service.get(stockModelIdFor("F3B"));
    expect(f3b.basis).toBe("separate-per-task");
    expect(f3b.dropWorst).toEqual({ threshold: 5, unit: "task" });
    expect(f3b.speedInverted).toBe(true);
    expect(f3b.tasks.map((t) => t.name)).toEqual(["Duration", "Distance", "Speed"]);
    // The speed task is 1/100 s and inverted; none score a landing (null tables).
    expect(f3b.tasks[2]?.timingPrecision).toEqual({ stepSeconds: 0.01, rounding: "nearest" });
    expect(f3b.tasks[2]?.speedInverted).toBe(true);
    expect(f3b.tasks.every((t) => t.landingTable === null)).toBe(true);
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
    expect(clone.tasks[0]?.pointsPerSecond).toBe(2);

    // The stock model is byte-identical afterwards.
    expect(service.get(stockModelIdFor("F5L"))).toEqual(before);
    // And the clone owns an independent task landing-table array.
    expect(clone.tasks[0]?.landingTable?.entries).not.toBe(before.tasks[0]?.landingTable?.entries);
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
        dropWorst: { threshold: 3, unit: "round" },
        tasks: clone.tasks,
        lonePilotBehaviour: clone.lonePilotBehaviour,
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

  it("AC2/AC5: editing a task's precision and rate surfaces per-task deviations", () => {
    const { service } = buildService();
    const clone = service.clone(stockModelIdFor("F5L"), { name: "F5L – tenths" }, attribution);
    const task = clone.tasks[0]!;

    service.update(
      clone.id,
      {
        name: "F5L – tenths",
        basis: clone.basis,
        speedInverted: clone.speedInverted,
        dropWorst: clone.dropWorst,
        tasks: [
          {
            ...task,
            timingPrecision: { stepSeconds: 0.1, rounding: "nearest" },
            pointsPerSecond: 3,
          },
        ],
        lonePilotBehaviour: clone.lonePilotBehaviour,
      },
      attribution,
    );

    const { deviations } = service.getWithDeviations(clone.id);
    expect(deviations).toEqual([
      {
        field: "tasks[0].timingPrecision",
        stockValue: { stepSeconds: 1, rounding: "truncate" },
        chosenValue: { stepSeconds: 0.1, rounding: "nearest" },
      },
      { field: "tasks[0].pointsPerSecond", stockValue: 2, chosenValue: 3 },
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
          dropWorst: { threshold: 3, unit: "round" },
          tasks: [],
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
