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
  DrawGenerationFailedError,
  DrawSpecNotFoundError,
  GroupSizeOutOfBoundsError,
  ValidationError,
} from "../src/draw/errors.js";

const attribution = { actorName: "tester", originClient: "test-client", authority: "organiser" };

// A well-formed spec input; individual tests override the fields they exercise.
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

// Build the slice: seeded models + a competition service + a roster projection
// we seed directly (roster.* events file under scope = competitionId) + the draw
// service under test, all sharing one store.
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

  // Seed a roster of `n` seats by appending roster.entryAdded events (the real
  // per-competition scope), so the draw service reads them like production.
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

  return { eventStore, service, drawProjection, makeCompetition, seedRoster };
}

// All the distinct (a,b) opponent pairs a seat is drawn against, across a draw.
function seatSet(draw: GeneratedDraw): Set<string> {
  const seats = new Set<string>();
  for (const round of draw.rounds) {
    for (const group of round.groups) {
      for (const m of group.members) seats.add(m.rosterEntryId);
    }
  }
  return seats;
}

describe("DrawService", () => {
  it("404s for an unknown competition", () => {
    const { service } = build();
    expect(() => service.getEvidence("nope")).toThrow(DrawSpecNotFoundError);
  });

  it("evidence is empty before any spec is saved", () => {
    const { service, makeCompetition } = build();
    const comp = makeCompetition(stockModelIdFor("F5J"));
    const view = service.getEvidence(comp.id);
    expect(view.spec).toBeNull();
    expect(view.candidate).toBeNull();
    expect(view.warnings).toEqual([]);
  });

  it("AC1: rejects groups-per-round that would force groups below the minimum, explaining the bound", () => {
    const { service, makeCompetition, seedRoster } = build();
    // F3J fixes minGroupSize 6; use an override of 5 to match the story's AC1
    // scenario (roster 14, min 5, groups-per-round 4 → only 2 groups of 7 valid).
    const comp = makeCompetition(stockModelIdFor("F3J"));
    seedRoster(comp.id, 14);
    expect(() =>
      service.saveSpec(comp.id, specInput({ groupsPerRound: 4, minGroupSizeOverride: 5 }), attribution),
    ).toThrow(GroupSizeOutOfBoundsError);
    // 2 groups of 7 is valid.
    const view = service.saveSpec(
      comp.id,
      specInput({ groupsPerRound: 2, minGroupSizeOverride: 5 }),
      attribution,
    );
    expect(view.spec?.groupsPerRound).toBe(2);
  });

  it("AC2: an over-constrained spec saves with populated warnings, not an error", () => {
    const { service, makeCompetition, seedRoster } = build();
    const comp = makeCompetition(stockModelIdFor("F5J"));
    seedRoster(comp.id, 12);
    // 6 rounds × 2 groups (group size 6) over 12 pilots: anti-repeat cannot be
    // fully satisfied, and 2 groups + no-back-to-back is tight — both warn.
    const view = service.saveSpec(
      comp.id,
      specInput({ roundCount: 6, groupsPerRound: 2, avoidConsecutiveFlights: true }),
      attribution,
    );
    expect(view.spec).not.toBeNull();
    const constraints = view.warnings.map((w) => w.constraint);
    expect(constraints).toContain("anti-repeat");
    expect(constraints).toContain("avoid-consecutive-flights");
  });

  it("AC3: generates all rounds honouring the no-back-to-back constraint, composition varying", () => {
    const { service, makeCompetition, seedRoster } = build();
    const comp = makeCompetition(stockModelIdFor("F5L"));
    seedRoster(comp.id, 12);
    service.saveSpec(
      comp.id,
      specInput({ roundCount: 8, groupsPerRound: 3, avoidConsecutiveFlights: true }),
      attribution,
    );
    const draw = service.generate(comp.id, attribution);
    expect(draw.rounds).toHaveLength(8);

    const G = 3;
    // No seat in the last group of round r appears in the first group of r+1.
    for (let r = 0; r < draw.rounds.length - 1; r++) {
      const lastGroup = draw.rounds[r]!.groups[G - 1]!;
      const firstNext = draw.rounds[r + 1]!.groups[0]!;
      const lastSeats = new Set(lastGroup.members.map((m) => m.rosterEntryId));
      for (const m of firstNext.members) {
        expect(lastSeats.has(m.rosterEntryId)).toBe(false);
      }
    }
    // Composition varies: round 1 and round 2 group-0 memberships are not identical.
    const r1g0 = draw.rounds[0]!.groups[0]!.members.map((m) => m.rosterEntryId).sort();
    const r2g0 = draw.rounds[1]!.groups[0]!.members.map((m) => m.rosterEntryId).sort();
    expect(r1g0).not.toEqual(r2g0);
    // Every seat is placed in every round.
    for (const round of draw.rounds) {
      const placed = round.groups.flatMap((g) => g.members.map((m) => m.rosterEntryId));
      expect(new Set(placed).size).toBe(12);
    }
  });

  it("AC4: retains the fairest attempt and exposes metric value + distribution", () => {
    const { service, makeCompetition, seedRoster } = build();
    const comp = makeCompetition(stockModelIdFor("F5L"));
    seedRoster(comp.id, 12);
    service.saveSpec(
      comp.id,
      specInput({ roundCount: 3, groupsPerRound: 3, fairnessMetric: "min-total-excess" }),
      attribution,
    );
    const draw = service.generate(comp.id, attribution);
    expect(draw.attemptsRun).toBe(200);
    expect(draw.metric).toBe("min-total-excess");
    // The exposed metric value is consistent with the exposed distribution (the
    // CD reads both for the accept/re-draw decision).
    expect(draw.metricValue).toBe(draw.distribution.totalExcessMeets);
    expect(draw.distribution.pairs.length).toBeGreaterThan(0);
    // Anti-repeat keeps the retained (fairest) attempt reasonably tight over 12
    // pilots × 3 rounds of 3 groups of 4 (54 meetings across 66 pairs). The
    // heuristic is "fairest of the attempts run", not a proven optimum, so this
    // is a graceful upper bound, not a zero-repeat demand.
    expect(draw.metricValue).toBeLessThanOrEqual(12);
  });

  it("AC5: an even roster yields no lone-pilot group", () => {
    const { service, makeCompetition, seedRoster } = build();
    const comp = makeCompetition(stockModelIdFor("F5L"));
    seedRoster(comp.id, 10);
    service.saveSpec(comp.id, specInput({ roundCount: 4, groupsPerRound: 2 }), attribution);
    const draw = service.generate(comp.id, attribution);
    for (const round of draw.rounds) {
      for (const group of round.groups) {
        expect(group.lonePilotFlagged).toBe(false);
        expect(group.members.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("AC6: an impossible spec fails clearly and appends nothing", () => {
    const { service, makeCompetition, seedRoster, eventStore } = build();
    const comp = makeCompetition(stockModelIdFor("F5J"));
    seedRoster(comp.id, 12);
    // 2 groups + no-back-to-back: a seat in group 2 cannot enter group 1 next
    // round, so it must stay in group 2 — over-constrained, no valid attempt.
    service.saveSpec(
      comp.id,
      specInput({ roundCount: 6, groupsPerRound: 2, avoidConsecutiveFlights: true }),
      attribution,
    );
    const before = eventStore.readAll().length;
    expect(() => service.generate(comp.id, attribution)).toThrow(DrawGenerationFailedError);
    expect(eventStore.readAll().length).toBe(before);
  });

  it("generate before a spec is saved 404s", () => {
    const { service, makeCompetition, seedRoster } = build();
    const comp = makeCompetition(stockModelIdFor("F5J"));
    seedRoster(comp.id, 10);
    expect(() => service.generate(comp.id, attribution)).toThrow(DrawSpecNotFoundError);
  });

  it("Determinism: a fresh projection rebuilt from the log yields the identical candidate", () => {
    const { service, makeCompetition, seedRoster, eventStore } = build();
    const comp = makeCompetition(stockModelIdFor("F5L"));
    seedRoster(comp.id, 12);
    service.saveSpec(comp.id, specInput({ roundCount: 4, groupsPerRound: 3 }), attribution);
    const generated = service.generate(comp.id, attribution);

    const fresh = new DrawProjection();
    fresh.rebuild(eventStore.readAll());
    // No re-randomisation on replay — byte-for-byte identical.
    expect(fresh.getCandidate(comp.id)).toEqual(generated);
    expect(seatSet(fresh.getCandidate(comp.id)!)).toEqual(seatSet(generated));
  });

  it("supersede: regenerating appends a new event and the projection holds only the latest", () => {
    const { service, makeCompetition, seedRoster, eventStore, drawProjection } = build();
    const comp = makeCompetition(stockModelIdFor("F5L"));
    seedRoster(comp.id, 12);
    service.saveSpec(comp.id, specInput({ roundCount: 3, groupsPerRound: 3 }), attribution);
    const first = service.generate(comp.id, attribution);
    const generatedEvents1 = eventStore.readAll().filter((e) => e.type === "draw.generated").length;
    const second = service.generate(comp.id, attribution);
    const generatedEvents2 = eventStore.readAll().filter((e) => e.type === "draw.generated").length;

    expect(generatedEvents2).toBe(generatedEvents1 + 1); // log retains both
    expect(second.id).not.toBe(first.id);
    expect(drawProjection.getCandidate(comp.id)!.id).toBe(second.id); // latest wins
  });

  it("AC7: a single group without the spare-scorer override is rejected, citing the override", () => {
    const { service, makeCompetition, seedRoster } = build();
    const comp = makeCompetition(stockModelIdFor("F5L"));
    seedRoster(comp.id, 6);
    let caught: unknown;
    try {
      service.saveSpec(comp.id, specInput({ groupsPerRound: 1 }), attribution);
    } catch (error) {
      caught = error;
    }
    // The Zod cross-field refine, not the roster-derived 409: a field error on
    // groupsPerRound naming the override as the way to permit a single group.
    expect(caught).toBeInstanceOf(ValidationError);
    const details = (caught as ValidationError).details as {
      fieldErrors: Record<string, string[]>;
    };
    expect(details.fieldErrors.groupsPerRound).toContain(
      "A round needs at least two groups unless the spare-scorer override is set",
    );
  });

  it("AC7: with allowSingleGroup the save is accepted and the flag persists through rebuild", () => {
    const { service, makeCompetition, seedRoster, eventStore } = build();
    const comp = makeCompetition(stockModelIdFor("F5L"));
    seedRoster(comp.id, 6);
    const view = service.saveSpec(
      comp.id,
      specInput({ roundCount: 2, groupsPerRound: 1, allowSingleGroup: true }),
      attribution,
    );
    expect(view.spec?.groupsPerRound).toBe(1);
    expect(view.spec?.allowSingleGroup).toBe(true);
    // The flag rides the draw.specSaved payload: a fresh projection rebuilt
    // from the log carries it, and it shows in the evidence view's spec.
    const fresh = new DrawProjection();
    fresh.rebuild(eventStore.readAll());
    expect(fresh.getSpec(comp.id)?.allowSingleGroup).toBe(true);
    expect(service.getEvidence(comp.id).spec?.allowSingleGroup).toBe(true);
  });

  it("AC7: all other bounds still apply with the override set", () => {
    const { service, makeCompetition, seedRoster } = build();
    // F3J fixes minGroupSize 6; a roster of 10 supports at most 1 group of ≥ 6,
    // so groupsPerRound 2 is still out of bounds (409) even with the flag —
    // the override relaxes only the two-group floor, not the per-group minimum
    // or the roster-derived ceiling.
    const comp = makeCompetition(stockModelIdFor("F3J"));
    seedRoster(comp.id, 10);
    expect(() =>
      service.saveSpec(
        comp.id,
        specInput({ groupsPerRound: 2, allowSingleGroup: true }),
        attribution,
      ),
    ).toThrow(GroupSizeOutOfBoundsError);
    // ...while the single group those 10 pilots CAN sustain is now saveable.
    const view = service.saveSpec(
      comp.id,
      specInput({ groupsPerRound: 1, allowSingleGroup: true }),
      attribution,
    );
    expect(view.spec?.groupsPerRound).toBe(1);
  });

  it("AC7: single group + no-back-to-back over multiple rounds warns at save (AC2)", () => {
    const { service, makeCompetition, seedRoster } = build();
    const comp = makeCompetition(stockModelIdFor("F5L"));
    seedRoster(comp.id, 6);
    const view = service.saveSpec(
      comp.id,
      specInput({
        roundCount: 3,
        groupsPerRound: 1,
        allowSingleGroup: true,
        avoidConsecutiveFlights: true,
      }),
      attribution,
    );
    // Strictly unsatisfiable — the round's only group is both last and first —
    // but a save constraint warning (AC2), never an error.
    expect(view.warnings.map((w) => w.constraint)).toContain("avoid-consecutive-flights");
  });

  it("re-saving a spec keeps its id stable", () => {
    const { service, makeCompetition, seedRoster } = build();
    const comp = makeCompetition(stockModelIdFor("F5L"));
    seedRoster(comp.id, 10);
    const first = service.saveSpec(comp.id, specInput({ roundCount: 3 }), attribution);
    const second = service.saveSpec(comp.id, specInput({ roundCount: 5 }), attribution);
    expect(second.spec?.id).toBe(first.spec?.id);
    expect(second.spec?.roundCount).toBe(5);
  });
});
