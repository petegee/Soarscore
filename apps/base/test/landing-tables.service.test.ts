import { describe, expect, it } from "vitest";
import { EventStore } from "../src/eventstore/event-store.js";
import { LandingTableProjection } from "../src/landing-tables/projection.js";
import { NoTaskConfigYetChecker } from "../src/landing-tables/table-reference-checker.js";
import { LandingTableService } from "../src/landing-tables/service.js";
import {
  LandingTableNotFoundError,
  ReferencedLandingTableError,
  ValidationError,
} from "../src/landing-tables/errors.js";

const attribution = { actorName: "tester", originClient: "test-client", authority: "organiser" };

function buildService(referenceChecker = new NoTaskConfigYetChecker()) {
  const eventStore = new EventStore(":memory:");
  const projection = new LandingTableProjection();
  const service = new LandingTableService(eventStore, projection, referenceChecker);
  return { eventStore, projection, service };
}

const sampleEntries = [
  { distanceM: 0, points: 100 },
  { distanceM: 5, points: 50 },
  { distanceM: 15, points: 0 },
];

describe("LandingTableService", () => {
  it("AC1: creates and round-trips entries verbatim, including boundary rows", () => {
    const { service } = buildService();
    const created = service.create({ name: "Standard F3B", entries: sampleEntries }, attribution);
    expect(created.name).toBe("Standard F3B");
    expect(created.entries).toEqual(sampleEntries);
    expect(service.get(created.id).entries).toEqual(sampleEntries);
  });

  it("AC2: edit persists changed points via a whole-aggregate update", () => {
    const { service } = buildService();
    const created = service.create({ name: "T", entries: sampleEntries }, attribution);
    const updated = service.update(
      created.id,
      { name: "T", entries: [{ distanceM: 0, points: 120 }, { distanceM: 10, points: 0 }] },
      attribution,
    );
    expect(updated.entries).toEqual([{ distanceM: 0, points: 120 }, { distanceM: 10, points: 0 }]);
    expect(service.get(created.id).entries).toHaveLength(2);
  });

  it("AC3: duplicate yields a fully independent table (distinct id, no shared array)", () => {
    const { service } = buildService();
    const source = service.create({ name: "Source", entries: sampleEntries }, attribution);
    const copy = service.duplicate(source.id, attribution);

    expect(copy.id).not.toBe(source.id);
    expect(copy.name).toBe("Source");
    expect(copy.entries).toEqual(source.entries);
    expect(copy.entries).not.toBe(source.entries);

    // Editing the original must not touch the copy, and vice versa.
    service.update(source.id, { name: "Source edited", entries: [{ distanceM: 1, points: 1 }] }, attribution);
    expect(service.get(copy.id).entries).toEqual(sampleEntries);

    service.update(copy.id, { name: "Copy edited", entries: [{ distanceM: 2, points: 2 }] }, attribution);
    expect(service.get(source.id).entries).toEqual([{ distanceM: 1, points: 1 }]);
  });

  it("AC4: refuses to delete a referenced table, naming the blocking competitions", () => {
    const referencing = [{ id: "comp-1", name: "Spring Cup" }];
    const { service } = buildService({ getReferencingCompetitions: () => referencing });
    const created = service.create({ name: "Used", entries: sampleEntries }, attribution);

    try {
      service.delete(created.id, attribution);
      throw new Error("expected ReferencedLandingTableError");
    } catch (error) {
      expect(error).toBeInstanceOf(ReferencedLandingTableError);
      expect((error as ReferencedLandingTableError).competitions).toEqual(referencing);
      expect((error as ReferencedLandingTableError).message).toContain("Spring Cup");
    }
    // Still present — the delete was blocked before appending.
    expect(service.get(created.id)).toBeDefined();
  });

  it("AC5: a table persists with no reference and this is not an error", () => {
    const { service } = buildService();
    const created = service.create({ name: "Standalone", entries: sampleEntries }, attribution);
    expect(service.list()).toHaveLength(1);
    expect(service.get(created.id).name).toBe("Standalone");
  });

  it("deletes an unreferenced table", () => {
    const { service } = buildService();
    const created = service.create({ name: "Temp", entries: sampleEntries }, attribution);
    service.delete(created.id, attribution);
    expect(() => service.get(created.id)).toThrow(LandingTableNotFoundError);
  });

  it("rejects an empty entry list and a whitespace-only name", () => {
    const { service } = buildService();
    expect(() => service.create({ name: "T", entries: [] }, attribution)).toThrow(ValidationError);
    expect(() => service.create({ name: "   ", entries: sampleEntries }, attribution)).toThrow(
      ValidationError,
    );
  });

  it("rebuilds identical state via full replay", () => {
    const { eventStore, service } = buildService();
    service.create({ name: "A", entries: sampleEntries }, attribution);
    const b = service.create({ name: "B", entries: sampleEntries }, attribution);
    service.duplicate(b.id, attribution);

    const before = service.list();
    const fresh = new LandingTableProjection();
    fresh.rebuild(eventStore.readAll());
    expect(fresh.getAll()).toEqual(before);
  });

  it("fails to update, get, delete, or duplicate an unknown id", () => {
    const { service } = buildService();
    expect(() => service.update("missing", { name: "X", entries: sampleEntries }, attribution)).toThrow(
      LandingTableNotFoundError,
    );
    expect(() => service.get("missing")).toThrow(LandingTableNotFoundError);
    expect(() => service.delete("missing", attribution)).toThrow(LandingTableNotFoundError);
    expect(() => service.duplicate("missing", attribution)).toThrow(LandingTableNotFoundError);
  });
});
