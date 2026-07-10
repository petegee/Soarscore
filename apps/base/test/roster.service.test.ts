import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { stockModelIdFor, type Attribution, type Competition } from "@soarscore/shared";
import { EventStore } from "../src/eventstore/event-store.js";
import { PilotLibraryProjection } from "../src/pilots/projection.js";
import { CompetitionProjection } from "../src/competitions/projection.js";
import { RosterProjection } from "../src/roster/projection.js";
import {
  NoAcceptedDrawProvider,
  NoEntryScoresYetProvider,
  NothingRetiredProvider,
  type DrawStateProvider,
  type EntryScoresProvider,
  type RetirementStateProvider,
} from "../src/roster/state-providers.js";
import { RosterService } from "../src/roster/service.js";
import {
  DuplicateRosterEntryError,
  RosterEntryHasFlownError,
  RosterEntryNotFoundError,
  RosterEntryRetiredError,
  RosterRemoveRequiresReplacementError,
  RosterReplaceNeedsConfirmationError,
  ValidationError,
} from "../src/roster/errors.js";
import { CompetitionNotFoundError } from "../src/competitions/errors.js";
import { NotFoundError } from "../src/pilots/errors.js";

const attribution: Attribution = {
  actorName: "tester",
  originClient: "test-client",
  authority: "organiser",
};

const acceptedDraw: DrawStateProvider = { hasAcceptedDraw: () => true };

function setup(overrides?: {
  draw?: DrawStateProvider;
  retirement?: RetirementStateProvider;
  scores?: EntryScoresProvider;
}) {
  const eventStore = new EventStore(":memory:");
  const pilotProjection = new PilotLibraryProjection();
  const competitionProjection = new CompetitionProjection();
  const rosterProjection = new RosterProjection();
  const service = new RosterService(
    eventStore,
    rosterProjection,
    competitionProjection,
    pilotProjection,
    overrides?.draw ?? new NoAcceptedDrawProvider(),
    overrides?.retirement ?? new NothingRetiredProvider(),
    overrides?.scores ?? new NoEntryScoresYetProvider(),
  );

  function addCompetition(fields?: Partial<Competition>): Competition {
    const competition: Competition = {
      id: crypto.randomUUID(),
      name: "Spring Cup",
      date: "2026-09-12",
      venue: null,
      classModelId: stockModelIdFor("F3J"),
      pilotNumbersEnabled: false,
      pilotClassesEnabled: false,
      pilotClasses: [],
      ...fields,
    };
    const record = eventStore.append({
      scope: "competitions",
      type: "competition.created",
      payload: competition,
      attribution,
    });
    competitionProjection.apply(record);
    return competition;
  }

  function addPilot(name: string): string {
    const id = crypto.randomUUID();
    const record = eventStore.append({
      scope: "master-data",
      type: "pilot.created",
      payload: { id, name, registrationId: null, club: null, contact: null },
      attribution,
    });
    pilotProjection.apply(record);
    return id;
  }

  return {
    eventStore,
    rosterProjection,
    competitionProjection,
    service,
    addCompetition,
    addPilot,
  };
}

describe("RosterService", () => {
  it("AC1: adds a pilot by reference, materialising attributes per the toggles", () => {
    const { service, addCompetition, addPilot } = setup();
    const competition = addCompetition({
      pilotNumbersEnabled: true,
      pilotClassesEnabled: true,
      pilotClasses: ["Open", "Sportsman"],
    });
    const pilotId = addPilot("Alice");

    const entry = service.add(
      competition.id,
      { pilotId, pilotClass: "Open" },
      attribution,
    );
    expect(entry.pilotId).toBe(pilotId);
    expect(entry.pilotName).toBe("Alice");
    expect(entry.pilotNumber).toBe(1);
    expect(entry.pilotClass).toBe("Open");
    expect(entry.retired).toBe(false);
    expect(entry.id).not.toBe(pilotId);
  });

  it("materialises no attributes when both options are off", () => {
    const { service, addCompetition, addPilot } = setup();
    const competition = addCompetition();
    const entry = service.add(competition.id, { pilotId: addPilot("Alice") }, attribution);
    expect(entry.pilotNumber).toBeNull();
    expect(entry.pilotClass).toBeNull();
  });

  it("RD5: auto-assigns the lowest free number and refuses a collision", () => {
    const { service, addCompetition, addPilot } = setup();
    const competition = addCompetition({ pilotNumbersEnabled: true });
    const first = service.add(competition.id, { pilotId: addPilot("A") }, attribution);
    const second = service.add(
      competition.id,
      { pilotId: addPilot("B"), pilotNumber: 5 },
      attribution,
    );
    expect(first.pilotNumber).toBe(1);
    expect(second.pilotNumber).toBe(5);
    // Lowest free is 2, not 6.
    const third = service.add(competition.id, { pilotId: addPilot("C") }, attribution);
    expect(third.pilotNumber).toBe(2);

    try {
      service.add(competition.id, { pilotId: addPilot("D"), pilotNumber: 5 }, attribution);
      throw new Error("expected ValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const details = (error as ValidationError).details as {
        fieldErrors: Record<string, string[]>;
      };
      expect(details.fieldErrors.pilotNumber).toBeDefined();
    }
  });

  it("refuses a provided number when the option is off, naming the field", () => {
    const { service, addCompetition, addPilot } = setup();
    const competition = addCompetition();
    try {
      service.add(competition.id, { pilotId: addPilot("A"), pilotNumber: 3 }, attribution);
      throw new Error("expected ValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const details = (error as ValidationError).details as {
        fieldErrors: Record<string, string[]>;
      };
      expect(details.fieldErrors.pilotNumber).toContain(
        "Pilot numbers are not enabled for this competition",
      );
    }
  });

  it("RD6: class is required when on, must be in the set, and stores canonical casing", () => {
    const { service, addCompetition, addPilot } = setup();
    const competition = addCompetition({
      pilotClassesEnabled: true,
      pilotClasses: ["Open", "Sportsman"],
    });

    expect(() => service.add(competition.id, { pilotId: addPilot("A") }, attribution)).toThrow(
      ValidationError,
    );
    expect(() =>
      service.add(competition.id, { pilotId: addPilot("B"), pilotClass: "Novice" }, attribution),
    ).toThrow(ValidationError);

    const entry = service.add(
      competition.id,
      { pilotId: addPilot("C"), pilotClass: "  open " },
      attribution,
    );
    expect(entry.pilotClass).toBe("Open");
  });

  it("RD6: refuses a class when the option is off", () => {
    const { service, addCompetition, addPilot } = setup();
    const competition = addCompetition();
    expect(() =>
      service.add(competition.id, { pilotId: addPilot("A"), pilotClass: "Open" }, attribution),
    ).toThrow(ValidationError);
  });

  it("refuses a duplicate add — one seat per pilot per roster", () => {
    const { service, addCompetition, addPilot } = setup();
    const competition = addCompetition();
    const pilotId = addPilot("Alice");
    service.add(competition.id, { pilotId }, attribution);
    expect(() => service.add(competition.id, { pilotId }, attribution)).toThrow(
      DuplicateRosterEntryError,
    );
  });

  it("refuses an unknown competition or pilot", () => {
    const { service, addCompetition, addPilot } = setup();
    const competition = addCompetition();
    addPilot("Alice");
    expect(() => service.add("missing", { pilotId: "x" }, attribution)).toThrow(
      CompetitionNotFoundError,
    );
    expect(() => service.add(competition.id, { pilotId: "missing" }, attribution)).toThrow(
      NotFoundError,
    );
    expect(() => service.list("missing")).toThrow(CompetitionNotFoundError);
  });

  it("AC2: update edits this entry only and appends no pilot.* event", () => {
    const { eventStore, service, addCompetition, addPilot } = setup();
    const compA = addCompetition({ name: "A", pilotNumbersEnabled: true });
    const compB = addCompetition({ name: "B", pilotNumbersEnabled: true });
    const pilotId = addPilot("Alice");
    const entryA = service.add(compA.id, { pilotId }, attribution);
    const entryB = service.add(compB.id, { pilotId }, attribution);

    const updated = service.update(compA.id, entryA.id, { pilotNumber: 7 }, attribution);
    expect(updated.id).toBe(entryA.id);
    expect(updated.pilotNumber).toBe(7);

    // Same pilot's entry in the other competition is untouched (AC2).
    expect(service.list(compB.id)[0]).toMatchObject({ id: entryB.id, pilotNumber: 1 });
    // Isolation is structural: no pilot.* or competition.* event was appended.
    const types = eventStore.readAll().map((record) => record.type);
    expect(types.filter((t) => t.startsWith("pilot."))).toEqual([
      "pilot.created",
    ]);
    expect(types.filter((t) => t === "competition.updated")).toEqual([]);
  });

  it("update excludes the entry's own number from the uniqueness check", () => {
    const { service, addCompetition, addPilot } = setup();
    const competition = addCompetition({ pilotNumbersEnabled: true });
    const entry = service.add(
      competition.id,
      { pilotId: addPilot("A"), pilotNumber: 3 },
      attribution,
    );
    const updated = service.update(competition.id, entry.id, { pilotNumber: 3 }, attribution);
    expect(updated.pilotNumber).toBe(3);
  });

  it("AC3: add and remove are free and warning-free while no accepted draw exists", () => {
    const { service, addCompetition, addPilot } = setup();
    const competition = addCompetition();
    const entry = service.add(competition.id, { pilotId: addPilot("Alice") }, attribution);
    service.remove(competition.id, entry.id, attribution);
    expect(service.list(competition.id)).toEqual([]);
  });

  it("AC4: remove under an accepted draw → 409 requires-replacement", () => {
    const { service, addCompetition, addPilot } = setup({ draw: acceptedDraw });
    const competition = addCompetition();
    const entry = service.add(competition.id, { pilotId: addPilot("Alice") }, attribution);
    expect(() => service.remove(competition.id, entry.id, attribution)).toThrow(
      RosterRemoveRequiresReplacementError,
    );
    expect(service.list(competition.id)).toHaveLength(1);
  });

  it("AC4: replace without the flag warns; with it, same entry id inherits, prior occupant logged", () => {
    const { eventStore, service, addCompetition, addPilot } = setup({ draw: acceptedDraw });
    const competition = addCompetition();
    const alice = addPilot("Alice");
    const bob = addPilot("Bob");
    const entry = service.add(competition.id, { pilotId: alice }, attribution);

    expect(() =>
      service.replace(competition.id, entry.id, { pilotId: bob }, attribution),
    ).toThrow(RosterReplaceNeedsConfirmationError);

    const result = service.replace(
      competition.id,
      entry.id,
      { pilotId: bob, confirmDrawAffected: true },
      attribution,
    );
    expect(result.drawAffected).toBe(true);
    expect(result.entry.id).toBe(entry.id);
    expect(result.entry.pilotId).toBe(bob);
    expect(result.entry.pilotName).toBe("Bob");

    const replaced = eventStore.readAll().find((r) => r.type === "roster.entryReplaced");
    expect(replaced?.payload).toMatchObject({
      rosterEntryId: entry.id,
      previousPilotId: alice,
      pilotId: bob,
    });
  });

  it("replace is confirmation-free when no accepted draw exists", () => {
    const { service, addCompetition, addPilot } = setup();
    const competition = addCompetition();
    const entry = service.add(competition.id, { pilotId: addPilot("Alice") }, attribution);
    const result = service.replace(
      competition.id,
      entry.id,
      { pilotId: addPilot("Bob") },
      attribution,
    );
    expect(result.drawAffected).toBe(false);
  });

  it("replace keeps the seat's number and class unchanged", () => {
    const { service, addCompetition, addPilot } = setup();
    const competition = addCompetition({
      pilotNumbersEnabled: true,
      pilotClassesEnabled: true,
      pilotClasses: ["Open"],
    });
    const entry = service.add(
      competition.id,
      { pilotId: addPilot("Alice"), pilotNumber: 4, pilotClass: "Open" },
      attribution,
    );
    const result = service.replace(
      competition.id,
      entry.id,
      { pilotId: addPilot("Bob") },
      attribution,
    );
    expect(result.entry.pilotNumber).toBe(4);
    expect(result.entry.pilotClass).toBe("Open");
  });

  it("refuses replacing with an already-rostered pilot or the current occupant", () => {
    const { service, addCompetition, addPilot } = setup();
    const competition = addCompetition();
    const alice = addPilot("Alice");
    const bob = addPilot("Bob");
    const entry = service.add(competition.id, { pilotId: alice }, attribution);
    service.add(competition.id, { pilotId: bob }, attribution);

    expect(() =>
      service.replace(competition.id, entry.id, { pilotId: bob }, attribution),
    ).toThrow(DuplicateRosterEntryError);
    expect(() =>
      service.replace(competition.id, entry.id, { pilotId: alice }, attribution),
    ).toThrow(DuplicateRosterEntryError);
  });

  it("replace on a flown seat hard-blocks even with the flag — points never transfer", () => {
    const { service, addCompetition, addPilot } = setup({
      draw: acceptedDraw,
      scores: { hasCapturedScores: () => true },
    });
    const competition = addCompetition();
    const entry = service.add(competition.id, { pilotId: addPilot("Alice") }, attribution);
    expect(() =>
      service.replace(
        competition.id,
        entry.id,
        { pilotId: addPilot("Bob"), confirmDrawAffected: true },
        attribution,
      ),
    ).toThrow(RosterEntryHasFlownError);
  });

  it("AC5: a retired entry is flagged in list and refuses update/remove/replace", () => {
    const retiredIds = new Set<string>();
    const { service, addCompetition, addPilot } = setup({
      retirement: { getRetiredEntryIds: () => retiredIds },
    });
    const competition = addCompetition();
    const bob = addPilot("Bob");
    const entry = service.add(competition.id, { pilotId: addPilot("Alice") }, attribution);

    retiredIds.add(entry.id);
    expect(service.list(competition.id)[0].retired).toBe(true);
    expect(() => service.update(competition.id, entry.id, {}, attribution)).toThrow(
      RosterEntryRetiredError,
    );
    expect(() => service.remove(competition.id, entry.id, attribution)).toThrow(
      RosterEntryRetiredError,
    );
    expect(() =>
      service.replace(competition.id, entry.id, { pilotId: bob }, attribution),
    ).toThrow(RosterEntryRetiredError);
  });

  it("removed then re-added pilot gets a new entry id (new seat)", () => {
    const { service, addCompetition, addPilot } = setup();
    const competition = addCompetition();
    const pilotId = addPilot("Alice");
    const first = service.add(competition.id, { pilotId }, attribution);
    service.remove(competition.id, first.id, attribution);
    const second = service.add(competition.id, { pilotId }, attribution);
    expect(second.id).not.toBe(first.id);
  });

  it("update/remove/replace on an unknown entry → not found", () => {
    const { service, addCompetition } = setup();
    const competition = addCompetition();
    expect(() => service.update(competition.id, "missing", {}, attribution)).toThrow(
      RosterEntryNotFoundError,
    );
    expect(() => service.remove(competition.id, "missing", attribution)).toThrow(
      RosterEntryNotFoundError,
    );
    expect(() =>
      service.replace(competition.id, "missing", { pilotId: "x" }, attribution),
    ).toThrow(RosterEntryNotFoundError);
  });

  it("surfaces stored attributes as null after the option is later disabled", () => {
    const { eventStore, competitionProjection, service, addCompetition, addPilot } = setup();
    const competition = addCompetition({ pilotNumbersEnabled: true });
    service.add(competition.id, { pilotId: addPilot("Alice"), pilotNumber: 2 }, attribution);

    // Disable numbers via a competition.updated event (whole-aggregate update);
    // the service reads the live projection, so the view reconciles at once.
    const record = eventStore.append({
      scope: "competitions",
      type: "competition.updated",
      payload: { ...competition, pilotNumbersEnabled: false },
      attribution,
    });
    competitionProjection.apply(record);

    expect(service.list(competition.id)[0].pilotNumber).toBeNull();
  });

  it("list sorts by pilot number (nulls last) then name", () => {
    const { service, addCompetition, addPilot } = setup();
    const competition = addCompetition({ pilotNumbersEnabled: true });
    service.add(competition.id, { pilotId: addPilot("Zoe"), pilotNumber: 1 }, attribution);
    service.add(competition.id, { pilotId: addPilot("Adam"), pilotNumber: 3 }, attribution);
    service.add(competition.id, { pilotId: addPilot("Mia"), pilotNumber: 2 }, attribution);
    const names = service.list(competition.id).map((e) => e.pilotName);
    expect(names).toEqual(["Zoe", "Mia", "Adam"]);
  });
});
