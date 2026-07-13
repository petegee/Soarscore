import { describe, expect, it } from "vitest";
import type { Attribution } from "@soarscore/shared";
import type { EventRecord } from "../src/eventstore/event-store.js";
import { LifecycleProjection } from "../src/lifecycle/projection.js";
import type { RosterProjection } from "../src/roster/projection.js";
import type { DrawProjection } from "../src/draw/projection.js";

const attribution: Attribution = {
  actorName: "tester",
  originClient: "test-client",
  authority: "organiser",
};

let seq = 0;
function record(scope: string, type: string, payload: unknown): EventRecord {
  seq += 1;
  return { seq, timestamp: new Date().toISOString(), scope, type, payload, attribution };
}

// Lightweight read-only stubs for the two injected projections — the lifecycle
// projection reads only these three methods off them.
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

const COMP = "comp-1";

describe("LifecycleProjection — Setup readiness ladder (AC2)", () => {
  it("empty roster, no draw ⇒ Setup/Draft", () => {
    const { rosterProjection, drawProjection } = stubProjections(0);
    const p = new LifecycleProjection(rosterProjection, drawProjection);
    expect(p.getState(COMP)).toEqual({ state: "Setup", setupSubState: "Draft" });
  });

  it("roster ≥ 1 entry ⇒ RosterComplete", () => {
    const { rosterProjection, drawProjection } = stubProjections(1);
    const p = new LifecycleProjection(rosterProjection, drawProjection);
    expect(p.getState(COMP).setupSubState).toBe("RosterComplete");
  });

  it("a draw spec ⇒ DrawSpecified", () => {
    const { rosterProjection, drawProjection } = stubProjections(1, { spec: true });
    const p = new LifecycleProjection(rosterProjection, drawProjection);
    p.apply(record(COMP, "roster.entryAdded", { competitionId: COMP, id: "e0" }));
    p.apply(record(COMP, "draw.specSaved", { competitionId: COMP }));
    expect(p.getState(COMP).setupSubState).toBe("DrawSpecified");
  });

  it("a generated candidate newer than every input ⇒ DrawGenerated", () => {
    const { rosterProjection, drawProjection } = stubProjections(1, { spec: true, candidate: true });
    const p = new LifecycleProjection(rosterProjection, drawProjection);
    p.apply(record(COMP, "roster.entryAdded", { competitionId: COMP, id: "e0" }));
    p.apply(record(COMP, "draw.specSaved", { competitionId: COMP }));
    p.apply(record(COMP, "draw.generated", { competitionId: COMP }));
    expect(p.getState(COMP).setupSubState).toBe("DrawGenerated");
  });

  it("an accepted, non-stale draw ⇒ DrawAccepted (READY)", () => {
    const { rosterProjection, drawProjection } = stubProjections(1, {
      spec: true,
      candidate: true,
      accepted: true,
    });
    const p = new LifecycleProjection(rosterProjection, drawProjection);
    p.apply(record(COMP, "roster.entryAdded", { competitionId: COMP, id: "e0" }));
    p.apply(record(COMP, "draw.specSaved", { competitionId: COMP }));
    p.apply(record(COMP, "draw.generated", { competitionId: COMP }));
    expect(p.getState(COMP).setupSubState).toBe("DrawAccepted");
  });
});

describe("LifecycleProjection — deterministic left-fallback on staleness (AC3)", () => {
  it("an input edit logged after the candidate falls readiness back and reports no current draw", () => {
    const { rosterProjection, drawProjection } = stubProjections(1, {
      spec: true,
      candidate: true,
      accepted: true,
    });
    const p = new LifecycleProjection(rosterProjection, drawProjection);
    p.apply(record(COMP, "roster.entryAdded", { competitionId: COMP, id: "e0" }));
    p.apply(record(COMP, "draw.specSaved", { competitionId: COMP }));
    p.apply(record(COMP, "draw.generated", { competitionId: COMP }));
    expect(p.getState(COMP).setupSubState).toBe("DrawAccepted");

    // A later roster edit (higher seq than draw.generated) makes the candidate
    // stale: readiness falls back to the spec rung and the draw is no longer
    // reported as generated/accepted.
    p.apply(record(COMP, "roster.entryUpdated", { competitionId: COMP, id: "e0" }));
    expect(p.getState(COMP).setupSubState).toBe("DrawSpecified");
  });

  it("stale with no surviving spec falls back to RosterComplete", () => {
    const { rosterProjection, drawProjection } = stubProjections(1, { candidate: true });
    const p = new LifecycleProjection(rosterProjection, drawProjection);
    p.apply(record(COMP, "draw.generated", { competitionId: COMP }));
    p.apply(record(COMP, "roster.entryAdded", { competitionId: COMP, id: "e0" }));
    // input seq > generated seq ⇒ stale; getSpec is absent ⇒ RosterComplete.
    expect(p.getState(COMP).setupSubState).toBe("RosterComplete");
  });
});

describe("LifecycleProjection — top-level states in strict precedence (AC1)", () => {
  it("started ⇒ Running/BetweenGroups, then GroupInProgress while a group is open", () => {
    const { rosterProjection, drawProjection } = stubProjections(1, { accepted: true });
    const p = new LifecycleProjection(rosterProjection, drawProjection);
    p.apply(record("competitions", "competition.started", { competitionId: COMP }));
    expect(p.getState(COMP)).toEqual({ state: "Running", runningSubState: "BetweenGroups" });

    p.apply(record(COMP, "group.opened", { competitionId: COMP, roundNumber: 1, groupFlyingOrder: 1 }));
    expect(p.getState(COMP)).toEqual({ state: "Running", runningSubState: "GroupInProgress" });

    p.apply(record(COMP, "group.scored", { competitionId: COMP, roundNumber: 1, groupFlyingOrder: 1 }));
    expect(p.getState(COMP)).toEqual({ state: "Running", runningSubState: "BetweenGroups" });
  });

  it("suspended overrides started; resumed clears it", () => {
    const { rosterProjection, drawProjection } = stubProjections(1);
    const p = new LifecycleProjection(rosterProjection, drawProjection);
    p.apply(record("competitions", "competition.started", { competitionId: COMP }));
    p.apply(record("competitions", "competition.suspended", { competitionId: COMP }));
    expect(p.getState(COMP)).toEqual({ state: "Suspended" });

    p.apply(record("competitions", "competition.resumed", { competitionId: COMP }));
    expect(p.getState(COMP).state).toBe("Running");
  });

  it("locked overrides running/suspended", () => {
    const { rosterProjection, drawProjection } = stubProjections(1);
    const p = new LifecycleProjection(rosterProjection, drawProjection);
    p.apply(record("competitions", "competition.started", { competitionId: COMP }));
    p.apply(record("competitions", "competition.suspended", { competitionId: COMP }));
    p.apply(record("competitions", "competition.locked", { competitionId: COMP }));
    expect(p.getState(COMP)).toEqual({ state: "Locked" });
  });

  it("deleted tombstone wins over everything and stays reportable (observability)", () => {
    const { rosterProjection, drawProjection } = stubProjections(1);
    const p = new LifecycleProjection(rosterProjection, drawProjection);
    p.apply(record("competitions", "competition.started", { competitionId: COMP }));
    p.apply(record("competitions", "competition.deleted", { competitionId: COMP }));
    expect(p.getState(COMP)).toEqual({ state: "Deleted" });
    expect(p.isDeleted(COMP)).toBe(true);
  });
});

describe("LifecycleProjection — pure loader", () => {
  it("rebuild fully resets then replays, and ignores unrecognised types", () => {
    const { rosterProjection, drawProjection } = stubProjections(0);
    const p = new LifecycleProjection(rosterProjection, drawProjection);
    p.apply(record("competitions", "competition.started", { competitionId: COMP }));
    p.apply(record("master-data", "pilot.created", { id: "p1" }));
    expect(p.getState(COMP).state).toBe("Running");

    p.rebuild([]);
    expect(p.getState(COMP).state).toBe("Setup");
  });
});
