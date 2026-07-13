import { describe, expect, it } from "vitest";
import { stockModelIdFor, type Attribution } from "@soarscore/shared";
import { EventStore } from "../src/eventstore/event-store.js";
import { CompetitionProjection } from "../src/competitions/projection.js";
import { ClassModelProjection } from "../src/class-models/projection.js";
import { ClassModelService } from "../src/class-models/service.js";
import {
  AlwaysUnlockedProvider,
  NoScoresYetProvider,
} from "../src/competitions/state-providers.js";
import { CompetitionService } from "../src/competitions/service.js";
import { CompetitionNotFoundError } from "../src/competitions/errors.js";
import { RosterProjection } from "../src/roster/projection.js";
import { DrawProjection } from "../src/draw/projection.js";
import { LifecycleProjection } from "../src/lifecycle/projection.js";
import { LifecycleGuard } from "../src/lifecycle/guard.js";
import { TransitionNotAllowedError } from "../src/lifecycle/errors.js";

const attribution: Attribution = { actorName: "tester", originClient: "test-client", authority: "organiser" };
const F3J = stockModelIdFor("F3J");
const sample = { name: "Spring Cup", date: "2026-09-12", venue: "Rotorua", classModelId: F3J };

function build() {
  const eventStore = new EventStore(":memory:");
  const classModelProjection = new ClassModelProjection();
  new ClassModelService(eventStore, classModelProjection, {
    getReferencingCompetitions: () => [],
  }).seedStockModels();
  const competitionProjection = new CompetitionProjection();
  const rosterProjection = new RosterProjection();
  const drawProjection = new DrawProjection();
  const lifecycleProjection = new LifecycleProjection(rosterProjection, drawProjection);
  const service = new CompetitionService(
    eventStore,
    competitionProjection,
    classModelProjection,
    new AlwaysUnlockedProvider(),
    new NoScoresYetProvider(),
    lifecycleProjection,
    new LifecycleGuard(),
  );
  // Rebuild the projection from the log on each append, mirroring the app's
  // append-stream feed (kept simple here for the seeded lifecycle facts).
  function seedLifecycle(type: string, competitionId: string): void {
    eventStore.append({ scope: "competitions", type, payload: { competitionId }, attribution });
    lifecycleProjection.rebuild(eventStore.readAll());
  }
  return { eventStore, competitionProjection, lifecycleProjection, service, seedLifecycle };
}

describe("CompetitionService delete — routed through the authoritative guard", () => {
  it("AC4: admits Delete from Setup (unchanged STORY-001-003 behaviour)", () => {
    const { service } = build();
    const created = service.create(sample, attribution);
    service.delete(created.id, { confirmDestroysResults: false }, attribution);
    expect(() => service.get(created.id)).toThrow(CompetitionNotFoundError);
  });

  it("AC4/AC7: rejects Delete from Running with TransitionNotAllowedError and appends nothing", () => {
    const { service, eventStore, seedLifecycle } = build();
    const created = service.create(sample, attribution);
    seedLifecycle("competition.started", created.id);

    const before = eventStore.readAll().length;
    expect(() => service.delete(created.id, { confirmDestroysResults: true }, attribution)).toThrow(
      TransitionNotAllowedError,
    );
    // No state change: the competition survives and no event was appended.
    expect(service.get(created.id)).toBeDefined();
    expect(eventStore.readAll().length).toBe(before);
  });

  it("rejects Delete from Suspended and from (event-)Locked", () => {
    const { service, seedLifecycle } = build();
    const suspendedComp = service.create(sample, attribution);
    seedLifecycle("competition.started", suspendedComp.id);
    seedLifecycle("competition.suspended", suspendedComp.id);
    expect(() => service.delete(suspendedComp.id, { confirmDestroysResults: false }, attribution)).toThrow(
      TransitionNotAllowedError,
    );

    const lockedComp = service.create(sample, attribution);
    seedLifecycle("competition.started", lockedComp.id);
    seedLifecycle("competition.locked", lockedComp.id);
    expect(() => service.delete(lockedComp.id, { confirmDestroysResults: false }, attribution)).toThrow(
      TransitionNotAllowedError,
    );
  });
});

describe("CompetitionService.getLifecycleState", () => {
  it("reports Setup with admissible Delete for a fresh competition", () => {
    const { service } = build();
    const created = service.create(sample, attribution);
    expect(service.getLifecycleState(created.id)).toEqual({
      state: "Setup",
      subState: "Draft",
      admissibleActions: ["Delete"],
    });
  });

  it("a deleted competition still reports Deleted (200), not not-found (observability)", () => {
    const { service, eventStore, lifecycleProjection } = build();
    const created = service.create(sample, attribution);
    service.delete(created.id, { confirmDestroysResults: false }, attribution);
    // In the app the append-stream hook feeds the lifecycle projection; here we
    // re-derive it from the log so the retained Deleted tombstone is observable
    // even though CompetitionProjection has dropped the row.
    lifecycleProjection.rebuild(eventStore.readAll());
    expect(service.getLifecycleState(created.id)).toEqual({
      state: "Deleted",
      subState: null,
      admissibleActions: [],
    });
  });

  it("a never-existed id is 404 (CompetitionNotFoundError)", () => {
    const { service } = build();
    expect(() => service.getLifecycleState("nope")).toThrow(CompetitionNotFoundError);
  });
});
