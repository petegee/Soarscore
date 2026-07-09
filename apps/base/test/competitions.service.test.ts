import { describe, expect, it } from "vitest";
import { EventStore } from "../src/eventstore/event-store.js";
import { CompetitionProjection } from "../src/competitions/projection.js";
import {
  AlwaysUnlockedProvider,
  NoScoresYetProvider,
  type CapturedScoresProvider,
  type LockStateProvider,
} from "../src/competitions/state-providers.js";
import { CompetitionService } from "../src/competitions/service.js";
import {
  CompetitionDeleteNeedsConfirmationError,
  CompetitionDisciplineLockedError,
  CompetitionLockedError,
  CompetitionNotFoundError,
  ValidationError,
} from "../src/competitions/errors.js";

const attribution = { actorName: "tester", originClient: "test-client", authority: "organiser" };

function buildService(
  lockState: LockStateProvider = new AlwaysUnlockedProvider(),
  capturedScores: CapturedScoresProvider = new NoScoresYetProvider(),
) {
  const eventStore = new EventStore(":memory:");
  const projection = new CompetitionProjection();
  const service = new CompetitionService(eventStore, projection, lockState, capturedScores);
  return { eventStore, projection, service };
}

const sample = { name: "Spring Cup", date: "2026-09-12", venue: "Rotorua", discipline: "F3J" };

describe("CompetitionService", () => {
  it("AC1: creates identity that survives a full replay (close/re-open)", () => {
    const { eventStore, service } = buildService();
    const created = service.create(sample, attribution);
    expect(created.name).toBe("Spring Cup");
    expect(created.date).toBe("2026-09-12");
    expect(created.venue).toBe("Rotorua");
    expect(created.discipline).toBe("F3J");
    expect(created.pilotNumbersEnabled).toBe(false);
    expect(created.pilotClassesEnabled).toBe(false);
    expect(created.pilotClasses).toEqual([]);

    const fresh = new CompetitionProjection();
    fresh.rebuild(eventStore.readAll());
    expect(fresh.getById(created.id)).toEqual(created);
  });

  it("normalises a blank venue to null", () => {
    const { service } = buildService();
    const created = service.create(
      { name: "No Venue", date: "2026-01-02", venue: "  ", discipline: "F5J" },
      attribution,
    );
    expect(created.venue).toBeNull();
  });

  it("AC2: rejects a missing name, naming the field", () => {
    const { service } = buildService();
    try {
      service.create({ date: "2026-09-12" }, attribution);
      throw new Error("expected ValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const details = (error as ValidationError).details as { fieldErrors: Record<string, string[]> };
      expect(details.fieldErrors.name).toBeDefined();
    }
  });

  it("AC2: rejects a missing / malformed date, naming the field", () => {
    const { service } = buildService();
    try {
      service.create({ name: "X", date: "not-a-date" }, attribution);
      throw new Error("expected ValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const details = (error as ValidationError).details as { fieldErrors: Record<string, string[]> };
      expect(details.fieldErrors.date).toContain("A valid date is required");
    }
  });

  it("AC3: two competitions are isolated — deleting/renaming one leaves the other intact", () => {
    const { service } = buildService();
    const a = service.create(
      { name: "A", date: "2026-01-01", venue: null, discipline: "F3B" },
      attribution,
    );
    const b = service.create(
      { name: "B", date: "2026-02-02", venue: null, discipline: "F3K" },
      attribution,
    );

    service.update(
      a.id,
      { name: "A renamed", date: "2026-01-01", venue: null, discipline: "F3B" },
      attribution,
    );
    service.delete(a.id, { confirmDestroysResults: false }, attribution);

    // b untouched; its id-keyed identity is preserved.
    expect(service.get(b.id)).toEqual({
      id: b.id,
      name: "B",
      date: "2026-02-02",
      venue: null,
      discipline: "F3K",
      pilotNumbersEnabled: false,
      pilotClassesEnabled: false,
      pilotClasses: [],
    });
  });

  it("AC4: unlocked, no-scores delete tombstones and drops on rebuild", () => {
    const { eventStore, service } = buildService();
    const created = service.create(sample, attribution);
    service.delete(created.id, { confirmDestroysResults: false }, attribution);

    expect(() => service.get(created.id)).toThrow(CompetitionNotFoundError);

    // Tombstone drops it on a fresh replay even though created is still logged.
    const fresh = new CompetitionProjection();
    fresh.rebuild(eventStore.readAll());
    expect(fresh.getById(created.id)).toBeUndefined();
  });

  it("AC5: captured scores without the flag → needs-confirmation; with the flag → deletes", () => {
    const scores: CapturedScoresProvider = { hasCapturedScores: () => true };
    const { service } = buildService(new AlwaysUnlockedProvider(), scores);
    const created = service.create(sample, attribution);

    expect(() => service.delete(created.id, { confirmDestroysResults: false }, attribution)).toThrow(
      CompetitionDeleteNeedsConfirmationError,
    );
    // Still present — the delete was blocked before appending.
    expect(service.get(created.id)).toBeDefined();

    service.delete(created.id, { confirmDestroysResults: true }, attribution);
    expect(() => service.get(created.id)).toThrow(CompetitionNotFoundError);
  });

  it("AC6: locked → hard block even with the acknowledgment flag", () => {
    const locked: LockStateProvider = { isLocked: () => true };
    const { service } = buildService(locked);
    const created = service.create(sample, attribution);

    expect(() => service.delete(created.id, { confirmDestroysResults: true }, attribution)).toThrow(
      CompetitionLockedError,
    );
    expect(service.get(created.id)).toBeDefined();
  });

  it("locked check precedes the captured-scores check", () => {
    const locked: LockStateProvider = { isLocked: () => true };
    const scores: CapturedScoresProvider = { hasCapturedScores: () => true };
    const { service } = buildService(locked, scores);
    const created = service.create(sample, attribution);

    // Even with the flag set, a locked-with-scores competition reports locked,
    // not needs-confirmation.
    expect(() => service.delete(created.id, { confirmDestroysResults: true }, attribution)).toThrow(
      CompetitionLockedError,
    );
  });

  it("second delete of a tombstoned competition → not found", () => {
    const { service } = buildService();
    const created = service.create(sample, attribution);
    service.delete(created.id, { confirmDestroysResults: false }, attribution);
    expect(() => service.delete(created.id, { confirmDestroysResults: false }, attribution)).toThrow(
      CompetitionNotFoundError,
    );
  });

  it("fails to get / update / delete an unknown id", () => {
    const { service } = buildService();
    expect(() => service.get("missing")).toThrow(CompetitionNotFoundError);
    expect(() => service.update("missing", sample, attribution)).toThrow(CompetitionNotFoundError);
    expect(() => service.delete("missing", { confirmDestroysResults: false }, attribution)).toThrow(
      CompetitionNotFoundError,
    );
  });

  it("rejects an unknown discipline code at the Zod boundary, naming the field", () => {
    const { service } = buildService();
    try {
      service.create({ ...sample, discipline: "X3X" }, attribution);
      throw new Error("expected ValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const details = (error as ValidationError).details as { fieldErrors: Record<string, string[]> };
      expect(details.fieldErrors.discipline).toContain("A discipline is required");
    }
  });

  it("captures entry options and deduped pilot classes on create", () => {
    const { service } = buildService();
    const created = service.create(
      {
        ...sample,
        pilotNumbersEnabled: true,
        pilotClassesEnabled: true,
        pilotClasses: ["Open", " open ", "Sportsman"],
      },
      attribution,
    );
    expect(created.pilotNumbersEnabled).toBe(true);
    expect(created.pilotClassesEnabled).toBe(true);
    expect(created.pilotClasses).toEqual(["Open", "Sportsman"]);
  });

  it("requires ≥1 pilot class when the toggle is on", () => {
    const { service } = buildService();
    expect(() =>
      service.create({ ...sample, pilotClassesEnabled: true, pilotClasses: [] }, attribution),
    ).toThrow(ValidationError);
  });

  it("update resubmitting the same discipline passes even under captured scores", () => {
    const scores: CapturedScoresProvider = { hasCapturedScores: () => true };
    const { service } = buildService(new AlwaysUnlockedProvider(), scores);
    const created = service.create(sample, attribution);

    const updated = service.update(
      created.id,
      { ...sample, name: "Renamed", discipline: "F3J" },
      attribution,
    );
    expect(updated.name).toBe("Renamed");
    expect(updated.discipline).toBe("F3J");
  });

  it("update changing discipline hard-blocks 409 when captured scores exist (no ack flag)", () => {
    const scores: CapturedScoresProvider = { hasCapturedScores: () => true };
    const { service } = buildService(new AlwaysUnlockedProvider(), scores);
    const created = service.create(sample, attribution);

    expect(() =>
      service.update(created.id, { ...sample, discipline: "F5K" }, attribution),
    ).toThrow(CompetitionDisciplineLockedError);
    // Unchanged in the projection — blocked before appending.
    expect(service.get(created.id).discipline).toBe("F3J");
  });

  it("update changing discipline reports locked (locked precedes captured-scores)", () => {
    const locked: LockStateProvider = { isLocked: () => true };
    const scores: CapturedScoresProvider = { hasCapturedScores: () => true };
    const { service } = buildService(locked, scores);
    const created = service.create(sample, attribution);

    expect(() =>
      service.update(created.id, { ...sample, discipline: "F5K" }, attribution),
    ).toThrow(CompetitionLockedError);
  });

  it("changing discipline is free when there are no captured scores", () => {
    const { service } = buildService();
    const created = service.create(sample, attribution);
    const updated = service.update(created.id, { ...sample, discipline: "F5L" }, attribution);
    expect(updated.discipline).toBe("F5L");
  });

  it("created/updated replay carries discipline and entry options", () => {
    const { eventStore, service } = buildService();
    const created = service.create(
      { ...sample, pilotNumbersEnabled: true, pilotClassesEnabled: true, pilotClasses: ["Open"] },
      attribution,
    );
    const updated = service.update(
      created.id,
      { ...sample, name: "Renamed", discipline: "F5J", pilotNumbersEnabled: false },
      attribution,
    );

    const fresh = new CompetitionProjection();
    fresh.rebuild(eventStore.readAll());
    expect(fresh.getById(created.id)).toEqual(updated);
    expect(fresh.getById(created.id)?.discipline).toBe("F5J");
  });

  it("disabling pilot classes via update discards the set (RD4)", () => {
    const { service } = buildService();
    const created = service.create(
      { ...sample, pilotClassesEnabled: true, pilotClasses: ["Open", "Sportsman"] },
      attribution,
    );
    expect(created.pilotClasses).toEqual(["Open", "Sportsman"]);

    const updated = service.update(
      created.id,
      { ...sample, pilotClassesEnabled: false, pilotClasses: ["Open", "Sportsman"] },
      attribution,
    );
    expect(updated.pilotClassesEnabled).toBe(false);
    expect(updated.pilotClasses).toEqual([]);
  });
});
