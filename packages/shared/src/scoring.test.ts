import { describe, expect, it } from "vitest";
import {
  computeFinalAggregate,
  deriveRoundScore,
  eligibleOtherPilots,
  normaliseGroup,
  selectOfficialResult,
  type AggregateInput,
  type GroupEntry,
  type GroupEntryWithResults,
  type NormaliseOptions,
} from "./scoring.js";

// Reusable degenerate fixtures (AC6/AC7/AC8 and inverted variants) so per-
// discipline scoring specs (STORY-001-008) echo these cases rather than
// re-implement them.
export const DEGENERATE_CASES = {
  // AC6 — an all-zero group normalises to all-0, no throw (both orientations).
  allZeroGroup: {
    entries: [
      { id: "a", raw: 0 },
      { id: "b", raw: 0 },
    ] as GroupEntry[],
    expectedNormalised: [0, 0],
  },
  // AC7 — tied best raws all map to exactly 1000 (non-inverted).
  tiedBest: {
    entries: [
      { id: "a", raw: 100 },
      { id: "b", raw: 100 },
      { id: "c", raw: 50 },
    ] as GroupEntry[],
    expectedNormalised: [1000, 1000, 500],
  },
  // AC7 — tied best times all map to 1000 (inverted speed, lower is better).
  tiedBestInverted: {
    entries: [
      { id: "a", raw: 60 },
      { id: "b", raw: 60 },
      { id: "c", raw: 120 },
    ] as GroupEntry[],
    options: { speedInverted: true } as NormaliseOptions,
    expectedNormalised: [1000, 1000, 500],
  },
  // AC5 — the lowest round is dropped but its penalty is still deducted.
  penaltyRetainedThroughDrop: {
    input: {
      series: [[300, 900, 50, 700]],
      penaltyTotal: 100,
      dropWorst: { threshold: 3, unit: "round" },
    } as AggregateInput,
    expected: {
      aggregate: 1800,
      grossBeforePenalty: 1900,
      penaltyApplied: 100,
      droppedValues: [50],
    },
  },
  // AC8 — a penalty larger than the gross floors the aggregate at zero, but the
  // full penalty is still recorded.
  negativeFloorsAtZero: {
    input: {
      series: [[250, 250, 250]],
      penaltyTotal: 900,
      dropWorst: { threshold: 5, unit: "round" },
    } as AggregateInput,
    expected: {
      aggregate: 0,
      grossBeforePenalty: 750,
      penaltyApplied: 900,
      droppedValues: [] as number[],
    },
  },
} as const;

describe("normaliseGroup — AC6 all-zero group", () => {
  it("returns all-0 for an all-zero group (non-inverted), no throw", () => {
    const { entries } = DEGENERATE_CASES.allZeroGroup;
    const result = normaliseGroup(entries, {});
    expect(result.map((e) => e.normalised)).toEqual([0, 0]);
  });

  it("returns all-0 for an all-zero group (inverted speed), no throw", () => {
    const { entries } = DEGENERATE_CASES.allZeroGroup;
    const result = normaliseGroup(entries, { speedInverted: true });
    expect(result.map((e) => e.normalised)).toEqual([0, 0]);
  });

  it("returns [] for an empty group", () => {
    expect(normaliseGroup([], {})).toEqual([]);
  });
});

describe("normaliseGroup — AC7 tied best", () => {
  it("maps tied best raws to exactly 1000 (non-inverted)", () => {
    const { entries, expectedNormalised } = DEGENERATE_CASES.tiedBest;
    const result = normaliseGroup(entries, {});
    expect(result.map((e) => e.normalised)).toEqual(expectedNormalised);
  });

  it("maps tied best times to exactly 1000 (inverted speed)", () => {
    const { entries, options, expectedNormalised } = DEGENERATE_CASES.tiedBestInverted;
    const result = normaliseGroup(entries, options);
    expect(result.map((e) => e.normalised)).toEqual(expectedNormalised);
  });

  it("preserves input order and ids", () => {
    const { entries } = DEGENERATE_CASES.tiedBest;
    const result = normaliseGroup(entries, {});
    expect(result.map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(result.map((e) => e.raw)).toEqual([100, 100, 50]);
  });

  it("normalises a raw <= 0 entry to 0 among valid entries (non-inverted)", () => {
    const result = normaliseGroup(
      [
        { id: "a", raw: 800 },
        { id: "b", raw: 0 },
      ],
      {},
    );
    expect(result.map((e) => e.normalised)).toEqual([1000, 0]);
  });

  it("normalises a raw <= 0 entry to 0 among valid entries (inverted)", () => {
    const result = normaliseGroup(
      [
        { id: "a", raw: 60 },
        { id: "b", raw: 0 },
      ],
      { speedInverted: true },
    );
    expect(result.map((e) => e.normalised)).toEqual([1000, 0]);
  });
});

describe("normaliseGroup — rounding", () => {
  it("default precision 0 yields whole points at a fractional boundary", () => {
    // 50/150 * 1000 = 333.33… → 333 at whole points.
    const result = normaliseGroup(
      [
        { id: "a", raw: 150 },
        { id: "b", raw: 50 },
      ],
      {},
    );
    expect(result.map((e) => e.normalised)).toEqual([1000, 333]);
  });

  it("precision 1 yields one-decimal normalised values", () => {
    const result = normaliseGroup(
      [
        { id: "a", raw: 150 },
        { id: "b", raw: 50 },
      ],
      { precision: 1 },
    );
    expect(result.map((e) => e.normalised)).toEqual([1000, 333.3]);
  });
});

describe("deriveRoundScore", () => {
  it("single-group returns the one partial", () => {
    expect(deriveRoundScore([1000], "single-group")).toBe(1000);
  });

  it("single-group returns 0 for empty partials", () => {
    expect(deriveRoundScore([], "single-group")).toBe(0);
  });

  it("separate-per-task sums the three task partials (F3B)", () => {
    expect(deriveRoundScore([1000, 800, 900], "separate-per-task")).toBe(2700);
  });

  it("separate-per-task returns 0 for empty partials", () => {
    expect(deriveRoundScore([], "separate-per-task")).toBe(0);
  });
});

describe("computeFinalAggregate — AC5 penalty retained through drop", () => {
  it("drops the lowest round but still deducts its penalty", () => {
    const { input, expected } = DEGENERATE_CASES.penaltyRetainedThroughDrop;
    expect(computeFinalAggregate(input)).toEqual(expected);
  });
});

describe("computeFinalAggregate — AC8 negative floors at zero", () => {
  it("floors at zero while recording the full penalty", () => {
    const { input, expected } = DEGENERATE_CASES.negativeFloorsAtZero;
    expect(computeFinalAggregate(input)).toEqual(expected);
  });
});

describe("computeFinalAggregate — drop-worst boundary", () => {
  it("drops nothing when length equals the threshold (not strictly greater)", () => {
    const result = computeFinalAggregate({
      series: [[300, 400, 500, 200]],
      penaltyTotal: 0,
      dropWorst: { threshold: 4, unit: "round" },
    });
    expect(result.droppedValues).toEqual([]);
    expect(result.grossBeforePenalty).toBe(1400);
    expect(result.aggregate).toBe(1400);
  });

  it("contributes 0 and drops nothing for an empty inner series", () => {
    const result = computeFinalAggregate({
      series: [[]],
      penaltyTotal: 0,
      dropWorst: { threshold: 3, unit: "round" },
    });
    expect(result.droppedValues).toEqual([]);
    expect(result.grossBeforePenalty).toBe(0);
    expect(result.aggregate).toBe(0);
  });
});

describe("selectOfficialResult — STORY-001-011 AC5 which-score-counts", () => {
  it("no results → 0", () => {
    expect(selectOfficialResult({ rosterEntryId: "a", results: [] }, false, false)).toBe(0);
  });

  it("one result → that result's raw", () => {
    const entry: GroupEntryWithResults = {
      rosterEntryId: "a",
      results: [{ raw: 850, resultKind: "original" }],
    };
    expect(selectOfficialResult(entry, false, false)).toBe(850);
  });

  it("entitled pilot with two results counts the reflight, even if worse", () => {
    const entry: GroupEntryWithResults = {
      rosterEntryId: "john",
      results: [
        { raw: 850, resultKind: "original" },
        { raw: 790, resultKind: "reflight" },
      ],
    };
    expect(selectOfficialResult(entry, true, false)).toBe(790);
  });

  it("non-entitled pilot with two results counts the better one (non-inverted)", () => {
    const entry: GroupEntryWithResults = {
      rosterEntryId: "jane",
      results: [
        { raw: 920, resultKind: "original" },
        { raw: 960, resultKind: "reflight" },
      ],
    };
    expect(selectOfficialResult(entry, false, false)).toBe(960);
  });

  it("non-entitled pilot with two results counts the better one (speed-inverted — lower wins)", () => {
    const entry: GroupEntryWithResults = {
      rosterEntryId: "jane",
      results: [
        { raw: 45.2, resultKind: "original" },
        { raw: 44.9, resultKind: "reflight" },
      ],
    };
    expect(selectOfficialResult(entry, false, true)).toBe(44.9);
  });
});

describe("eligibleOtherPilots — the shared exclusion filter", () => {
  it("excludes every id in excludeIds and keeps the rest", () => {
    const result = eligibleOtherPilots(["a", "b", "c", "d"], new Set(["a", "c"]));
    expect(result).toEqual(["b", "d"]);
  });

  it("returns [] when everyone is excluded", () => {
    expect(eligibleOtherPilots(["a", "b"], new Set(["a", "b"]))).toEqual([]);
  });
});

describe("computeFinalAggregate — F3B per-task drop", () => {
  it("drops one lowest per task series (threshold 5, 6 rounds each)", () => {
    const result = computeFinalAggregate({
      series: [
        [1000, 900, 800, 700, 600, 500], // Duration — drop 500
        [950, 850, 750, 650, 550, 450], // Distance — drop 450
        [1000, 990, 980, 970, 960, 100], // Speed — drop 100
      ],
      penaltyTotal: 0,
      dropWorst: { threshold: 5, unit: "task" },
    });
    expect(result.droppedValues).toEqual([500, 450, 100]);
    // Sum of all elements minus the three dropped lowest.
    const totalAll = 1000 + 900 + 800 + 700 + 600 + 500 + 950 + 850 + 750 + 650 + 550 + 450 + 1000 + 990 + 980 + 970 + 960 + 100;
    expect(result.grossBeforePenalty).toBe(totalAll - (500 + 450 + 100));
    expect(result.aggregate).toBe(result.grossBeforePenalty);
  });
});
