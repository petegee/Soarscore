import { describe, expect, it } from "vitest";
import { stockModelIdFor, type Attribution } from "@soarscore/shared";
import { EventStore } from "../src/eventstore/event-store.js";
import type { EventRecord } from "../src/eventstore/event-store.js";
import { CompetitionProjection } from "../src/competitions/projection.js";
import { ClassModelProjection } from "../src/class-models/projection.js";
import { ClassModelService } from "../src/class-models/service.js";
import {
  NoScoresYetProvider,
  ProjectionLockStateProvider,
  ZeroProgressProvider,
  type FinalisationProgressProvider,
} from "../src/competitions/state-providers.js";
import { CompetitionService } from "../src/competitions/service.js";
import { CompetitionNotFoundError, CompetitionLockedError } from "../src/competitions/errors.js";
import { RosterProjection } from "../src/roster/projection.js";
import { DrawProjection } from "../src/draw/projection.js";
import { LifecycleProjection } from "../src/lifecycle/projection.js";
import { LifecycleGuard } from "../src/lifecycle/guard.js";
import { TransitionNotAllowedError } from "../src/lifecycle/errors.js";

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

// A fixed-count progress stub so each finalisation outcome is driven
// independently of the not-yet-built competition.roundAdvanced emitter
// (Safeguard 5 — the LIVE DEPENDENCY seam).
function fixedProgress(rounds: number, tasks = 0): FinalisationProgressProvider {
  return { completedRounds: () => rounds, completedTasks: () => tasks };
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

// Builds a competition already in Running/BetweenGroups (competition.started
// folded) with the given class model and an injected finalisation-progress stub.
function build(classModelId: string, progress: FinalisationProgressProvider) {
  const eventStore = new EventStore(":memory:");
  const classModelProjection = new ClassModelProjection();
  new ClassModelService(eventStore, classModelProjection, {
    getReferencingCompetitions: () => [],
  }).seedStockModels();
  const competitionProjection = new CompetitionProjection();
  const lifecycleProjection = new LifecycleProjection(new RosterProjection(), new DrawProjection());
  const service = new CompetitionService(
    eventStore,
    competitionProjection,
    classModelProjection,
    new ProjectionLockStateProvider(lifecycleProjection),
    new NoScoresYetProvider(),
    lifecycleProjection,
    new LifecycleGuard(),
    progress,
  );
  const created = service.create(
    { name: "Cup", date: "2026-09-12", venue: "Rotorua", classModelId },
    attribution,
  );
  competitionProjection.rebuild(eventStore.readAll());
  // Start proceedings → Running/BetweenGroups (the only state Lock admits).
  lifecycleProjection.apply(record("competitions", "competition.started", created.id));
  return { eventStore, service, lifecycleProjection, id: created.id };
}

describe("CompetitionService.lock — Lock & Finalisation (STORY-001-026)", () => {
  it("AC1/AC8: from Running/BetweenGroups seals to terminal Locked with one CD-authority event carrying the resolved outcome", () => {
    // F3J minimum is 4 rounds; 5 completed ⇒ OfficialResults.
    const { service, id, eventStore } = build(stockModelIdFor("F3J"), fixedProgress(5));
    const before = eventStore.readAll().length;

    const result = service.lock(id, cdAttribution);

    expect(result).toEqual({ state: "Locked", subState: null, admissibleActions: [] });
    const appended = eventStore.readAll().slice(before);
    expect(appended).toHaveLength(1);
    expect(appended[0].type).toBe("competition.locked");
    expect(appended[0].attribution.authority).toBe("contest-director");
    expect(appended[0].payload).toEqual({
      competitionId: id,
      outcome: "OfficialResults",
      completedRounds: 5,
    });
  });

  it("AC4: a below-minimum contest still locks, recorded as NoContest", () => {
    // F3J minimum 4; only 2 completed ⇒ NoContest, but Lock is not blocked.
    const { service, id, eventStore } = build(stockModelIdFor("F3J"), fixedProgress(2));
    const result = service.lock(id, cdAttribution);
    expect(result.state).toBe("Locked");
    const locked = eventStore.readAll().at(-1);
    expect(locked?.payload).toMatchObject({ outcome: "NoContest", completedRounds: 2 });
  });

  it("AC5: the minimum boundary is inclusive — completed === min ⇒ OfficialResults", () => {
    const { service, id, eventStore } = build(stockModelIdFor("F3J"), fixedProgress(4));
    service.lock(id, cdAttribution);
    expect(eventStore.readAll().at(-1)?.payload).toMatchObject({ outcome: "OfficialResults" });
  });

  it("AC5: one below the minimum ⇒ NoContest (4 vs F3K min 5)", () => {
    const { service, id, eventStore } = build(stockModelIdFor("F3K"), fixedProgress(4));
    service.lock(id, cdAttribution);
    expect(eventStore.readAll().at(-1)?.payload).toMatchObject({ outcome: "NoContest" });
  });

  it("AC6: F3B compound — 1 round AND 1 task ⇒ OfficialResults", () => {
    const { service, id, eventStore } = build(stockModelIdFor("F3B"), fixedProgress(1, 1));
    service.lock(id, cdAttribution);
    expect(eventStore.readAll().at(-1)?.payload).toMatchObject({ outcome: "OfficialResults" });
  });

  it("AC6: F3B compound — the round is met but no task completed ⇒ NoContest", () => {
    const { service, id, eventStore } = build(stockModelIdFor("F3B"), fixedProgress(1, 0));
    service.lock(id, cdAttribution);
    expect(eventStore.readAll().at(-1)?.payload).toMatchObject({ outcome: "NoContest" });
  });

  it("AC7: F5K fixes no minimum (null) — always OfficialResults, even at zero rounds", () => {
    const { service, id, eventStore } = build(stockModelIdFor("F5K"), fixedProgress(0));
    service.lock(id, cdAttribution);
    expect(eventStore.readAll().at(-1)?.payload).toMatchObject({
      outcome: "OfficialResults",
      completedRounds: 0,
    });
  });

  it("edge: a double-lock is rejected (Locked is terminal), appends nothing", () => {
    const { service, id, eventStore } = build(stockModelIdFor("F3J"), fixedProgress(5));
    service.lock(id, cdAttribution);
    const before = eventStore.readAll().length;
    expect(() => service.lock(id, cdAttribution)).toThrow(TransitionNotAllowedError);
    expect(eventStore.readAll().length).toBe(before);
  });

  it("edge: Lock from GroupInProgress then Suspended is rejected, appends nothing", () => {
    const { service, id, lifecycleProjection, eventStore } = build(
      stockModelIdFor("F3J"),
      fixedProgress(5),
    );
    // GroupInProgress: a group is open ⇒ Lock inadmissible.
    lifecycleProjection.apply(record(id, "group.opened", id));
    const beforeGroup = eventStore.readAll().length;
    expect(() => service.lock(id, cdAttribution)).toThrow(TransitionNotAllowedError);
    expect(eventStore.readAll().length).toBe(beforeGroup);

    // Suspended (close the group, then suspend) ⇒ still inadmissible.
    lifecycleProjection.apply(record(id, "group.scored", id));
    lifecycleProjection.apply(record("competitions", "competition.suspended", id));
    expect(() => service.lock(id, cdAttribution)).toThrow(TransitionNotAllowedError);
    expect(eventStore.readAll().length).toBe(beforeGroup);
  });

  it("edge: Lock from Setup (not started) is rejected", () => {
    const { service, id, lifecycleProjection } = build(stockModelIdFor("F3J"), fixedProgress(5));
    // Roll back to Setup by rebuilding the lifecycle projection from an empty log
    // (no competition.started folded).
    lifecycleProjection.rebuild([]);
    expect(() => service.lock(id, cdAttribution)).toThrow(TransitionNotAllowedError);
  });

  it("a never-existed id is 404 (CompetitionNotFoundError)", () => {
    const { service } = build(stockModelIdFor("F3J"), fixedProgress(5));
    expect(() => service.lock("nope", cdAttribution)).toThrow(CompetitionNotFoundError);
  });

  it("freeze activation: the real ProjectionLockStateProvider trips the update class-change gate once locked", () => {
    const { service, id } = build(stockModelIdFor("F3J"), fixedProgress(5));
    service.lock(id, cdAttribution);
    // A genuinely-locked competition now rejects a class change (the gate coded
    // against LockStateProvider.isLocked, activated by the real provider).
    expect(() =>
      service.update(
        id,
        { name: "Cup", date: "2026-09-12", venue: "Rotorua", classModelId: stockModelIdFor("F3K") },
        attribution,
      ),
    ).toThrow(CompetitionLockedError);
  });

  it("freeze activation: a locked competition cannot be deleted", () => {
    const { service, id } = build(stockModelIdFor("F3J"), fixedProgress(5));
    service.lock(id, cdAttribution);
    expect(() => service.delete(id, { confirmDestroysResults: true }, attribution)).toThrow(
      CompetitionLockedError,
    );
  });
});

// The default log-backed provider and the zero stub both read 0 today (no
// competition.roundAdvanced emitter yet), so a class with a minimum resolves to
// NoContest — correct-but-empty until the round story ships (Safeguard 5).
describe("ProjectionFinalisationProgressProvider / ZeroProgressProvider — live-dependency default (STORY-001-026)", () => {
  it("resolves NoContest for a class with a minimum while the round emitter is absent", () => {
    const { service, id, eventStore } = build(stockModelIdFor("F3J"), new ZeroProgressProvider());
    service.lock(id, cdAttribution);
    expect(eventStore.readAll().at(-1)?.payload).toMatchObject({
      outcome: "NoContest",
      completedRounds: 0,
    });
  });

  it("still resolves OfficialResults for F5K (null minimum) with zero progress", () => {
    const { service, id, eventStore } = build(stockModelIdFor("F5K"), new ZeroProgressProvider());
    service.lock(id, cdAttribution);
    expect(eventStore.readAll().at(-1)?.payload).toMatchObject({ outcome: "OfficialResults" });
  });
});

// Class-agnostic law (CLAUDE.md): the finalisation resolver reads only the
// model's minimumForValidContest scalar shape and compares generically — the
// SAME predicate produces every class's outcome, with no branch on discipline.
describe("Lock finalisation is class-agnostic (STORY-001-026)", () => {
  it("one generic predicate handles null, plain-round and compound minima identically", () => {
    // Same completed counts, three class shapes → outcome depends only on the
    // model value, never on which class it is.
    const cases: Array<[string, FinalisationProgressProvider, string]> = [
      [stockModelIdFor("F5K"), fixedProgress(0, 0), "OfficialResults"], // null minimum
      [stockModelIdFor("F3J"), fixedProgress(4, 0), "OfficialResults"], // plain rounds: 4>=4
      [stockModelIdFor("F3B"), fixedProgress(1, 1), "OfficialResults"], // compound rounds+tasks
      [stockModelIdFor("F3B"), fixedProgress(1, 0), "NoContest"], // compound, task short
    ];
    for (const [classModelId, progress, expected] of cases) {
      const { service, id, eventStore } = build(classModelId, progress);
      service.lock(id, cdAttribution);
      expect(eventStore.readAll().at(-1)?.payload).toMatchObject({ outcome: expected });
    }
  });
});
