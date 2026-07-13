import { describe, expect, it } from "vitest";
import type { DrawSpecification } from "@soarscore/shared";
import { buildRequestBody, seedForm } from "./DrawSpecView.js";

// STORY-001-023 AC5: DrawSpecView retires the minGroupSizeOverride form
// field — STORY-001-022 superseded it as the mechanism for getting past a
// rule-fixed group-size minimum, and it now has zero effect on generation.
// DrawSpecView itself does its data fetch in a useEffect on mount, and like
// the rest of this repo's companion coverage there is no jsdom/React Testing
// Library harness to drive a full interactive render (see the equivalent
// note in DrawView.test.tsx) — so this file exercises the two pure
// functions that carry AC5's actual behaviour instead: seedForm (no longer
// produces a minGroupSizeOverride slot at all — proven at the type level,
// since SpecFormState has no such field) and buildRequestBody (always
// submits minGroupSizeOverride: null on the wire, regardless of what the
// loaded spec previously held). The field's absence from the JSX itself
// (the deleted spec-min-group-size label/input/hint/field-error block) is a
// static removal with no runtime conditional left to exercise.

function spec(overrides: Partial<DrawSpecification> = {}): DrawSpecification {
  return {
    id: "spec-1",
    competitionId: "comp-1",
    classModelId: "class-1",
    drawMode: "random-anti-repeat",
    roundCount: 4,
    groupsPerRound: 2,
    fairnessMetric: "min-max-then-excess",
    avoidConsecutiveFlights: false,
    lanePolicy: "rotate",
    minGroupSizeOverride: null,
    allowSingleGroup: false,
    ...overrides,
  };
}

describe("seedForm (AC5)", () => {
  it("seeds a form with no minGroupSizeOverride slot for a fresh (null) spec", () => {
    const form = seedForm(null);
    expect(form).not.toHaveProperty("minGroupSizeOverride");
  });

  it("seeds a form with no minGroupSizeOverride slot even for pre-story data with a saved override", () => {
    const form = seedForm(spec({ minGroupSizeOverride: 3 }));
    expect(form).not.toHaveProperty("minGroupSizeOverride");
    // The rest of the spec still round-trips into the form untouched.
    expect(form.roundCount).toBe("4");
    expect(form.groupsPerRound).toBe("2");
  });
});

describe("buildRequestBody (AC5)", () => {
  it("always submits minGroupSizeOverride: null, regardless of the loaded spec's prior value", () => {
    const formFromOverriddenSpec = seedForm(spec({ minGroupSizeOverride: 5 }));
    const body = buildRequestBody(formFromOverriddenSpec);
    expect(body.minGroupSizeOverride).toBeNull();
  });

  it("still submits all other SaveDrawSpecRequest fields (the shared schema requires the key, not the UI)", () => {
    const body = buildRequestBody(seedForm(null));
    expect(body.drawMode).toBe("random-anti-repeat");
    expect(body.roundCount).toBe(4);
    expect(body.groupsPerRound).toBe(2);
    expect(body.fairnessMetric).toBe("min-max-then-excess");
    expect(body.avoidConsecutiveFlights).toBe(false);
    expect(body.lanePolicy).toBe("rotate");
    expect(body.allowSingleGroup).toBe(false);
    expect(body.minGroupSizeOverride).toBeNull();
  });
});
