import { describe, expect, it } from "vitest";
import { stockModelIdFor, type Attribution } from "@soarscore/shared";
import { EventStore } from "../src/eventstore/event-store.js";
import type { EventRecord } from "../src/eventstore/event-store.js";
import { CompetitionProjection } from "../src/competitions/projection.js";
import { ClassModelProjection } from "../src/class-models/projection.js";
import { ClassModelService } from "../src/class-models/service.js";
import {
  AlwaysUnlockedProvider,
  NoScoresYetProvider,
  NotStartedProvider,
  type StartStateProvider,
  ZeroProgressProvider,
} from "../src/competitions/state-providers.js";
import { CompetitionService } from "../src/competitions/service.js";
import {
  CompetitionNotFoundError,
  CompetitionNotReadyError,
} from "../src/competitions/errors.js";
import { RosterProjection } from "../src/roster/projection.js";
import { DrawProjection } from "../src/draw/projection.js";
import { LifecycleProjection } from "../src/lifecycle/projection.js";
import { LifecycleGuard } from "../src/lifecycle/guard.js";
import { TransitionNotAllowedError } from "../src/lifecycle/errors.js";
import { CompetitionTaskConfigProjection } from "../src/task-config/projection.js";
import { CompetitionTaskConfigService } from "../src/task-config/service.js";

const attribution: Attribution = {
  actorName: "tester",
  originClient: "test-client",
  authority: "organiser",
};
const cdAttribution: Attribution = {
  actorName: "cd",
  originClient: "cd-client",
  authority: "contest-director",
};
const F3J = stockModelIdFor("F3J");
const sample = { name: "Spring Cup", date: "2026-09-12", venue: "Rotorua", classModelId: F3J };

// Read-only draw stub so the injected LifecycleProjection can be driven to any
// readiness rung without wiring the real draw pipeline (mirrors
// lifecycle.projection.test.ts).
interface DrawState {
  spec?: boolean;
  candidate?: boolean;
  accepted?: boolean;
}
function stubProjections(rosterSize: number, draw: DrawState = {}) {
  const rosterProjection = {
    getRoster: () => Array.from({ length: rosterSize }, (_, i) => ({ id: `e${i}` })),
  } as unknown as RosterProjection;
  const drawProjection = {
    getSpec: () => (draw.spec ? ({} as never) : undefined),
    getCandidate: () => (draw.candidate ? ({} as never) : undefined),
    hasAccepted: () => draw.accepted === true,
  } as unknown as DrawProjection;
  return { rosterProjection, drawProjection };
}

function build(rosterSize: number, draw: DrawState = {}) {
  const eventStore = new EventStore(":memory:");
  const classModelProjection = new ClassModelProjection();
  new ClassModelService(eventStore, classModelProjection, {
    getReferencingCompetitions: () => [],
  }).seedStockModels();
  const competitionProjection = new CompetitionProjection();
  const { rosterProjection, drawProjection } = stubProjections(rosterSize, draw);
  const lifecycleProjection = new LifecycleProjection(rosterProjection, drawProjection);
  const service = new CompetitionService(
    eventStore,
    competitionProjection,
    classModelProjection,
    new AlwaysUnlockedProvider(),
    new NoScoresYetProvider(),
    lifecycleProjection,
    new LifecycleGuard(),
    new ZeroProgressProvider(),
  );
  const created = service.create(sample, attribution);
  competitionProjection.rebuild(eventStore.readAll());
  return { eventStore, service, lifecycleProjection, id: created.id };
}

let seq = 0;
function record(scope: string, type: string, competitionId: string): EventRecord {
  seq += 1;
  return {
    seq,
    timestamp: new Date().toISOString(),
    scope,
    type,
    payload: { competitionId },
    attribution,
  };
}

describe("CompetitionService.start — Start Proceedings (STORY-001-025)", () => {
  it("AC1: from Setup/DrawAccepted transitions to Running/BetweenGroups with one CD-authority event", () => {
    const { service, id, eventStore } = build(1, { accepted: true });
    const before = eventStore.readAll().length;

    const result = service.start(id, cdAttribution);

    expect(result).toEqual({
      state: "Running",
      subState: "BetweenGroups",
      admissibleActions: expect.arrayContaining(["Lock", "RoundAdvance", "Suspend"]),
    });
    const appended = eventStore.readAll().slice(before);
    expect(appended).toHaveLength(1);
    expect(appended[0].type).toBe("competition.started");
    expect(appended[0].payload).toEqual({ competitionId: id });
    expect(appended[0].attribution.authority).toBe("contest-director");
  });

  it("AC2: from Setup/Draft blocks with COMPETITION_NOT_READY listing BOTH prerequisites, appends nothing", () => {
    const { service, id, eventStore } = build(0);
    const before = eventStore.readAll().length;

    try {
      service.start(id, cdAttribution);
      throw new Error("expected CompetitionNotReadyError");
    } catch (error) {
      expect(error).toBeInstanceOf(CompetitionNotReadyError);
      const e = error as CompetitionNotReadyError;
      expect(e.code).toBe("COMPETITION_NOT_READY");
      expect(e.outstandingItems.map((i) => i.code)).toEqual([
        "ROSTER_INCOMPLETE",
        "DRAW_NOT_ACCEPTED",
      ]);
    }
    expect(eventStore.readAll().length).toBe(before);
  });

  it("AC3: from Setup/DrawGenerated blocks with DRAW_NOT_ACCEPTED alone", () => {
    const { service, id, lifecycleProjection } = build(1, { spec: true, candidate: true });
    lifecycleProjection.apply(record(id, "roster.entryAdded", id));
    lifecycleProjection.apply(record(id, "draw.specSaved", id));
    lifecycleProjection.apply(record(id, "draw.generated", id));

    try {
      service.start(id, cdAttribution);
      throw new Error("expected CompetitionNotReadyError");
    } catch (error) {
      const e = error as CompetitionNotReadyError;
      expect(e.outstandingItems.map((i) => i.code)).toEqual(["DRAW_NOT_ACCEPTED"]);
    }
  });

  it("AC7: a second start from Running is rejected with TransitionNotAllowedError and appends nothing", () => {
    const { service, id, eventStore } = build(1, { accepted: true });
    service.start(id, cdAttribution);
    const before = eventStore.readAll().length;

    expect(() => service.start(id, cdAttribution)).toThrow(TransitionNotAllowedError);
    expect(eventStore.readAll().length).toBe(before);
  });

  it("AC7: start from Suspended / Locked / Deleted is rejected", () => {
    const { service, id, lifecycleProjection } = build(1, { accepted: true });

    lifecycleProjection.apply(record("competitions", "competition.started", id));
    lifecycleProjection.apply(record("competitions", "competition.suspended", id));
    expect(() => service.start(id, cdAttribution)).toThrow(TransitionNotAllowedError);

    lifecycleProjection.apply(record("competitions", "competition.locked", id));
    expect(() => service.start(id, cdAttribution)).toThrow(TransitionNotAllowedError);

    lifecycleProjection.apply(record("competitions", "competition.deleted", id));
    expect(() => service.start(id, cdAttribution)).toThrow(TransitionNotAllowedError);
  });

  it("a never-existed id is 404 (CompetitionNotFoundError)", () => {
    const { service } = build(1, { accepted: true });
    expect(() => service.start("nope", cdAttribution)).toThrow(CompetitionNotFoundError);
  });
});

describe("Config-authority boundary — task-config record-only (STORY-001-025, AC6)", () => {
  function buildTaskConfig(startState: StartStateProvider) {
    const eventStore = new EventStore(":memory:");
    const classModelProjection = new ClassModelProjection();
    new ClassModelService(eventStore, classModelProjection, {
      getReferencingCompetitions: () => [],
    }).seedStockModels();
    const competitionProjection = new CompetitionProjection();
    const competitionService = new CompetitionService(
      eventStore,
      competitionProjection,
      classModelProjection,
      new AlwaysUnlockedProvider(),
      new NoScoresYetProvider(),
      new LifecycleProjection(new RosterProjection(), new DrawProjection()),
      new LifecycleGuard(),
      new ZeroProgressProvider(),
    );
    const taskConfigProjection = new CompetitionTaskConfigProjection();
    const service = new CompetitionTaskConfigService(
      eventStore,
      taskConfigProjection,
      competitionProjection,
      classModelProjection,
      startState,
    );
    const comp = competitionService.create(
      { name: "F3K Cup", date: "2026-09-12", venue: "Rotorua", classModelId: stockModelIdFor("F3K") },
      attribution,
    );
    const taskId = `${stockModelIdFor("F3K")}-task`;
    return { eventStore, service, id: comp.id, taskId };
  }

  function lastTaskConfigAuthority(eventStore: EventStore): string | undefined {
    const events = eventStore.readAll().filter((e) => e.type === "taskConfig.updated");
    return events.at(-1)?.attribution.authority;
  }

  it("before Start: keeps the route-supplied organiser attribution", () => {
    const { eventStore, service, id, taskId } = buildTaskConfig(new NotStartedProvider());
    service.update(id, { tasks: [{ taskId, baseTargetSeconds: 600, roundOverrides: {} }] }, attribution);
    expect(lastTaskConfigAuthority(eventStore)).toBe("organiser");
  });

  it("past Start: stamps contest-director authority on the identical edit; rejects nothing", () => {
    const alwaysStarted: StartStateProvider = { isStarted: () => true };
    const { eventStore, service, id, taskId } = buildTaskConfig(alwaysStarted);
    // Same organiser-attributed call as above — the only difference is the boundary.
    const result = service.update(
      id,
      { tasks: [{ taskId, baseTargetSeconds: 600, roundOverrides: {} }] },
      attribution,
    );
    expect(result).toBeDefined(); // not rejected
    expect(lastTaskConfigAuthority(eventStore)).toBe("contest-director");
  });
});
