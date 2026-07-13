import { describe, expect, it } from "vitest";
import { stockModelIdFor, type GeneratedDraw } from "@soarscore/shared";
import { EventStore } from "../src/eventstore/event-store.js";
import { CompetitionProjection } from "../src/competitions/projection.js";
import { ClassModelProjection } from "../src/class-models/projection.js";
import { ClassModelService } from "../src/class-models/service.js";
import {
  AlwaysUnlockedProvider,
  NoScoresYetProvider,
} from "../src/competitions/state-providers.js";
import { CompetitionService } from "../src/competitions/service.js";
import { RosterProjection } from "../src/roster/projection.js";
import { DrawProjection } from "../src/draw/projection.js";
import { DrawService } from "../src/draw/service.js";
import {
  DrawNotAcceptedError,
  GroupMoveClashError,
  GroupMoveTargetNotFoundError,
  GroupSplitInvalidError,
  ReflightEntitlementNotFoundError,
} from "../src/draw/errors.js";

const attribution = { actorName: "organiser", originClient: "test-client", authority: "organiser" };

function specInput(over: Partial<Record<string, unknown>> = {}) {
  return {
    drawMode: "random-anti-repeat",
    roundCount: 4,
    groupsPerRound: 2,
    fairnessMetric: "min-max-then-excess",
    avoidConsecutiveFlights: false,
    lanePolicy: "rotate",
    minGroupSizeOverride: null,
    ...over,
  };
}

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
  );
  const rosterProjection = new RosterProjection();
  const drawProjection = new DrawProjection();
  const service = new DrawService(
    eventStore,
    drawProjection,
    competitionProjection,
    classModelProjection,
    rosterProjection,
  );

  const makeCompetition = (classModelId: string) =>
    competitionService.create(
      { name: `Comp ${classModelId}`, date: "2026-09-12", venue: "Rotorua", classModelId },
      attribution,
    );

  const seedRoster = (competitionId: string, n: number) => {
    for (let i = 0; i < n; i++) {
      const id = `seat-${competitionId}-${i}`;
      const record = eventStore.append({
        scope: competitionId,
        type: "roster.entryAdded",
        payload: {
          id,
          competitionId,
          pilotId: `pilot-${i}`,
          pilotNumber: i + 1,
          pilotClass: null,
        },
        attribution,
      });
      rosterProjection.apply(record);
    }
  };

  // Ready a competition through to an *accepted* draw (this story's methods
  // all operate only on the accepted state).
  const readyAcceptedCompetition = (
    classModelId: string,
    n: number,
    specOverrides: Partial<Record<string, unknown>> = {},
  ) => {
    const comp = makeCompetition(classModelId);
    seedRoster(comp.id, n);
    service.saveSpec(comp.id, specInput(specOverrides), attribution);
    const candidate = service.generate(comp.id, attribution);
    service.accept(comp.id, candidate.id, [], attribution);
    return { comp, candidate };
  };

  return { eventStore, service, drawProjection, makeCompetition, seedRoster, readyAcceptedCompetition };
}

function findFirstMember(draw: GeneratedDraw, roundNumber: number, flyingOrder: number): string {
  const round = draw.rounds.find((r) => r.roundNumber === roundNumber)!;
  const group = round.groups.find((g) => g.flyingOrder === flyingOrder)!;
  return group.members[0]!.rosterEntryId;
}

describe("DrawService — STORY-001-011 group move/split", () => {
  it("AC1: moving a pilot between two groups updates the effective view; other rounds are unaffected", () => {
    const { service, readyAcceptedCompetition } = build();
    // 14 seats / 2 groups = 7 per group (F5J min 6), so removing one from the
    // source still clears the minimum (6) — isolates AC1 from the
    // group-size-minimum clash.
    const { comp, candidate } = readyAcceptedCompetition(stockModelIdFor("F5J"), 14, { roundCount: 2 });
    const taskId = candidate.rounds[0]!.taskGroups[0]!.taskId;
    const mover = findFirstMember(candidate, 1, 1);

    const view = service.moveGroup(
      comp.id,
      { roundNumber: 1, taskId, rosterEntryId: mover, toGroupFlyingOrder: 2 },
      attribution,
    );
    const round1 = view.rounds.find((r) => r.roundNumber === 1)!;
    const group1 = round1.groups.find((g) => g.flyingOrder === 1)!;
    const group2 = round1.groups.find((g) => g.flyingOrder === 2)!;
    expect(group1.members.some((m) => m.rosterEntryId === mover)).toBe(false);
    expect(group2.members.some((m) => m.rosterEntryId === mover)).toBe(true);
    expect(group1.members).toHaveLength(6);
    expect(group2.members).toHaveLength(8);

    // Round 2 is untouched by a round-1 move (task-scoped, round-scoped).
    const round2 = view.rounds.find((r) => r.roundNumber === 2)!;
    const originalRound2 = candidate.rounds.find((r) => r.roundNumber === 2)!.taskGroups[0]!.groups;
    expect(round2.groups.map((g) => g.members.map((m) => m.rosterEntryId).sort())).toEqual(
      originalRound2.map((g) => g.members.map((m) => m.rosterEntryId).sort()),
    );
  });

  it("AC1: splitting a group produces two groups whose combined membership equals the original, no flyingOrder reused", () => {
    const { service, readyAcceptedCompetition } = build();
    const { comp, candidate } = readyAcceptedCompetition(stockModelIdFor("F5J"), 12, { roundCount: 1 });
    const taskId = candidate.rounds[0]!.taskGroups[0]!.taskId;
    const sourceGroup = candidate.rounds[0]!.groups.find((g) => g.flyingOrder === 1)!;
    const originalIds = sourceGroup.members.map((m) => m.rosterEntryId);
    const moved = originalIds.slice(0, 3); // 6 -> 3/3, both clear D1's floor of 2

    const view = service.splitGroup(
      comp.id,
      { roundNumber: 1, taskId, sourceGroupFlyingOrder: 1, movedRosterEntryIds: moved },
      attribution,
    );
    const round1 = view.rounds.find((r) => r.roundNumber === 1)!;
    const flyingOrders = round1.groups.map((g) => g.flyingOrder);
    expect(new Set(flyingOrders).size).toBe(flyingOrders.length); // no reuse
    const combined = round1.groups.flatMap((g) => g.members.map((m) => m.rosterEntryId)).sort();
    expect(combined).toEqual([...originalIds, ...candidate.rounds[0]!.groups[1]!.members.map((m) => m.rosterEntryId)].sort());
    const newGroup = round1.groups.find((g) => g.members.some((m) => moved.includes(m.rosterEntryId)))!;
    expect(newGroup.members.map((m) => m.rosterEntryId).sort()).toEqual([...moved].sort());
  });

  it("AC2: a move violating avoidConsecutiveFlights is rejected, naming 'consecutive-flight'; nothing appended", () => {
    const { service, eventStore, readyAcceptedCompetition } = build();
    // 21 seats, 3 groups of 7 (F5J min 6) over 3 rounds, no-back-to-back on —
    // 2 groups would be over-constrained (unsatisfiable, as the generation
    // AC6 test elsewhere already documents), so this uses 3 groups.
    const { comp, candidate } = readyAcceptedCompetition(stockModelIdFor("F5J"), 21, {
      roundCount: 3,
      groupsPerRound: 3,
      avoidConsecutiveFlights: true,
    });
    const taskId = candidate.rounds[0]!.taskGroups[0]!.taskId;

    // By construction, no one in round 2's first group can already be in
    // round 1's last group (flyingOrder 3) — so they must be in round 1's
    // group 1 or 2.
    const round2FirstGroup = candidate.rounds[1]!.groups.find((g) => g.flyingOrder === 1)!;
    const entrant = round2FirstGroup.members[0]!.rosterEntryId;
    const round1LastGroup = candidate.rounds[0]!.groups.find((g) => g.flyingOrder === 3)!;
    expect(round1LastGroup.members.some((m) => m.rosterEntryId === entrant)).toBe(false);

    const before = eventStore.readAll().length;
    let caught: unknown;
    try {
      service.moveGroup(
        comp.id,
        { roundNumber: 1, taskId, rosterEntryId: entrant, toGroupFlyingOrder: 3 },
        attribution,
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(GroupMoveClashError);
    expect((caught as Error).message).toContain("consecutive-flight");
    expect(eventStore.readAll().length).toBe(before);
  });

  it("group-size-minimum clash: a move that would starve the source group below the task's minimum is rejected; nothing appended", () => {
    const { service, eventStore, readyAcceptedCompetition } = build();
    // 12 seats, 2 groups of 6 — exactly F5J's minimum. Removing one drops the
    // source to 5, below the minimum.
    const { comp, candidate } = readyAcceptedCompetition(stockModelIdFor("F5J"), 12, { roundCount: 1 });
    const taskId = candidate.rounds[0]!.taskGroups[0]!.taskId;
    const mover = findFirstMember(candidate, 1, 1);

    const before = eventStore.readAll().length;
    let caught: unknown;
    try {
      service.moveGroup(
        comp.id,
        { roundNumber: 1, taskId, rosterEntryId: mover, toGroupFlyingOrder: 2 },
        attribution,
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(GroupMoveClashError);
    expect((caught as Error).message).toContain("group-size-minimum");
    expect(eventStore.readAll().length).toBe(before);
  });

  it("moving an unseated pilot 404s with GroupMoveTargetNotFoundError", () => {
    const { service, readyAcceptedCompetition } = build();
    const { comp, candidate } = readyAcceptedCompetition(stockModelIdFor("F5J"), 12, { roundCount: 1 });
    const taskId = candidate.rounds[0]!.taskGroups[0]!.taskId;
    expect(() =>
      service.moveGroup(
        comp.id,
        { roundNumber: 1, taskId, rosterEntryId: "not-a-seat", toGroupFlyingOrder: 2 },
        attribution,
      ),
    ).toThrow(GroupMoveTargetNotFoundError);
  });

  it("splitting a non-subset selection is rejected with GroupSplitInvalidError", () => {
    const { service, readyAcceptedCompetition } = build();
    const { comp, candidate } = readyAcceptedCompetition(stockModelIdFor("F5J"), 12, { roundCount: 1 });
    const taskId = candidate.rounds[0]!.taskGroups[0]!.taskId;
    expect(() =>
      service.splitGroup(
        comp.id,
        { roundNumber: 1, taskId, sourceGroupFlyingOrder: 1, movedRosterEntryIds: ["not-a-member"] },
        attribution,
      ),
    ).toThrow(GroupSplitInvalidError);
  });

  it("not-accepted gating: moveGroup/splitGroup/prepareReflight on a competition with only a candidate 409s DrawNotAcceptedError", () => {
    const { service, makeCompetition, seedRoster } = build();
    const comp = makeCompetition(stockModelIdFor("F5J"));
    seedRoster(comp.id, 12);
    service.saveSpec(comp.id, specInput({ roundCount: 1 }), attribution);
    const candidate = service.generate(comp.id, attribution);
    const taskId = candidate.rounds[0]!.taskGroups[0]!.taskId;
    const mover = findFirstMember(candidate, 1, 1);

    expect(() =>
      service.moveGroup(comp.id, { roundNumber: 1, taskId, rosterEntryId: mover, toGroupFlyingOrder: 2 }, attribution),
    ).toThrow(DrawNotAcceptedError);
    expect(() =>
      service.splitGroup(
        comp.id,
        { roundNumber: 1, taskId, sourceGroupFlyingOrder: 1, movedRosterEntryIds: [mover] },
        attribution,
      ),
    ).toThrow(DrawNotAcceptedError);
    expect(() =>
      service.prepareReflight(
        comp.id,
        { roundNumber: 1, taskId, entitledRosterEntryId: mover, reason: "equipment failure" },
        attribution,
      ),
    ).toThrow(DrawNotAcceptedError);
  });

  it("Determinism: rebuilding DrawProjection from the log reproduces identical effective groups", () => {
    const { service, eventStore, drawProjection, readyAcceptedCompetition } = build();
    const { comp, candidate } = readyAcceptedCompetition(stockModelIdFor("F5J"), 14, { roundCount: 2 });
    const taskId = candidate.rounds[0]!.taskGroups[0]!.taskId;
    const mover = findFirstMember(candidate, 1, 1);
    service.moveGroup(comp.id, { roundNumber: 1, taskId, rosterEntryId: mover, toGroupFlyingOrder: 2 }, attribution);

    const fresh = new DrawProjection();
    fresh.rebuild(eventStore.readAll());
    expect(fresh.getEffectiveGroups(comp.id, 1, taskId)).toEqual(
      drawProjection.getEffectiveGroups(comp.id, 1, taskId),
    );
  });
});

describe("DrawService — STORY-001-011 re-flight preparation", () => {
  it("AC3: prepareReflight appends draw.reflightPrepared with the pending-CD-approval handoff; no route ever flips it", () => {
    const { service, eventStore, readyAcceptedCompetition } = build();
    const { comp, candidate } = readyAcceptedCompetition(stockModelIdFor("F5J"), 20, { roundCount: 1 });
    const taskId = candidate.rounds[0]!.taskGroups[0]!.taskId;
    const entitled = findFirstMember(candidate, 1, 1);

    const payload = service.prepareReflight(
      comp.id,
      { roundNumber: 1, taskId, entitledRosterEntryId: entitled, reason: "transmitter failure" },
      attribution,
    );
    expect(payload.approvalStatus).toBe("pending-contest-director-approval");
    expect(payload.entitledRosterEntryId).toBe(entitled);

    const reflightEvents = eventStore.readAll().filter((e) => e.type === "draw.reflightPrepared");
    expect(reflightEvents).toHaveLength(1);
    expect(reflightEvents[0]!.payload).toMatchObject({ approvalStatus: "pending-contest-director-approval" });
  });

  it("AC4: an F5J re-flight fills the new group to exactly task.minGroupSize (6)", () => {
    const { service, readyAcceptedCompetition } = build();
    const { comp, candidate } = readyAcceptedCompetition(stockModelIdFor("F5J"), 20, { roundCount: 1 });
    const taskId = candidate.rounds[0]!.taskGroups[0]!.taskId;
    const entitled = findFirstMember(candidate, 1, 1);

    const payload = service.prepareReflight(
      comp.id,
      { roundNumber: 1, taskId, entitledRosterEntryId: entitled, reason: "landing dispute" },
      attribution,
    );
    expect(payload.fillerRosterEntryIds).toHaveLength(5); // 6 - entitled(1)
    expect(new Set(payload.fillerRosterEntryIds).has(entitled)).toBe(false);
    expect(new Set(payload.fillerRosterEntryIds).size).toBe(5); // no duplicates
  });

  it("AC4: an F3B Speed re-flight resolves its own task-specific minimum (8), not F5J's 6", () => {
    const { service, readyAcceptedCompetition } = build();
    const { comp, candidate } = readyAcceptedCompetition(stockModelIdFor("F3B"), 20, { roundCount: 1 });
    const speedTaskGroup = candidate.rounds[0]!.taskGroups.find((tg) => tg.taskName === "Speed")!;
    const entitled = speedTaskGroup.groups[0]!.members[0]!.rosterEntryId;

    const payload = service.prepareReflight(
      comp.id,
      {
        roundNumber: 1,
        taskId: speedTaskGroup.taskId,
        entitledRosterEntryId: entitled,
        reason: "safety-plane infringement dispute",
      },
      attribution,
    );
    expect(payload.fillerRosterEntryIds).toHaveLength(7); // 8 - entitled(1)
  });

  it("re-flight filler exclusion: a pilot already in a re-flight this round is never drawn again as a filler", () => {
    const { service, readyAcceptedCompetition } = build();
    const { comp, candidate } = readyAcceptedCompetition(stockModelIdFor("F5J"), 20, { roundCount: 1 });
    const taskId = candidate.rounds[0]!.taskGroups[0]!.taskId;
    const allSeated = candidate.rounds[0]!.groups.flatMap((g) => g.members.map((m) => m.rosterEntryId));
    const first = allSeated[0]!;
    const second = allSeated[1]!;

    const firstPrep = service.prepareReflight(
      comp.id,
      { roundNumber: 1, taskId, entitledRosterEntryId: first, reason: "reason A" },
      attribution,
    );
    const secondPrep = service.prepareReflight(
      comp.id,
      { roundNumber: 1, taskId, entitledRosterEntryId: second, reason: "reason B" },
      attribution,
    );
    const firstGroupIds = new Set([first, ...firstPrep.fillerRosterEntryIds]);
    for (const filler of secondPrep.fillerRosterEntryIds) {
      expect(firstGroupIds.has(filler)).toBe(false);
    }
  });

  it("preparing a re-flight for an unseated pilot 404s ReflightEntitlementNotFoundError", () => {
    const { service, readyAcceptedCompetition } = build();
    const { comp, candidate } = readyAcceptedCompetition(stockModelIdFor("F5J"), 12, { roundCount: 1 });
    const taskId = candidate.rounds[0]!.taskGroups[0]!.taskId;
    expect(() =>
      service.prepareReflight(
        comp.id,
        { roundNumber: 1, taskId, entitledRosterEntryId: "not-a-seat", reason: "x" },
        attribution,
      ),
    ).toThrow(ReflightEntitlementNotFoundError);
  });
});
