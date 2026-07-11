import { describe, expect, it } from "vitest";
import type { Attribution } from "@soarscore/shared";
import type { EventRecord } from "../src/eventstore/event-store.js";
import { RosterProjection } from "../src/roster/projection.js";

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

function added(competitionId: string, id: string, pilotId: string): EventRecord {
  return record(competitionId, "roster.entryAdded", {
    id,
    competitionId,
    pilotId,
    pilotNumber: null,
    pilotClass: null,
  });
}

describe("RosterProjection", () => {
  it("rebuilds rosters per competition from a replay", () => {
    const projection = new RosterProjection();
    projection.rebuild([
      added("comp-1", "e1", "p1"),
      added("comp-1", "e2", "p2"),
      added("comp-2", "e3", "p1"),
      record("comp-1", "roster.entryRemoved", { rosterEntryId: "e2", competitionId: "comp-1" }),
    ]);

    expect(projection.getRoster("comp-1").map((e) => e.id)).toEqual(["e1"]);
    expect(projection.getRoster("comp-2").map((e) => e.id)).toEqual(["e3"]);
    expect(projection.getCompetitionIdsForPilot("p1").sort()).toEqual(["comp-1", "comp-2"]);
    expect(projection.hasPilot("comp-1", "p2")).toBe(false);
  });

  it("scope guard keeps competitions isolated and ignores foreign event types", () => {
    const projection = new RosterProjection();
    projection.apply(added("comp-1", "e1", "p1"));
    // A pilot.* event in another scope never touches roster state.
    projection.apply(record("master-data", "pilot.created", { id: "p9", name: "X" }));

    expect(projection.getRoster("comp-2")).toEqual([]);
    expect(projection.getRoster("comp-1")).toHaveLength(1);
  });

  it("competition.deleted (scope competitions) drops that competition's roster only", () => {
    const projection = new RosterProjection();
    projection.apply(added("comp-1", "e1", "p1"));
    projection.apply(added("comp-2", "e2", "p1"));
    projection.apply(record("competitions", "competition.deleted", { competitionId: "comp-1" }));

    expect(projection.getRoster("comp-1")).toEqual([]);
    expect(projection.getRoster("comp-2")).toHaveLength(1);
    expect(projection.getCompetitionIdsForPilot("p1")).toEqual(["comp-2"]);
  });

  it("entryReplaced swaps the occupant on the same entry id", () => {
    const projection = new RosterProjection();
    projection.apply(added("comp-1", "e1", "p1"));
    projection.apply(
      record("comp-1", "roster.entryReplaced", {
        rosterEntryId: "e1",
        competitionId: "comp-1",
        previousPilotId: "p1",
        pilotId: "p2",
        pilotNumber: 4,
        pilotClass: null,
      }),
    );

    const entry = projection.getEntry("comp-1", "e1");
    expect(entry?.pilotId).toBe("p2");
    expect(entry?.pilotNumber).toBe(4);
    expect(projection.hasPilot("comp-1", "p1")).toBe(false);
    expect(projection.usedPilotNumbers("comp-1")).toEqual(new Set([4]));
  });
});
