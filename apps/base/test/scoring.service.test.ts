import { describe, expect, it } from "vitest";
import { stockModelIdFor, type GeneratedDraw } from "@soarscore/shared";
import { EventStore } from "../src/eventstore/event-store.js";
import { CompetitionProjection } from "../src/competitions/projection.js";
import { ClassModelProjection } from "../src/class-models/projection.js";
import { ClassModelService } from "../src/class-models/service.js";
import {
  AlwaysUnlockedProvider,
  NoScoresYetProvider,
  ZeroProgressProvider,
} from "../src/competitions/state-providers.js";
import { CompetitionService } from "../src/competitions/service.js";
import { LifecycleProjection } from "../src/lifecycle/projection.js";
import { LifecycleGuard } from "../src/lifecycle/guard.js";
import { RosterProjection } from "../src/roster/projection.js";
import { DrawProjection } from "../src/draw/projection.js";
import { DrawService } from "../src/draw/service.js";
import { DrawServiceGroupCompositionProvider } from "../src/draw/group-composition-provider.js";
import { ScoringProjection } from "../src/scoring/projection.js";
import { ScoringService } from "../src/scoring/service.js";
import { buildApp } from "../src/app.js";

const attribution = { actorName: "organiser", originClient: "test-client", authority: "organiser" };

function specInput(over: Partial<Record<string, unknown>> = {}) {
  return {
    drawMode: "random-anti-repeat",
    roundCount: 2,
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
    new LifecycleProjection(new RosterProjection(), new DrawProjection()),
    new LifecycleGuard(),
    new ZeroProgressProvider(),
  );
  const rosterProjection = new RosterProjection();
  const drawProjection = new DrawProjection();
  const drawService = new DrawService(
    eventStore,
    drawProjection,
    competitionProjection,
    classModelProjection,
    rosterProjection,
  );
  const scoringProjection = new ScoringProjection();
  const groupCompositionProvider = new DrawServiceGroupCompositionProvider(drawProjection);
  const scoringService = new ScoringService(
    eventStore,
    scoringProjection,
    classModelProjection,
    competitionProjection,
    groupCompositionProvider,
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
          pilotId: `pilot-${competitionId}-${i}`,
          pilotNumber: i + 1,
          pilotClass: null,
        },
        attribution,
      });
      rosterProjection.apply(record);
    }
  };

  // Ready an accepted single-task-class draw (F5J: min 6) with roundCount 1,
  // groupsPerRound 2 over n seats.
  const readyAcceptedCompetition = (
    classModelId: string,
    n: number,
    specOverrides: Partial<Record<string, unknown>> = {},
  ) => {
    const comp = makeCompetition(classModelId);
    seedRoster(comp.id, n);
    drawService.saveSpec(comp.id, specInput(specOverrides), attribution);
    const candidate = drawService.generate(comp.id, attribution);
    drawService.accept(comp.id, candidate.id, [], attribution);
    return { comp, candidate };
  };

  return {
    eventStore,
    drawService,
    scoringService,
    scoringProjection,
    drawProjection,
    makeCompetition,
    seedRoster,
    readyAcceptedCompetition,
  };
}

function firstGroupTaskId(draw: GeneratedDraw): string {
  return draw.rounds[0]!.taskGroups[0]!.taskId;
}

describe("ScoringService — STORY-001-011 capture + which-score-counts (AC5)", () => {
  it("AC5: entitled pilot's worse reflight still counts; the other pilot's better-of-two counts", () => {
    const { scoringService, readyAcceptedCompetition } = build();
    const { comp, candidate } = readyAcceptedCompetition(stockModelIdFor("F5J"), 12);
    const taskId = firstGroupTaskId(candidate);
    const group = candidate.rounds[0]!.groups.find((g) => g.flyingOrder === 1)!;
    const [john, jane] = group.members.map((m) => m.rosterEntryId);

    scoringService.captureResult(comp.id, { roundNumber: 1, taskId, rosterEntryId: john, raw: 850, resultKind: "original" }, attribution);
    scoringService.captureResult(comp.id, { roundNumber: 1, taskId, rosterEntryId: john, raw: 790, resultKind: "reflight" }, attribution);
    scoringService.captureResult(comp.id, { roundNumber: 1, taskId, rosterEntryId: jane, raw: 920, resultKind: "original" }, attribution);
    scoringService.captureResult(comp.id, { roundNumber: 1, taskId, rosterEntryId: jane, raw: 960, resultKind: "reflight" }, attribution);

    const view = scoringService.getGroupScore(comp.id, 1, taskId, 1);
    const johnEntry = view.entries.find((e) => e.rosterEntryId === john)!;
    const janeEntry = view.entries.find((e) => e.rosterEntryId === jane)!;
    expect(johnEntry.officialRaw).toBe(790);
    expect(johnEntry.countedResultKind).toBe("reflight");
    expect(janeEntry.officialRaw).toBe(960);
    expect(janeEntry.countedResultKind).toBe("reflight");
    expect(janeEntry.normalised).toBe(1000); // best raw anchors to 1000
    expect(view.lonePilotMode).toBeNull();
    expect(view.pendingAnnulmentOverride).toBe(false);
  });

  it("a repeated capture of the same kind supersedes (latest wins)", () => {
    const { scoringService, readyAcceptedCompetition } = build();
    const { comp, candidate } = readyAcceptedCompetition(stockModelIdFor("F5J"), 12);
    const taskId = firstGroupTaskId(candidate);
    const pilot = candidate.rounds[0]!.groups[0]!.members[0]!.rosterEntryId;

    scoringService.captureResult(comp.id, { roundNumber: 1, taskId, rosterEntryId: pilot, raw: 700, resultKind: "original" }, attribution);
    scoringService.captureResult(comp.id, { roundNumber: 1, taskId, rosterEntryId: pilot, raw: 750, resultKind: "original" }, attribution);

    const view = scoringService.getGroupScore(comp.id, 1, taskId, 1);
    expect(view.entries.find((e) => e.rosterEntryId === pilot)!.officialRaw).toBe(750);
  });
});

describe("ScoringService — STORY-001-011 lone-pilot resolution (AC6/AC7)", () => {
  it("AC6: a non-F3B singleton group resolves a dummy on first read, is replay-stable, and the dummy's own raw never surfaces", () => {
    const { scoringService, drawService, readyAcceptedCompetition } = build();
    // 12 seats / 2 groups = 6 each. Split off a lone pilot from group 1.
    const { comp, candidate } = readyAcceptedCompetition(stockModelIdFor("F5J"), 12);
    const taskId = firstGroupTaskId(candidate);
    const group1 = candidate.rounds[0]!.groups.find((g) => g.flyingOrder === 1)!;
    const loneId = group1.members[0]!.rosterEntryId;
    const view = drawService.splitGroup(
      comp.id,
      { roundNumber: 1, taskId, sourceGroupFlyingOrder: 1, movedRosterEntryIds: [loneId] },
      attribution,
    );
    const newGroup = view.rounds[0]!.groups.find((g) => g.members.length === 1)!;
    expect(newGroup.members[0]!.rosterEntryId).toBe(loneId);

    scoringService.captureResult(
      comp.id,
      { roundNumber: 1, taskId, rosterEntryId: loneId, raw: 800, resultKind: "original" },
      attribution,
    );

    const first = scoringService.getGroupScore(comp.id, 1, taskId, newGroup.flyingOrder);
    expect(first.lonePilotMode).toBe("dummy");
    expect(first.pendingAnnulmentOverride).toBe(false);
    expect(first.entries).toHaveLength(1);
    expect(first.entries[0]!.rosterEntryId).toBe(loneId);
    // Dummy uncaptured → dummy raw 0 → lone pilot is the only positive raw →
    // normalises to 1000, but only because normaliseGroup ran the real
    // arithmetic, never a short-circuit (Safeguard 4).
    expect(first.entries[0]!.normalised).toBe(1000);

    const second = scoringService.getGroupScore(comp.id, 1, taskId, newGroup.flyingOrder);
    expect(second.entries[0]!.rosterEntryId).toBe(loneId);
    // Replay-stable: the same dummy resolution persists.
    expect(second).toEqual(first);
  });

  it("AC6: the lone pilot is NOT automatically 1000 when the dummy's own flight is better", () => {
    const { scoringService, scoringProjection, drawService, readyAcceptedCompetition } = build();
    const { comp, candidate } = readyAcceptedCompetition(stockModelIdFor("F5J"), 12);
    const taskId = firstGroupTaskId(candidate);
    const group1 = candidate.rounds[0]!.groups.find((g) => g.flyingOrder === 1)!;
    const loneId = group1.members[0]!.rosterEntryId;
    const view = drawService.splitGroup(
      comp.id,
      { roundNumber: 1, taskId, sourceGroupFlyingOrder: 1, movedRosterEntryIds: [loneId] },
      attribution,
    );
    const newGroup = view.rounds[0]!.groups.find((g) => g.members.length === 1)!;

    scoringService.captureResult(
      comp.id,
      { roundNumber: 1, taskId, rosterEntryId: loneId, raw: 500, resultKind: "original" },
      attribution,
    );
    // Trigger dummy resolution first (captures the dummy id), then give the
    // dummy a better flight than the lone pilot.
    const first = scoringService.getGroupScore(comp.id, 1, taskId, newGroup.flyingOrder);
    const dummyId = scoringProjection.getLonePilotResolution(comp.id, 1, taskId, newGroup.flyingOrder)!.dummyRosterEntryId!;
    scoringService.captureResult(
      comp.id,
      { roundNumber: 1, taskId, rosterEntryId: dummyId, raw: 1000, resultKind: "original" },
      attribution,
    );

    const rescored = scoringService.getGroupScore(comp.id, 1, taskId, newGroup.flyingOrder);
    expect(rescored.entries[0]!.normalised).toBe(500); // 500/1000 * 1000
    expect(rescored.entries[0]!.normalised).not.toBe(1000);
    expect(first.entries[0]!.rosterEntryId).toBe(loneId);
  });

  it("AC7: an F3B group resolving to one valid result annuls pending CD override, never chooses a dummy", () => {
    const { scoringService, drawService, readyAcceptedCompetition } = build();
    const { comp, candidate } = readyAcceptedCompetition(stockModelIdFor("F3B"), 20);
    const speedTaskGroup = candidate.rounds[0]!.taskGroups.find((tg) => tg.taskName === "Speed")!;
    // Speed collapses to a single all-competitors group by its own escape —
    // split it down to a singleton to exercise AC7 directly.
    const wholeGroup = speedTaskGroup.groups[0]!;
    const loneId = wholeGroup.members[0]!.rosterEntryId;
    const others = wholeGroup.members.slice(1).map((m) => m.rosterEntryId);
    const view = drawService.splitGroup(
      comp.id,
      { roundNumber: 1, taskId: speedTaskGroup.taskId, sourceGroupFlyingOrder: wholeGroup.flyingOrder, movedRosterEntryIds: others },
      attribution,
    );
    const singleton = view.rounds[0]!.groups.find((g) => g.members.length === 1)!;
    expect(singleton.members[0]!.rosterEntryId).toBe(loneId);

    const result = scoringService.getGroupScore(comp.id, 1, speedTaskGroup.taskId, singleton.flyingOrder);
    expect(result.pendingAnnulmentOverride).toBe(true);
    expect(result.entries).toEqual([]);
    expect(result.lonePilotMode).toBe("annul");

    const again = scoringService.getGroupScore(comp.id, 1, speedTaskGroup.taskId, singleton.flyingOrder);
    expect(again).toEqual(result); // still annulled, not re-rolled to a dummy
  });
});

describe("ScoringProjection — determinism", () => {
  it("rebuilding from the log reproduces identical captured results and lone-pilot resolutions", () => {
    const { eventStore, scoringService, drawService, scoringProjection, readyAcceptedCompetition } = build();
    const { comp, candidate } = readyAcceptedCompetition(stockModelIdFor("F5J"), 12);
    const taskId = firstGroupTaskId(candidate);
    const group1 = candidate.rounds[0]!.groups.find((g) => g.flyingOrder === 1)!;
    const loneId = group1.members[0]!.rosterEntryId;
    const view = drawService.splitGroup(
      comp.id,
      { roundNumber: 1, taskId, sourceGroupFlyingOrder: 1, movedRosterEntryIds: [loneId] },
      attribution,
    );
    const newGroup = view.rounds[0]!.groups.find((g) => g.members.length === 1)!;
    scoringService.captureResult(comp.id, { roundNumber: 1, taskId, rosterEntryId: loneId, raw: 500, resultKind: "original" }, attribution);
    scoringService.getGroupScore(comp.id, 1, taskId, newGroup.flyingOrder); // triggers dummy resolution

    const fresh = new ScoringProjection();
    fresh.rebuild(eventStore.readAll());
    expect(fresh.getResults(comp.id, 1, taskId, loneId)).toEqual(scoringProjection.getResults(comp.id, 1, taskId, loneId));
    expect(fresh.getLonePilotResolution(comp.id, 1, taskId, newGroup.flyingOrder)).toEqual(
      scoringProjection.getLonePilotResolution(comp.id, 1, taskId, newGroup.flyingOrder),
    );
  });
});

// End-to-end over the real app wiring: seam activation (a flown seat can
// never be replaced) only becomes real once the ProjectionEntryScoresProvider
// default is wired in (app.ts) and a genuine capture exists.
describe("scoring routes + roster seam activation (STORY-001-011)", () => {
  it("capturing a result for a seat then blocks removing/replacing that seat", async () => {
    const app = buildApp({ dbPath: ":memory:" });
    const compRes = await app.inject({
      method: "POST",
      url: "/api/competitions",
      payload: { name: "Seam Cup", date: "2026-09-12", venue: null, classModelId: stockModelIdFor("F5J") },
    });
    const competitionId = compRes.json().id as string;

    const entryIds: string[] = [];
    const pilotIds: string[] = [];
    for (let i = 0; i < 13; i++) {
      const pilotRes = await app.inject({ method: "POST", url: "/api/pilots", payload: { name: `Pilot ${i}` } });
      pilotIds.push(pilotRes.json().id as string);
    }
    for (let i = 0; i < 12; i++) {
      const added = await app.inject({
        method: "POST",
        url: `/api/competitions/${competitionId}/roster`,
        payload: { pilotId: pilotIds[i] },
      });
      entryIds.push(added.json().id as string);
    }

    await app.inject({
      method: "PUT",
      url: `/api/competitions/${competitionId}/draw/spec`,
      payload: specInput(),
    });
    const generated = await app.inject({ method: "POST", url: `/api/competitions/${competitionId}/draw/generate` });
    const drawId = generated.json().id as string;
    await app.inject({
      method: "POST",
      url: `/api/competitions/${competitionId}/draw/accept`,
      payload: { drawId },
      headers: { "x-actor-name": "the CD" },
    });

    const round = generated.json().rounds[0];
    const taskId = round.taskGroups[0].taskId;
    const targetEntryId = round.groups[0].members[0].rosterEntryId as string;

    // Before any capture: removal is still gated by the accepted draw (005),
    // but the seat has NOT yet flown, so remove-requires-replacement applies
    // rather than the flown-seat block — confirm replace succeeds pre-capture.
    const preCaptureReplace = await app.inject({
      method: "POST",
      url: `/api/competitions/${competitionId}/roster/${targetEntryId}/replace`,
      payload: { pilotId: pilotIds[12], confirmDrawAffected: true },
    });
    expect(preCaptureReplace.statusCode).toBe(200);

    // Capture a result for the (now-replaced) seat — the seat id is stable
    // across replacement (RD4), so it still resolves against the effective
    // draw composition.
    const captured = await app.inject({
      method: "POST",
      url: `/api/competitions/${competitionId}/scoring/results`,
      payload: { roundNumber: 1, taskId, rosterEntryId: targetEntryId, raw: 900, resultKind: "original" },
    });
    expect(captured.statusCode).toBe(200);

    const blockedReplace = await app.inject({
      method: "POST",
      url: `/api/competitions/${competitionId}/roster/${targetEntryId}/replace`,
      payload: { pilotId: pilotIds[0], confirmDrawAffected: true },
    });
    expect(blockedReplace.statusCode).toBe(409);
    expect(blockedReplace.json().code).toBe("ROSTER_ENTRY_HAS_FLOWN");

    await app.close();
  });

  it("error mapping: capturing against an unseated roster entry is 404 CAPTURE_TARGET_NOT_FOUND", async () => {
    const app = buildApp({ dbPath: ":memory:" });
    const compRes = await app.inject({
      method: "POST",
      url: "/api/competitions",
      payload: { name: "Error Cup", date: "2026-09-12", venue: null, classModelId: stockModelIdFor("F5J") },
    });
    const competitionId = compRes.json().id as string;
    const response = await app.inject({
      method: "POST",
      url: `/api/competitions/${competitionId}/scoring/results`,
      payload: { roundNumber: 1, taskId: "whatever", rosterEntryId: "nope", raw: 1, resultKind: "original" },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("CAPTURE_TARGET_NOT_FOUND");
    await app.close();
  });

  it("error mapping: group management errors on the draw routes map to their declared status", async () => {
    const app = buildApp({ dbPath: ":memory:" });
    const compRes = await app.inject({
      method: "POST",
      url: "/api/competitions",
      payload: { name: "Move Cup", date: "2026-09-12", venue: null, classModelId: stockModelIdFor("F5J") },
    });
    const competitionId = compRes.json().id as string;
    const notAccepted = await app.inject({
      method: "POST",
      url: `/api/competitions/${competitionId}/draw/groups/move`,
      payload: { roundNumber: 1, rosterEntryId: "x", toGroupFlyingOrder: 2 },
    });
    expect(notAccepted.statusCode).toBe(409);
    expect(notAccepted.json().code).toBe("DRAW_NOT_ACCEPTED");
    await app.close();
  });
});
