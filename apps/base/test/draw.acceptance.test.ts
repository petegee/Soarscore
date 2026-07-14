import { describe, expect, it } from "vitest";
import { stockModelIdFor } from "@soarscore/shared";
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
import { ProjectionDrawStateProvider } from "../src/draw/draw-state-provider.js";
import {
  DrawCandidateNotFoundError,
  DrawCandidateSupersededError,
} from "../src/draw/errors.js";
import { buildApp } from "../src/app.js";

// Accept/cancel are CD decisions (Area 4.3): the service-level tests pass a CD
// attribution the way the routes' cdAttributionFromHeaders builds it, and the
// authority assertions below guard against a copy-paste of the organiser
// helper (Safeguard 6 — a wrong authority is a silent AC1/AC7 failure).
const organiser = { actorName: "org", originClient: "test-client", authority: "organiser" };
const cd = { actorName: "the CD", originClient: "test-client", authority: "contest-director" };

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

// The draw.service.test slice, plus the real ProjectionDrawStateProvider under
// test (AC3's downstream consumer view of acceptance).
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
  const service = new DrawService(
    eventStore,
    drawProjection,
    competitionProjection,
    classModelProjection,
    rosterProjection,
  );
  const drawStateProvider = new ProjectionDrawStateProvider(drawProjection);

  const makeCompetition = () =>
    competitionService.create(
      { name: "Acceptance Cup", date: "2026-09-12", venue: "Rotorua", classModelId: stockModelIdFor("F5L") },
      organiser,
    );

  const seedRoster = (competitionId: string, n: number) => {
    for (let i = 0; i < n; i++) {
      const record = eventStore.append({
        scope: competitionId,
        type: "roster.entryAdded",
        payload: {
          id: `seat-${competitionId}-${i}`,
          competitionId,
          pilotId: `pilot-${i}`,
          pilotNumber: i + 1,
          pilotClass: null,
        },
        attribution: organiser,
      });
      rosterProjection.apply(record);
    }
  };

  // Spec + roster ready to generate.
  const readyCompetition = (n = 10) => {
    const comp = makeCompetition();
    seedRoster(comp.id, n);
    service.saveSpec(comp.id, specInput(), organiser);
    return comp;
  };

  return { eventStore, service, drawProjection, drawStateProvider, readyCompetition };
}

describe("DrawService accept/cancel (STORY-001-017)", () => {
  it("AC1: accepting the candidate commits it, recorded with contest-director authority", () => {
    const { service, eventStore, readyCompetition } = build();
    const comp = readyCompetition();
    const candidate = service.generate(comp.id, organiser);

    const view = service.accept(comp.id, candidate.id, [], cd);
    expect(view.status).toBe("accepted");
    expect(view.accepted).toEqual(candidate);

    const accepted = eventStore.readAll().filter((e) => e.type === "draw.accepted");
    expect(accepted).toHaveLength(1);
    // Reference-only promotion payload — never a re-copy of the outcome.
    expect(accepted[0]!.payload).toEqual({
      competitionId: comp.id,
      drawId: candidate.id,
      specId: candidate.specId,
      acknowledgedWarningIds: [],
    });
    // The authority guard (Safeguard 6): CD, not the app-wide organiser.
    expect(accepted[0]!.attribution.authority).toBe("contest-director");
    expect(accepted[0]!.attribution.actorName).toBe("the CD");
  });

  it("AC2: status walks no-draw → awaiting-decision → accepted across the lifecycle", () => {
    const { service, readyCompetition } = build();
    const comp = readyCompetition();
    expect(service.getEvidence(comp.id).status).toBe("no-draw");
    const candidate = service.generate(comp.id, organiser);
    expect(service.getEvidence(comp.id).status).toBe("awaiting-decision");
    service.accept(comp.id, candidate.id, [], cd);
    expect(service.getEvidence(comp.id).status).toBe("accepted");
  });

  it("AC3: accepted draw and hasAcceptedDraw become visible to downstream consumers only on accept", () => {
    const { service, drawStateProvider, readyCompetition } = build();
    const comp = readyCompetition();
    const candidate = service.generate(comp.id, organiser);

    // Generation alone is not acceptance (the 009/005 contract).
    expect(service.getEvidence(comp.id).accepted).toBeNull();
    expect(drawStateProvider.hasAcceptedDraw(comp.id)).toBe(false);

    service.accept(comp.id, candidate.id, [], cd);
    expect(service.getEvidence(comp.id).accepted?.id).toBe(candidate.id);
    expect(drawStateProvider.hasAcceptedDraw(comp.id)).toBe(true);
  });

  it("AC4: cancel discards the candidate, returns to no-draw/generatable, and is recorded", () => {
    const { service, eventStore, readyCompetition } = build();
    const comp = readyCompetition();
    const candidate = service.generate(comp.id, organiser);

    const view = service.cancel(comp.id, candidate.id, cd);
    expect(view.status).toBe("no-draw");
    expect(view.candidate).toBeNull();
    expect(view.accepted).toBeNull();
    // The spec is retained: generating again is possible (cancel → generate →
    // accept is a valid cycle; accept is allowed whenever a candidate awaits).
    expect(view.spec).not.toBeNull();
    const regenerated = service.generate(comp.id, organiser);
    expect(regenerated.id).not.toBe(candidate.id);
    const accepted = service.accept(comp.id, regenerated.id, [], cd);
    expect(accepted.status).toBe("accepted");

    const cancelled = eventStore.readAll().filter((e) => e.type === "draw.cancelled");
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0]!.payload).toEqual({ competitionId: comp.id, drawId: candidate.id });
    expect(cancelled[0]!.attribution.authority).toBe("contest-director");
    expect(cancelled[0]!.attribution.actorName).toBe("the CD");
  });

  it("AC5: accept with no candidate is rejected and appends nothing; cancel is symmetric", () => {
    const { service, eventStore, readyCompetition } = build();
    const comp = readyCompetition();
    const before = eventStore.readAll().length;
    expect(() => service.accept(comp.id, "any-id", [], cd)).toThrow(DrawCandidateNotFoundError);
    expect(() => service.cancel(comp.id, "any-id", cd)).toThrow(DrawCandidateNotFoundError);
    expect(eventStore.readAll().length).toBe(before);
  });

  it("AC6: a decision binds to the current candidate — a superseded id is rejected", () => {
    const { service, eventStore, readyCompetition } = build();
    const comp = readyCompetition();
    const first = service.generate(comp.id, organiser);
    const second = service.generate(comp.id, organiser);
    expect(second.id).not.toBe(first.id);

    const before = eventStore.readAll().length;
    expect(() => service.accept(comp.id, first.id, [], cd)).toThrow(DrawCandidateSupersededError);
    expect(() => service.cancel(comp.id, first.id, cd)).toThrow(DrawCandidateSupersededError);
    expect(eventStore.readAll().length).toBe(before);

    const view = service.accept(comp.id, second.id, [], cd);
    expect(view.accepted?.id).toBe(second.id);
    // No accepted state references the superseded attempt.
    expect(view.accepted?.id).not.toBe(first.id);
  });

  it("AC7: the immutable log carries the decision events with actor and authority", () => {
    const { service, eventStore, readyCompetition } = build();
    const comp = readyCompetition();
    const first = service.generate(comp.id, organiser);
    service.cancel(comp.id, first.id, cd);
    const second = service.generate(comp.id, organiser);
    service.accept(comp.id, second.id, [], cd);

    const all = eventStore.readAll();
    const decisions = all.filter(
      (e) => e.type === "draw.accepted" || e.type === "draw.cancelled",
    );
    expect(decisions.map((e) => e.type)).toEqual(["draw.cancelled", "draw.accepted"]);
    for (const event of decisions) {
      expect(event.scope).toBe(comp.id);
      expect(event.attribution.actorName).toBe("the CD");
      expect(event.attribution.authority).toBe("contest-director");
    }
  });

  it("determinism: a fresh projection rebuilt from the log reproduces accepted + candidate state (D4)", () => {
    const { service, eventStore, drawProjection, readyCompetition } = build();
    const comp = readyCompetition();
    const candidate = service.generate(comp.id, organiser);
    service.accept(comp.id, candidate.id, [], cd);

    const fresh = new DrawProjection();
    fresh.rebuild(eventStore.readAll());
    expect(fresh.getAccepted(comp.id)).toEqual(drawProjection.getAccepted(comp.id));
    expect(fresh.getAccepted(comp.id)).toEqual(candidate);
    expect(fresh.getCandidate(comp.id)).toEqual(drawProjection.getCandidate(comp.id));
    expect(fresh.hasAccepted(comp.id)).toBe(true);
  });
});

// End-to-end over the real app wiring: the routes stamp CD attribution, the
// error branches map to 409, and the real ProjectionDrawStateProvider default
// activates the STORY-001-005 roster remove/replace gates once a draw is
// accepted (Safeguard 5 — an intended, asserted behaviour of this story).
describe("draw acceptance routes + roster-gate activation (STORY-001-017)", () => {
  async function setup() {
    const app = buildApp({ dbPath: ":memory:" });
    const compRes = await app.inject({
      method: "POST",
      url: "/api/competitions",
      payload: {
        name: "Gate Cup",
        date: "2026-09-12",
        venue: null,
        classModelId: stockModelIdFor("F5L"),
      },
    });
    const competitionId = compRes.json().id as string;

    const entryIds: string[] = [];
    const pilotIds: string[] = [];
    for (let i = 0; i < 11; i++) {
      const pilotRes = await app.inject({
        method: "POST",
        url: "/api/pilots",
        payload: { name: `Pilot ${i}` },
      });
      pilotIds.push(pilotRes.json().id as string);
    }
    // Roster the first 10; pilot 11 stays free as replacement material.
    for (let i = 0; i < 10; i++) {
      const added = await app.inject({
        method: "POST",
        url: `/api/competitions/${competitionId}/roster`,
        payload: { pilotId: pilotIds[i] },
      });
      entryIds.push(added.json().id as string);
    }

    const specRes = await app.inject({
      method: "PUT",
      url: `/api/competitions/${competitionId}/draw/spec`,
      payload: specInput(),
    });
    expect(specRes.statusCode).toBe(200);
    return { app, competitionId, entryIds, pilotIds, sparePilotId: pilotIds[10]! };
  }

  it("accept/cancel routes return the updated evidence view; a merely generated draw leaves the gates inert", async () => {
    const { app, competitionId, entryIds, pilotIds, sparePilotId } = await setup();
    // The remove below frees pilot 9's seat, so pilot 9 is the post-accept
    // replacement material (the spare is consumed by the pre-accept replace).
    const freedPilotId = pilotIds[9]!;

    const generated = await app.inject({
      method: "POST",
      url: `/api/competitions/${competitionId}/draw/generate`,
    });
    expect(generated.statusCode).toBe(200);
    const drawId = generated.json().id as string;

    // Generation ≠ acceptance: remove and replace still succeed (005 contract).
    const removed = await app.inject({
      method: "DELETE",
      url: `/api/competitions/${competitionId}/roster/${entryIds[9]}`,
    });
    expect(removed.statusCode).toBe(204);
    const replaced = await app.inject({
      method: "POST",
      url: `/api/competitions/${competitionId}/roster/${entryIds[8]}/replace`,
      payload: { pilotId: sparePilotId },
    });
    expect(replaced.statusCode).toBe(200);
    expect(replaced.json().drawAffected).toBe(false);

    // Cancel, then re-generate and accept (a valid cycle).
    const cancelled = await app.inject({
      method: "POST",
      url: `/api/competitions/${competitionId}/draw/cancel`,
      payload: { drawId },
      headers: { "x-actor-name": "the CD" },
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json()).toMatchObject({ status: "no-draw", candidate: null, accepted: null });

    const regenerated = await app.inject({
      method: "POST",
      url: `/api/competitions/${competitionId}/draw/generate`,
    });
    const newDrawId = regenerated.json().id as string;
    const accepted = await app.inject({
      method: "POST",
      url: `/api/competitions/${competitionId}/draw/accept`,
      payload: { drawId: newDrawId },
      headers: { "x-actor-name": "the CD" },
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().status).toBe("accepted");
    expect(accepted.json().accepted.id).toBe(newDrawId);

    // The GET evidence read-model carries the new fields.
    const evidence = await app.inject({
      method: "GET",
      url: `/api/competitions/${competitionId}/draw`,
    });
    expect(evidence.json().status).toBe("accepted");
    expect(evidence.json().accepted.id).toBe(newDrawId);

    // Gate activation (Safeguard 5): with an accepted draw, remove is refused
    // and replace demands confirmation — the 005 gates, now live by design.
    const gatedRemove = await app.inject({
      method: "DELETE",
      url: `/api/competitions/${competitionId}/roster/${entryIds[0]}`,
    });
    expect(gatedRemove.statusCode).toBe(409);
    expect(gatedRemove.json().code).toBe("ROSTER_REMOVE_REQUIRES_REPLACEMENT");

    const gatedReplace = await app.inject({
      method: "POST",
      url: `/api/competitions/${competitionId}/roster/${entryIds[0]}/replace`,
      payload: { pilotId: freedPilotId },
    });
    expect(gatedReplace.statusCode).toBe(409);
    expect(gatedReplace.json().code).toBe("ROSTER_REPLACE_AFFECTS_DRAW");

    // The acknowledged path stays open (RD4: the seat carries slots forward).
    const confirmedReplace = await app.inject({
      method: "POST",
      url: `/api/competitions/${competitionId}/roster/${entryIds[0]}/replace`,
      payload: { pilotId: freedPilotId, confirmDrawAffected: true },
    });
    expect(confirmedReplace.statusCode).toBe(200);
    expect(confirmedReplace.json().drawAffected).toBe(true);

    await app.close();
  });

  it("error mapping: accept with no candidate is 409 DRAW_CANDIDATE_NOT_FOUND, a stale id 409 DRAW_CANDIDATE_SUPERSEDED", async () => {
    const { app, competitionId } = await setup();

    const noCandidate = await app.inject({
      method: "POST",
      url: `/api/competitions/${competitionId}/draw/accept`,
      payload: { drawId: "nope" },
    });
    expect(noCandidate.statusCode).toBe(409);
    expect(noCandidate.json().code).toBe("DRAW_CANDIDATE_NOT_FOUND");

    const first = await app.inject({
      method: "POST",
      url: `/api/competitions/${competitionId}/draw/generate`,
    });
    const staleId = first.json().id as string;
    await app.inject({
      method: "POST",
      url: `/api/competitions/${competitionId}/draw/generate`,
    });

    const superseded = await app.inject({
      method: "POST",
      url: `/api/competitions/${competitionId}/draw/accept`,
      payload: { drawId: staleId },
    });
    expect(superseded.statusCode).toBe(409);
    expect(superseded.json().code).toBe("DRAW_CANDIDATE_SUPERSEDED");

    // Structural failure maps to 400 (Norm 2), not 500.
    const missingId = await app.inject({
      method: "POST",
      url: `/api/competitions/${competitionId}/draw/accept`,
      payload: {},
    });
    expect(missingId.statusCode).toBe(400);
    expect(missingId.json().code).toBe("VALIDATION_FAILED");

    await app.close();
  });
});
