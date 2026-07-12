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
  DrawGroupSizeWarningUnacknowledgedError,
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

  it("STORY-001-022: the rule-fixed minimum no longer hard-rejects at save; a genuine shortfall warns at generate instead (F3J's real minimum, 6)", () => {
    const { service, makeCompetition, seedRoster } = build();
    // F3J fixes minGroupSize 6. Previously (pre-STORY-001-022) an override of
    // 5 made this scenario throw at save; the override no longer has any
    // effect, and the rule-fixed minimum itself is no longer a save-time hard
    // bound (D14) — saveSpec now only enforces the D1 two-scoring-pilot floor.
    const comp = makeCompetition(stockModelIdFor("F3J"));
    seedRoster(comp.id, 14);
    const view = service.saveSpec(comp.id, specInput({ groupsPerRound: 4 }), attribution);
    expect(view.spec?.groupsPerRound).toBe(4);

    // At generate time, 4 groups over 14 seats (3 per group) falls short of
    // F3J's real minimum of 6 — the fallback search silently finds 2 groups
    // of 7, which DOES clear the minimum, so no warning is raised: the
    // fallback resolved the shortfall entirely, unlike the AC1 scenario below
    // where no grouping clears it.
    const draw = service.generate(comp.id, attribution);
    expect(draw.rounds[0]!.groups).toHaveLength(2);
    expect(draw.groupSizeWarnings).toEqual([]);
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

  it("AC7: the D1 floor (not the deprecated rule-fixed minimum) is what still applies with allowSingleGroup set", () => {
    const { service, makeCompetition, seedRoster } = build();
    // F3J fixes minGroupSize 6, but that no longer hard-rejects at save (D14)
    // — only the D1 two-scoring-pilot floor does. A roster of 10 supports at
    // most floor(10/2) = 5 groups under D1, so groupsPerRound 6 is still out
    // of bounds (409) even with the flag.
    const comp = makeCompetition(stockModelIdFor("F3J"));
    seedRoster(comp.id, 10);
    expect(() =>
      service.saveSpec(
        comp.id,
        specInput({ groupsPerRound: 6, allowSingleGroup: true }),
        attribution,
      ),
    ).toThrow(GroupSizeOutOfBoundsError);
    // groupsPerRound 2 is within the D1 ceiling (5) and now saveable — pre-022
    // this would have thrown because 10 seats over 2 groups (5 each) falls
    // short of F3J's minimum of 6; that shortfall is a generate-time warning
    // now, not a save-time rejection.
    const view = service.saveSpec(
      comp.id,
      specInput({ groupsPerRound: 2, allowSingleGroup: true }),
      attribution,
    );
    expect(view.spec?.groupsPerRound).toBe(2);
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

  it("STORY-001-019 fix: F3B's Speed 'or all competitors' escape auto-permits a single group for a roster of 8, without the spare-scorer override", () => {
    const { service, makeCompetition, seedRoster } = build();
    const comp = makeCompetition(stockModelIdFor("F3B"));
    seedRoster(comp.id, 8);
    // No allowSingleGroup flag set — F3B.1.8b's Speed rule (min 8 or all
    // competitors) makes a single group of all 8 legal on its own account.
    const view = service.saveSpec(comp.id, specInput({ groupsPerRound: 1 }), attribution);
    expect(view.spec?.groupsPerRound).toBe(1);
    expect(view.spec?.allowSingleGroup).toBe(true);
  });

  it("Bug fix (code review): F3B's per-group minimum shortfall (F3B.1.8b's 8) collapses to a single all-competitors group with NO warning, since F3B carries the 'or all competitors' escape", () => {
    const { service, makeCompetition, seedRoster } = build();
    const comp = makeCompetition(stockModelIdFor("F3B"));
    seedRoster(comp.id, 5);
    // A roster of 5 can never clear F3B.1.8b's numeric minimum of 8, however
    // grouped. D1 alone (maxByD1 = floor(5/2) = 2) permits groupsPerRound = 2,
    // so save succeeds.
    const view = service.saveSpec(comp.id, specInput({ groupsPerRound: 2 }), attribution);
    expect(view.spec?.groupsPerRound).toBe(2);

    const draw = service.generate(comp.id, attribution);
    // No G in [1, 1] clears the numeric minimum (floor(5/1) = 5 < 8), so the
    // fallback bottoms out at a single whole-roster group of all 5 — F3B
    // carries the "or all competitors" escape (modelAllowsAllCompetitorsFallback),
    // so a single group containing literally everyone is always rule-compliant
    // on its own account. There is no genuine shortfall here, so no warning.
    expect(draw.rounds[0]!.groups).toHaveLength(1);
    expect(draw.groupSizeWarnings).toEqual([]);
  });

  it("Bug fix (code review): F3J roster of 10, groupsPerRound 2, allowSingleGroup false — the fallback must NOT silently collapse to a single group without the D1 spare-scorer consent", () => {
    const { service, makeCompetition, seedRoster } = build();
    const comp = makeCompetition(stockModelIdFor("F3J"));
    seedRoster(comp.id, 10);
    // F3J's resolved minimum is 6. floor(10/2) = 5 < 6, so groupsPerRound = 2
    // falls short. F3J has no "or all competitors" escape, and allowSingleGroup
    // defaults to false (no spare-scorer consent given) — the fallback search
    // must not be allowed to use the numeric shortfall as a back door into an
    // ungated single group; it must bottom out at 2 groups instead, with a
    // warning reporting the best it could do.
    service.saveSpec(comp.id, specInput({ groupsPerRound: 2 }), attribution);
    const draw = service.generate(comp.id, attribution);
    expect(draw.rounds[0]!.groups).toHaveLength(2);
    expect(draw.groupSizeWarnings).toHaveLength(1);
    expect(draw.groupSizeWarnings[0]!.message).toContain("F3J.6.1");
    expect(draw.groupSizeWarnings[0]!.message).toContain("2 group(s) were generated instead");
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

describe("DrawService — STORY-001-022 warn-and-override group-size minima (D14)", () => {
  it("AC1: F3J roster of 5 generates successfully with a single group-size-minimum warning citing F3J.6", () => {
    const { service, makeCompetition, seedRoster } = build();
    const comp = makeCompetition(stockModelIdFor("F3J"));
    seedRoster(comp.id, 5);
    service.saveSpec(
      comp.id,
      specInput({ groupsPerRound: 1, allowSingleGroup: true }),
      attribution,
    );
    const draw = service.generate(comp.id, attribution);
    expect(draw.rounds[0]!.groups).toHaveLength(1);
    expect(draw.groupSizeWarnings).toHaveLength(1);
    const warning = draw.groupSizeWarnings[0]!;
    expect(warning.id).toBe("group-size-minimum");
    expect(warning.constraint).toBe("group-size-minimum");
    expect(warning.message).toContain("F3J.6");
    expect(warning.message).toContain("5");
    expect(warning.message).toContain("6");
  });

  it("AC3: accepting a candidate with an unacknowledged group-size-minimum warning is rejected, naming the warning", () => {
    const { service, makeCompetition, seedRoster } = build();
    const comp = makeCompetition(stockModelIdFor("F3J"));
    seedRoster(comp.id, 5);
    service.saveSpec(
      comp.id,
      specInput({ groupsPerRound: 1, allowSingleGroup: true }),
      attribution,
    );
    const candidate = service.generate(comp.id, attribution);
    expect(candidate.groupSizeWarnings).toHaveLength(1);

    let caught: unknown;
    try {
      service.accept(comp.id, candidate.id, [], attribution);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DrawGroupSizeWarningUnacknowledgedError);
    expect((caught as Error).message).toContain(candidate.groupSizeWarnings[0]!.message);
  });

  it("AC4: accepting with the warning id acknowledged succeeds, and the appended draw.accepted event records it", () => {
    const { service, makeCompetition, seedRoster, eventStore } = build();
    const comp = makeCompetition(stockModelIdFor("F3J"));
    seedRoster(comp.id, 5);
    service.saveSpec(
      comp.id,
      specInput({ groupsPerRound: 1, allowSingleGroup: true }),
      attribution,
    );
    const candidate = service.generate(comp.id, attribution);

    const view = service.accept(comp.id, candidate.id, ["group-size-minimum"], attribution);
    expect(view.status).toBe("accepted");

    const acceptedEvents = eventStore.readAll().filter((e) => e.type === "draw.accepted");
    expect(acceptedEvents).toHaveLength(1);
    expect(acceptedEvents[0]!.payload).toMatchObject({
      acknowledgedWarningIds: ["group-size-minimum"],
    });
  });

  it("AC5: F3J roster of 12 with groupsPerRound 2 meets the minimum exactly (12/2=6) — no warnings (inclusive boundary)", () => {
    const { service, makeCompetition, seedRoster } = build();
    const comp = makeCompetition(stockModelIdFor("F3J"));
    seedRoster(comp.id, 12);
    service.saveSpec(comp.id, specInput({ groupsPerRound: 2 }), attribution);
    const draw = service.generate(comp.id, attribution);
    expect(draw.rounds[0]!.groups).toHaveLength(2);
    expect(draw.groupSizeWarnings).toEqual([]);
  });

  it("AC6: classes with no rule-fixed minimum (F5K, F5L) never raise a group-size-minimum warning", () => {
    const { service, makeCompetition, seedRoster } = build();

    const f5k = makeCompetition(stockModelIdFor("F5K"));
    seedRoster(f5k.id, 3);
    service.saveSpec(f5k.id, specInput({ groupsPerRound: 1, allowSingleGroup: true }), attribution);
    expect(service.generate(f5k.id, attribution).groupSizeWarnings).toEqual([]);

    const f5l = makeCompetition(stockModelIdFor("F5L"));
    seedRoster(f5l.id, 3);
    service.saveSpec(f5l.id, specInput({ groupsPerRound: 1, allowSingleGroup: true }), attribution);
    expect(service.generate(f5l.id, attribution).groupSizeWarnings).toEqual([]);
  });

  it("Regression: minGroupSizeOverride has zero effect on generation or warnings now", () => {
    const { service, makeCompetition, seedRoster } = build();
    const comp = makeCompetition(stockModelIdFor("F3J"));
    seedRoster(comp.id, 5);
    service.saveSpec(
      comp.id,
      specInput({ groupsPerRound: 1, allowSingleGroup: true, minGroupSizeOverride: 999 }),
      attribution,
    );
    const draw = service.generate(comp.id, attribution);
    // Identical to the override-free AC1 scenario above: still one warning,
    // still citing the real rule-fixed minimum of 6, not the override.
    expect(draw.rounds[0]!.groups).toHaveLength(1);
    expect(draw.groupSizeWarnings).toHaveLength(1);
    expect(draw.groupSizeWarnings[0]!.message).toContain("F3J.6");
    expect(draw.groupSizeWarnings[0]!.message).toContain("6");
    expect(draw.groupSizeWarnings[0]!.message).not.toContain("999");
  });
});
