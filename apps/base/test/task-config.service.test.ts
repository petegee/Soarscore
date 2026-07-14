import { describe, expect, it } from "vitest";
import { stockModelIdFor } from "@soarscore/shared";
import { EventStore } from "../src/eventstore/event-store.js";
import { CompetitionProjection } from "../src/competitions/projection.js";
import { ClassModelProjection } from "../src/class-models/projection.js";
import { ClassModelService } from "../src/class-models/service.js";
import {
  AlwaysUnlockedProvider,
  NoScoresYetProvider,
  NotStartedProvider,
} from "../src/competitions/state-providers.js";
import { CompetitionService } from "../src/competitions/service.js";
import { RosterProjection } from "../src/roster/projection.js";
import { DrawProjection } from "../src/draw/projection.js";
import { LifecycleProjection } from "../src/lifecycle/projection.js";
import { LifecycleGuard } from "../src/lifecycle/guard.js";
import { CompetitionTaskConfigProjection } from "../src/task-config/projection.js";
import { CompetitionTaskConfigService } from "../src/task-config/service.js";
import {
  CompetitionTaskConfigNotFoundError,
  NlhNotApplicableError,
  PerRoundOverrideNotAllowedError,
  TaskNotFoundError,
  ValidationError,
} from "../src/task-config/errors.js";

const attribution = { actorName: "tester", originClient: "test-client", authority: "organiser" };

// Build the full slice: seeded models + a competition service to create a
// competition + the task-config service under test, all sharing one store.
function build() {
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
  );
  const taskConfigProjection = new CompetitionTaskConfigProjection();
  const service = new CompetitionTaskConfigService(
    eventStore,
    taskConfigProjection,
    competitionProjection,
    classModelProjection,
    new NotStartedProvider(),
  );
  const makeCompetition = (classModelId: string) =>
    competitionService.create(
      { name: `Comp ${classModelId}`, date: "2026-09-12", venue: "Rotorua", classModelId },
      attribution,
    );
  return { eventStore, service, taskConfigProjection, makeCompetition };
}

describe("CompetitionTaskConfigService", () => {
  it("404s for an unknown competition", () => {
    const { service } = build();
    expect(() => service.get("nope")).toThrow(CompetitionTaskConfigNotFoundError);
  });

  it("GET before any save returns model-default entries (one per task, no overrides)", () => {
    const { service, makeCompetition } = build();
    const comp = makeCompetition(stockModelIdFor("F3B"));
    const view = service.get(comp.id);
    expect(view.tasks).toHaveLength(3); // F3B: Duration / Distance / Speed
    expect(view.tasks.every((t) => t.baseTargetSeconds === null)).toBe(true);
    expect(view.tasks.every((t) => Object.keys(t.roundOverrides).length === 0)).toBe(true);
    expect(view.nlhValue).toBeNull();
  });

  it("AC1: accepts a per-round override for F3K (the only class that permits it)", () => {
    const { service, makeCompetition, eventStore, taskConfigProjection } = build();
    const comp = makeCompetition(stockModelIdFor("F3K"));
    const taskId = `${stockModelIdFor("F3K")}-task`;

    const saved = service.update(
      comp.id,
      { tasks: [{ taskId, baseTargetSeconds: 600, roundOverrides: { 5: 420 } }] },
      attribution,
    );
    const entry = saved.tasks.find((t) => t.taskId === taskId);
    expect(entry?.baseTargetSeconds).toBe(600);
    expect(entry?.roundOverrides).toEqual({ 5: 420 });

    // Rebuildable from the log (audit/replay parity), filed under the competition.
    const fresh = new CompetitionTaskConfigProjection();
    fresh.rebuild(eventStore.readAll());
    expect(fresh.getConfig(comp.id)).toEqual(taskConfigProjection.getConfig(comp.id));
  });

  it("AC1: rejects a per-round override for a rule-fixed class (F5J)", () => {
    const { service, makeCompetition } = build();
    const comp = makeCompetition(stockModelIdFor("F5J"));
    const taskId = `${stockModelIdFor("F5J")}-task`;
    expect(() =>
      service.update(
        comp.id,
        { tasks: [{ taskId, baseTargetSeconds: 600, roundOverrides: { 5: 500 } }] },
        attribution,
      ),
    ).toThrow(PerRoundOverrideNotAllowedError);
  });

  it("rejects an override for a taskId absent from the class model", () => {
    const { service, makeCompetition } = build();
    const comp = makeCompetition(stockModelIdFor("F3K"));
    expect(() =>
      service.update(
        comp.id,
        { tasks: [{ taskId: "not-a-task", baseTargetSeconds: 600, roundOverrides: {} }] },
        attribution,
      ),
    ).toThrow(TaskNotFoundError);
  });

  it("AC6: accepts the NLH value for F5K and rejects it for a non-NLH class", () => {
    const { service, makeCompetition } = build();
    const f5k = makeCompetition(stockModelIdFor("F5K"));
    const savedF5k = service.update(f5k.id, { tasks: [], nlhValue: 70 }, attribution);
    expect(savedF5k.nlhValue).toBe(70);

    const f3j = makeCompetition(stockModelIdFor("F3J"));
    expect(() => service.update(f3j.id, { tasks: [], nlhValue: 60 }, attribution)).toThrow(
      NlhNotApplicableError,
    );
  });

  it("AC6: NLH is optional at save — an unset value is accepted, not demanded", () => {
    const { service, makeCompetition } = build();
    const f5k = makeCompetition(stockModelIdFor("F5K"));
    const saved = service.update(f5k.id, { tasks: [] }, attribution);
    expect(saved.nlhValue).toBeNull();
  });

  it("tolerates overrides for rounds that do not exist yet (no crash, no phantom round)", () => {
    const { service, makeCompetition } = build();
    const comp = makeCompetition(stockModelIdFor("F3K"));
    const taskId = `${stockModelIdFor("F3K")}-task`;
    const saved = service.update(
      comp.id,
      { tasks: [{ taskId, baseTargetSeconds: 600, roundOverrides: { 99: 300 } }] },
      attribution,
    );
    expect(saved.tasks.find((t) => t.taskId === taskId)?.roundOverrides).toEqual({ 99: 300 });
  });

  it("rejects a non-integer round key structurally", () => {
    const { service, makeCompetition } = build();
    const comp = makeCompetition(stockModelIdFor("F3K"));
    const taskId = `${stockModelIdFor("F3K")}-task`;
    expect(() =>
      service.update(
        comp.id,
        { tasks: [{ taskId, baseTargetSeconds: 600, roundOverrides: { "1.5": 300 } }] },
        attribution,
      ),
    ).toThrow(ValidationError);
  });

  it("re-saving overwrites the overlay and keeps its id stable", () => {
    const { service, makeCompetition } = build();
    const comp = makeCompetition(stockModelIdFor("F3K"));
    const taskId = `${stockModelIdFor("F3K")}-task`;
    const first = service.update(
      comp.id,
      { tasks: [{ taskId, baseTargetSeconds: 600, roundOverrides: { 5: 420 } }] },
      attribution,
    );
    const second = service.update(
      comp.id,
      { tasks: [{ taskId, baseTargetSeconds: 500, roundOverrides: {} }] },
      attribution,
    );
    expect(second.id).toBe(first.id);
    expect(second.tasks.find((t) => t.taskId === taskId)?.baseTargetSeconds).toBe(500);
    expect(second.tasks.find((t) => t.taskId === taskId)?.roundOverrides).toEqual({});
  });
});
