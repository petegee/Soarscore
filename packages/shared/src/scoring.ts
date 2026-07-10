import type { ClassModelBasis, DropWorstRule } from "./class-model.js";

// Discipline-agnostic scoring computation (STORY-001-007 / D12 / NFR-1). These
// are the pure functions that turn raw group results plus a ContestClassModel's
// scoring shape into normalised group scores, round scores, and a final per-pilot
// aggregate. There is *no* per-class branching here: every number is read from
// the injected model (basis / speedInverted / dropWorst), so adding a class adds
// no code (NFR-2). No I/O, no events, no throwing on degenerate domain inputs —
// a group of all-zeros or a negative aggregate resolves to a *defined* value, not
// an exception. Raw-score assembly (points-per-second, landing bonus, launch
// height) is upstream (STORY-001-008); this module consumes the raws as given.

// One competitor's raw result within a single group. `raw <= 0` means "no valid
// score / no valid time" and always normalises to 0.
export interface GroupEntry {
  id: string;
  raw: number;
}

// A group entry with its computed normalised score (best-of-group anchored to
// 1000). Input order is preserved.
export interface NormalisedEntry {
  id: string;
  raw: number;
  normalised: number;
}

// `speedInverted` mirrors the model flag (lower raw is better — speed tasks).
// `precision` is decimal places for the normalised value; default 0 (whole
// points). Per-class rounding refinement is deferred to per-discipline stories.
export interface NormaliseOptions {
  speedInverted?: boolean;
  precision?: number;
}

// The final-aggregate input. `series` is one array per counting stream: a single
// series of round scores for `unit === "round"`, or one series per task (its
// partials across rounds) for `unit === "task"` (F3B). `penaltyTotal` is tracked
// *outside* the series so a dropped round can never discard its penalty (AC5).
export interface AggregateInput {
  series: number[][];
  penaltyTotal: number;
  dropWorst: DropWorstRule;
}

// The aggregate plus the audit-relevant intermediates. `grossBeforePenalty` is
// the sum of survivors after drop-worst; `penaltyApplied` is the full penalty
// (retained even when it exceeds the gross, AC8); `droppedValues` is what
// drop-worst removed, for the report.
export interface AggregateResult {
  aggregate: number;
  grossBeforePenalty: number;
  penaltyApplied: number;
  droppedValues: number[];
}

// The single place rounding is defined (Norm 5). Negative precision is programmer
// misuse, not valid domain data — clamp it to whole points rather than throw
// (Norm 2 prefers clamping).
function round(value: number, precision: number): number {
  const places = precision > 0 ? precision : 0;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

// Group normalisation: ratio scaling to a best-of-group anchor of 1000. Never
// divides by zero — a group with no valid anchor returns all-0 (AC6). Tied best
// raws all map to exactly 1000 (AC7).
export function normaliseGroup(
  entries: GroupEntry[],
  options: NormaliseOptions,
): NormalisedEntry[] {
  if (entries.length === 0) return [];
  const precision = options.precision ?? 0;

  if (options.speedInverted) {
    // Speed task — lower is better. Only entries with a positive time are valid.
    const validRaws = entries.filter((e) => e.raw > 0).map((e) => e.raw);
    if (validRaws.length === 0) {
      // No valid times at all (AC6 inverted variant) — everyone scores 0.
      return entries.map((e) => ({ id: e.id, raw: e.raw, normalised: 0 }));
    }
    const best = Math.min(...validRaws);
    return entries.map((e) => ({
      id: e.id,
      raw: e.raw,
      normalised: e.raw > 0 ? round((best / e.raw) * 1000, precision) : 0,
    }));
  }

  // Non-inverted — higher is better; best raw anchors to 1000.
  const best = Math.max(...entries.map((e) => e.raw));
  if (best <= 0) {
    // All-zero / all-non-positive group (AC6) — everyone scores 0, no division.
    return entries.map((e) => ({ id: e.id, raw: e.raw, normalised: 0 }));
  }
  return entries.map((e) => ({
    id: e.id,
    raw: e.raw,
    normalised: e.raw > 0 ? round((e.raw / best) * 1000, precision) : 0,
  }));
}

// Round derivation is a sum of the competitor's normalised partial(s). Both bases
// reduce to "sum of partials"; `basis` documents intent — `single-group` supplies
// one partial, `separate-per-task` (F3B) supplies three (Duration, Distance,
// Speed). Empty partials → 0.
export function deriveRoundScore(partials: number[], basis: ClassModelBasis): number {
  if (basis === "single-group") {
    return partials[0] ?? 0;
  }
  // separate-per-task — sum every task partial.
  return partials.reduce((sum, p) => sum + p, 0);
}

// Final aggregate: apply drop-worst per series, sum the survivors, subtract the
// independently-tracked penalty, then floor at zero. Because penalties live
// outside `series`, a dropped round can never discard its penalty (AC5); because
// of the floor, the aggregate is never negative (AC8).
export function computeFinalAggregate(input: AggregateInput): AggregateResult {
  const { series, penaltyTotal, dropWorst } = input;
  const droppedValues: number[] = [];
  let grossBeforePenalty = 0;

  for (const s of series) {
    // Drop exactly one lowest element, and only when strictly more than the
    // threshold rounds/tasks were flown ("more than N").
    if (s.length > dropWorst.threshold) {
      const lowest = Math.min(...s);
      const dropIndex = s.indexOf(lowest);
      droppedValues.push(lowest);
      grossBeforePenalty += s.reduce(
        (sum, value, i) => (i === dropIndex ? sum : sum + value),
        0,
      );
    } else {
      grossBeforePenalty += s.reduce((sum, value) => sum + value, 0);
    }
  }

  const penaltyApplied = penaltyTotal;
  const aggregate = Math.max(0, grossBeforePenalty - penaltyApplied);
  return { aggregate, grossBeforePenalty, penaltyApplied, droppedValues };
}
