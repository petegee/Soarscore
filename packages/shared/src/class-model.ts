import { z } from "zod";
import { DISCIPLINES, type Discipline } from "./competition.js";
import { landingBonusEntrySchema, type LandingBonusTable } from "./landing-table.js";

// The Contest Class Model (STORY-001-016 / D12) is the single authoritative
// definition of a class's scoring shape (NFR-1). Nothing downstream may read a
// scoring number by switching on `discipline`; it reads the model instead. A
// seventh class is added by appending one STOCK_CLASS_MODELS entry and its
// stockModelIdFor mapping — no aggregate reshape, no code branch (NFR-2).

// How a group's raw results become the round score. `single-group` is the
// man-on-man best-raw=1000 scaling shared by five classes; `separate-per-task`
// is F3B's three-tasks-normalised-separately shape (full per-task detail is
// STORY-001-008). This marker replaces any `switch (discipline)`.
export type ClassModelBasis = "single-group" | "separate-per-task";

// What the drop-worst threshold counts. `round` for the man-on-man classes;
// `task` for F3B, which discards the lowest partial of each task rather than a
// whole round.
export type DropWorstUnit = "round" | "task";

// A stock model is the read-only FAI-derived seed; a custom model is a named,
// editable clone. The only auditable path to a rule variation is clone-then-edit.
export type ModelOrigin = "stock" | "custom";

// How a group that resolves to exactly one scoring pilot is handled
// (STORY-001-011). "dummy" pairs the lone pilot against a randomly drawn
// other competitor's own flight purely to anchor the ratio (never counted
// toward the dummy's own score, general-rules §3's no-auto-1000 rule).
// "annul" is F3B's class-fixed rule (f3b.md: a one-valid-result group is
// annulled) — it requires the Contest Director's explicit per-contest
// override before any dummy may substitute. Additive-only (NFR-2): every
// stock model states this explicitly, no code infers it from `basis` or
// `sourceClass`.
export type LonePilotBehaviour = "dummy" | "annul";

export interface DropWorstRule {
  threshold: number;
  unit: DropWorstUnit;
}

// The minimum a contest must reach to count as a *valid* contest — read at Lock
// & Finalisation (STORY-001-026) to resolve a locked competition to
// OfficialResults vs NoContest. Structured, not a bare integer, so the core can
// interpret all three rule shapes generically without ever branching on
// discipline (CLAUDE.md class-model law):
//   • plain round-count minimum — `rounds` set, `tasks` null (F3J/F5J/F5L = 4,
//     F3K = 5);
//   • compound rounds-and-tasks minimum — both set (F3B = 1 round AND 1 task);
//   • no minimum at all — the whole value is null (F5K), where finalising short
//     is the Contest Director's judgement and always yields OfficialResults.
// A `null` value is semantically distinct from `{ rounds: 0 }` — "no rule to
// test against" is not "a minimum of zero". Rule-fixed identity metadata (house
// rule 1) like groupSizeMinimumClause: preserved verbatim through clone/edit,
// never user-editable.
export interface MinimumForValidContest {
  rounds: number;
  // The compound task minimum (F3B's "and 1 task"); null where the class fixes
  // a round count alone.
  tasks: number | null;
}

// Capture granularity for a task's flight time (STORY-001-008 / AC2). This is
// the *timing* precision — the step the field time is recorded to and whether
// the residue rounds or is dropped — and is deliberately NOT the same quantity
// as scoring's NormaliseOptions.precision (normalised-score decimals). `stepSeconds`
// is the recording step (1 = whole seconds, 0.1 = tenths, 0.01 = 1/100 s);
// `rounding: "truncate"` drops the sub-step residue (F3K/F5×), `"nearest"` rounds it.
export interface TimingPrecision {
  stepSeconds: number;
  rounding: "truncate" | "nearest";
}

// F5K's launch-height adjustment vs the Nominal Launch Height, in points per
// metre (f5k.md §NLH, 5.5.10.3–10.4). The three rule-fixed slopes are model-owned
// (a deviation is a clone, AC6); the NLH *value* itself is per-event (task-config).
export interface NlhCoefficients {
  belowPerMetre: number;
  above1to10PerMetre: number;
  above11PlusPerMetre: number;
}

// One deduction kind a task's rule allows (AC5). 008 defines the *available*
// types only — imposing one is CD authority (Area 5.9). `defaultDeduction` is the
// rule-fixed points removed (0 where the rule zeroes the flight/task rather than
// deducting a fixed amount — the label carries that nuance).
export interface PenaltyType {
  code: string;
  label: string;
  defaultDeduction: number;
}

// The rule-fixed parameter bundle for one task a class flies (STORY-001-008).
// A class owns a list: man-on-man classes carry one, F3B three, F5K five. The
// round → task *schedule* is deferred (per-discipline). Everything here is
// rule-fixed and model-owned; per-event values (target time, NLH value) live on
// the competition task-config overlay, never here.
export interface TaskParameterSet {
  id: string;
  name: string;
  timingPrecision: TimingPrecision;
  // Linear flight-time rate; null where the task fixes no single rate (house
  // rule 1) — F3K tenths without a bonus, F5K summed-per-task, F3B Distance/Speed.
  pointsPerSecond: number | null;
  // Speed tasks invert the ratio (fastest = best) — applied in scoring.
  speedInverted: boolean;
  // Whether this task scores a landing bonus (AC3/AC4). When false no table is
  // required or accepted at save.
  landingScored: boolean;
  // The task's own landing table (owned outright, D12) — null where the task
  // scores no landing.
  landingTable: LandingBonusTable | null;
  // Whether the Organiser may override the base target/working time per round
  // (AC1). True for F3K alone in MVP (F3K.11 organiser reduction); the other
  // five classes' working times are rule-fixed.
  perRoundOverrideAllowed: boolean;
  // Whether a Nominal Launch Height applies (AC6) — F5K only in MVP.
  nlhApplicable: boolean;
  // The rule-fixed per-metre slopes around the NLH; null where nlhApplicable is
  // false.
  nlhCoefficients: NlhCoefficients | null;
  // The deduction types this task's rule offers (AC5).
  penaltyTypes: PenaltyType[];
  // Rule-fixed minimum scoring pilots per flight group for this task (draw,
  // STORY-001-009 / AC1). null where the class fixes no per-group minimum; the
  // draw then falls back to the D1 general bound (≥ 2 scoring pilots). Additive
  // slot only (NFR-2) — no aggregate reshape, no branch on discipline.
  minGroupSize: number | null;
  // Whether minGroupSize carries the rule's "or all competitors" escape (e.g.
  // F3B.1.8b Task C: minimum 8 competitors OR all competitors in one group).
  // False for every task whose minimum has no such exception. When true, a
  // single group containing the whole roster always satisfies this task's
  // minimum regardless of roster size — the draw may permit groupsPerRound = 1
  // for that reason alone, not just via the Organiser's spare-scorer override.
  minGroupSizeAllCompetitorsFallback: boolean;
}

export interface ContestClassModel {
  id: string;
  name: string;
  // Metadata only — which FAI class this model derives from. No longer a
  // Competition field (that pivots to a classModelId reference).
  sourceClass: Discipline;
  origin: ModelOrigin;
  // The stock model a custom clone derives from; null for stock models.
  sourceModelId: string | null;
  basis: ClassModelBasis;
  // Speed tasks invert the ratio (fastest = best); a model-level marker retained
  // for the separate-per-task basis. The per-task speedInverted flag on each
  // TaskParameterSet is the authoritative per-task copy.
  speedInverted: boolean;
  dropWorst: DropWorstRule;
  // The FAI rule clause to cite for this class's rule-fixed per-group minimum
  // (house rule 1), shared across all of a class's tasks; null where the class
  // fixes no per-group minimum (F5K/F5L) and so never raises the warning.
  // Identity metadata like sourceClass — preserved verbatim through clone/edit,
  // never user-editable.
  groupSizeMinimumClause: string | null;
  // The minimum-rounds-for-a-valid-contest threshold (STORY-001-016 AC5),
  // read at Lock & Finalisation (STORY-001-026); null where the class fixes no
  // minimum (F5K) and finalising short is the CD's judgement. Rule-fixed
  // identity metadata — preserved verbatim through clone/edit, never editable.
  // See MinimumForValidContest for the three shapes it can take.
  minimumForValidContest: MinimumForValidContest | null;
  // The class's rule-fixed task parameters (STORY-001-008). One task for the
  // man-on-man classes, three for F3B, five for F5K. The flat pointsPerSecond /
  // landingTable that 016 stored are folded into these tasks (NFR-1).
  tasks: TaskParameterSet[];
  // How a lone-pilot group (STORY-001-011) resolves for this class: pair
  // against a random dummy, or annul pending CD override. Default "dummy";
  // F3B is the one class fixing "annul" (general-rules §3, f3b.md).
  lonePilotBehaviour: LonePilotBehaviour;
}

// Whether any task in this model carries the "or all competitors" escape on
// its per-group minimum (e.g. F3B.1.8b Task C). When true, a single group
// containing the whole roster is always a rule-legal draw, independent of the
// roster-derived per-group minimum (draw, STORY-001-009).
export function modelAllowsAllCompetitorsFallback(model: ContestClassModel): boolean {
  return model.tasks.some((task) => task.minGroupSizeAllCompetitorsFallback);
}

// One changed rule-fixed field of a custom model, versus its stock source.
// Derived on read by diffing (never persisted stale, D4).
export interface ModelFieldDeviation {
  field: string;
  stockValue: unknown;
  chosenValue: unknown;
}

// Deterministic stock-model id per class (e.g. F5L → "stock-f5l"). Used by the
// seed (idempotent upsert-by-id) and by the legacy back-fill that resolves an
// old competition/template `discipline` payload to its stock model.
export function stockModelIdFor(discipline: Discipline): string {
  return `stock-${discipline.toLowerCase()}`;
}

// The fine 100→0-over-15m landing table shared by F3J and F5L (rule docs
// f3j.md / f5l.md). The terminal points:0 row encodes "over 15 → 0"; boundary
// semantics are held positionally (deferred to STORY-001-007).
const FINE_LANDING_ENTRIES = [
  { distanceM: 0.2, points: 100 },
  { distanceM: 0.4, points: 99 },
  { distanceM: 0.6, points: 98 },
  { distanceM: 0.8, points: 97 },
  { distanceM: 1.0, points: 96 },
  { distanceM: 1.2, points: 95 },
  { distanceM: 1.4, points: 94 },
  { distanceM: 1.6, points: 93 },
  { distanceM: 1.8, points: 92 },
  { distanceM: 2.0, points: 91 },
  { distanceM: 3, points: 90 },
  { distanceM: 4, points: 85 },
  { distanceM: 5, points: 80 },
  { distanceM: 6, points: 75 },
  { distanceM: 7, points: 70 },
  { distanceM: 8, points: 65 },
  { distanceM: 9, points: 60 },
  { distanceM: 10, points: 55 },
  { distanceM: 11, points: 50 },
  { distanceM: 12, points: 45 },
  { distanceM: 13, points: 40 },
  { distanceM: 14, points: 35 },
  { distanceM: 15, points: 30 },
  { distanceM: 16, points: 0 },
];

// The coarser 50→0-over-10m table specific to F5J (rule doc f5j.md). Terminal
// points:0 row encodes "over 10 → 0".
const F5J_LANDING_ENTRIES = [
  { distanceM: 1, points: 50 },
  { distanceM: 2, points: 45 },
  { distanceM: 3, points: 40 },
  { distanceM: 4, points: 35 },
  { distanceM: 5, points: 30 },
  { distanceM: 6, points: 25 },
  { distanceM: 7, points: 20 },
  { distanceM: 8, points: 15 },
  { distanceM: 9, points: 10 },
  { distanceM: 10, points: 5 },
  { distanceM: 11, points: 0 },
];

function stockLandingTable(
  discipline: Discipline,
  entries: { distanceM: number; points: number }[],
): LandingBonusTable {
  return {
    id: `${stockModelIdFor(discipline)}-landing`,
    name: `${discipline} landing table`,
    entries: entries.map((e) => ({ ...e })),
  };
}

// Rule-fixed capture precisions (house rule 1). F3J records to 0.1 s (F3J.10.2);
// F3K to 0.1 s truncated (F3K.7); F5J/F5K/F5L and F3B-duration to whole seconds,
// tenths dropped not rounded (5.5.11.12 b / 5.5.10.6 f / 5.5.12.11.1 / f3b.md,
// f5-general-rules.md §precision); F3B-speed to 1/100 s (f3b.md Task C).
const WHOLE_SECOND_TRUNCATED: TimingPrecision = { stepSeconds: 1, rounding: "truncate" };
const TENTH_SECOND: TimingPrecision = { stepSeconds: 0.1, rounding: "nearest" };
const TENTH_SECOND_TRUNCATED: TimingPrecision = { stepSeconds: 0.1, rounding: "truncate" };
const HUNDREDTH_SECOND: TimingPrecision = { stepSeconds: 0.01, rounding: "nearest" };

// F5K's rule-fixed launch-height slopes vs the NLH (f5k.md §NLH, 5.5.10.3–10.4).
const F5K_NLH_COEFFICIENTS: NlhCoefficients = {
  belowPerMetre: 0.5,
  above1to10PerMetre: -1.0,
  above11PlusPerMetre: -3.0,
};

// A stock task built with the neutral defaults (no rate/table/NLH/penalties, no
// per-round override, not speed-inverted); each model overrides only the slots
// its rule fixes, so every non-default value is a transcribed rule number.
function stockTask(
  partial: Partial<TaskParameterSet> &
    Pick<TaskParameterSet, "id" | "name" | "timingPrecision">,
): TaskParameterSet {
  return {
    pointsPerSecond: null,
    speedInverted: false,
    landingScored: false,
    landingTable: null,
    perRoundOverrideAllowed: false,
    nlhApplicable: false,
    nlhCoefficients: null,
    penaltyTypes: [],
    // Default: the class fixes no per-group minimum; a model overrides this
    // only where its rule doc states one (transcribed with a citation below).
    minGroupSize: null,
    minGroupSizeAllCompetitorsFallback: false,
    ...partial,
  };
}

// The six MVP stock models, transcribed only from docs/requirements/rules/
// (house rule 1). Numbers must not contravene those docs; where a task fixes
// no single rate/table the field is null, never an invented placeholder.
export const STOCK_CLASS_MODELS: ContestClassModel[] = [
  {
    id: stockModelIdFor("F3B"),
    name: "F3B",
    sourceClass: "F3B",
    origin: "stock",
    sourceModelId: null,
    // Three tasks normalised separately; discard the lowest partial per task
    // once more than 5 rounds are flown (f3b.md). Speed task inverts the ratio.
    basis: "separate-per-task",
    speedInverted: true,
    dropWorst: { threshold: 5, unit: "task" },
    // Shared by Duration/Distance/Speed (F3B.1.8 b).
    groupSizeMinimumClause: "F3B.1.8 b",
    // Compound minimum: 1 completed round AND 1 completed task (f3b.md).
    minimumForValidContest: { rounds: 1, tasks: 1 },
    // F3B annuls a one-valid-result group rather than pairing a dummy
    // (general-rules §3, f3b.md) — requires a CD override to substitute.
    lonePilotBehaviour: "annul",
    tasks: [
      // Task A Duration: 1 pt per full second, whole seconds (f3b.md Task A).
      // The landing-bonus table is deferred (was null under 016) — landings
      // unscored here until the per-discipline task screen lands.
      stockTask({
        id: `${stockModelIdFor("F3B")}-task-duration`,
        name: "Duration",
        timingPrecision: WHOLE_SECOND_TRUNCATED,
        pointsPerSecond: 1,
        // Min 5 per group for Duration (F3B.1.8b).
        minGroupSize: 5,
        penaltyTypes: [
          { code: "winch-non-conforming", label: "Non-conforming winch", defaultDeduction: 1000 },
        ],
      }),
      // Task B Distance: integer count of full 150 m legs, partial legs not
      // counted (f3b.md Task B) — a whole-unit truncated measure, no pt/s rate.
      stockTask({
        id: `${stockModelIdFor("F3B")}-task-distance`,
        name: "Distance",
        timingPrecision: WHOLE_SECOND_TRUNCATED,
        // Min 3 per group for Distance (F3B.1.8b).
        minGroupSize: 3,
        penaltyTypes: [
          { code: "winch-non-conforming", label: "Non-conforming winch", defaultDeduction: 1000 },
        ],
      }),
      // Task C Speed: 4 × 150 m legs to at least 1/100 s, fastest = best
      // (f3b.md Task C). Safety-plane crossing −300 is Task C only.
      stockTask({
        id: `${stockModelIdFor("F3B")}-task-speed`,
        name: "Speed",
        timingPrecision: HUNDREDTH_SECOND,
        speedInverted: true,
        // Min 8 per group for Speed, or all competitors in one group (F3B.1.8b).
        minGroupSize: 8,
        minGroupSizeAllCompetitorsFallback: true,
        penaltyTypes: [
          { code: "safety-plane", label: "Safety-plane crossing", defaultDeduction: 300 },
          { code: "winch-non-conforming", label: "Non-conforming winch", defaultDeduction: 1000 },
        ],
      }),
    ],
  },
  {
    id: stockModelIdFor("F3J"),
    name: "F3J",
    sourceClass: "F3J",
    origin: "stock",
    sourceModelId: null,
    basis: "single-group",
    speedInverted: false,
    // Drop-worst only beyond 7 rounds — the highest threshold of the six
    // classes (f3j.md).
    dropWorst: { threshold: 7, unit: "round" },
    groupSizeMinimumClause: "F3J.6.1",
    // Minimum 4 completed rounds for a valid contest (f3j.md).
    minimumForValidContest: { rounds: 4, tasks: null },
    lonePilotBehaviour: "dummy",
    tasks: [
      // 0.1 s timing (F3J.10.2), 1 pt/s, its 100→0 fine landing table (f3j.md).
      // Working time is rule-fixed — no per-round override.
      stockTask({
        id: `${stockModelIdFor("F3J")}-task`,
        name: "Duration",
        timingPrecision: TENTH_SECOND,
        pointsPerSecond: 1,
        landingScored: true,
        landingTable: stockLandingTable("F3J", FINE_LANDING_ENTRIES),
        // Min 6 per group (F3J.6.1).
        minGroupSize: 6,
        penaltyTypes: [
          { code: "towline-not-cleared", label: "Towline not cleared within 30 s", defaultDeduction: 100 },
          { code: "winch-non-conforming", label: "Non-conforming winch", defaultDeduction: 1000 },
          { code: "unauthorised-transmission", label: "Unauthorised transmission", defaultDeduction: 300 },
          { code: "overfly", label: "Overfly (up to 1 min over)", defaultDeduction: 30 },
        ],
      }),
    ],
  },
  {
    id: stockModelIdFor("F3K"),
    name: "F3K",
    sourceClass: "F3K",
    origin: "stock",
    sourceModelId: null,
    // Per-task scored-time rules and 1/10 s truncated timing with no landing
    // bonus (f3k.md) — no single points-per-second rate, no owned table.
    basis: "single-group",
    speedInverted: false,
    // Drop the lowest round once 6 or more rounds are flown (f3k.md).
    dropWorst: { threshold: 5, unit: "round" },
    groupSizeMinimumClause: "F3K.9.1",
    // Minimum 5 completed rounds for a valid contest (f3k.md).
    minimumForValidContest: { rounds: 5, tasks: null },
    lonePilotBehaviour: "dummy",
    tasks: [
      // 0.1 s truncated (F3K.7); flight-time only, no landing (F3K §2). The only
      // MVP task whose working time the organiser may reduce (F3K.11).
      stockTask({
        id: `${stockModelIdFor("F3K")}-task`,
        name: "Flight time",
        timingPrecision: TENTH_SECOND_TRUNCATED,
        perRoundOverrideAllowed: true,
        // Min 5 per group (F3K.9.1).
        minGroupSize: 5,
        penaltyTypes: [
          { code: "outside-window", label: "Flying outside the assigned window", defaultDeduction: 100 },
        ],
      }),
    ],
  },
  {
    id: stockModelIdFor("F5J"),
    name: "F5J",
    sourceClass: "F5J",
    origin: "stock",
    sourceModelId: null,
    basis: "single-group",
    speedInverted: false,
    // Drop-worst beyond 4 rounds (f5j.md).
    dropWorst: { threshold: 4, unit: "round" },
    groupSizeMinimumClause: "5.5.11.8",
    // Minimum 4 completed rounds for a valid contest (f5j.md).
    minimumForValidContest: { rounds: 4, tasks: null },
    lonePilotBehaviour: "dummy",
    tasks: [
      // Whole seconds truncated (5.5.11.12 b), 1 pt/s, its coarser 50→0 table
      // (f5j.md). Launch faults −100 each; safety-area −300; access-corridor −1000.
      stockTask({
        id: `${stockModelIdFor("F5J")}-task`,
        name: "Duration",
        timingPrecision: WHOLE_SECOND_TRUNCATED,
        pointsPerSecond: 1,
        landingScored: true,
        landingTable: stockLandingTable("F5J", F5J_LANDING_ENTRIES),
        // Min 6 per group (5.5.11.14.1).
        minGroupSize: 6,
        penaltyTypes: [
          { code: "launch-fault", label: "Wrong direction / motor before start / not straight 3 s", defaultDeduction: 100 },
          { code: "safety-area", label: "Safety-area infringement", defaultDeduction: 300 },
          { code: "access-corridor", label: "Contact in access corridor", defaultDeduction: 1000 },
        ],
      }),
    ],
  },
  {
    id: stockModelIdFor("F5K"),
    name: "F5K",
    sourceClass: "F5K",
    origin: "stock",
    sourceModelId: null,
    // All-up summed scoring per task (f5k.md) — no single rate, no owned table;
    // launch height scored vs the NLH.
    basis: "single-group",
    speedInverted: false,
    // Drop the lowest round once 7 or more rounds are flown (f5k.md).
    dropWorst: { threshold: 6, unit: "round" },
    // F5K fixes no per-group minimum (AC6).
    groupSizeMinimumClause: null,
    // F5K defines no minimum-rounds validity rule (f5k.md) — finalising short
    // is the CD's judgement, always OfficialResults. Distinct from `rounds: 0`.
    minimumForValidContest: null,
    lonePilotBehaviour: "dummy",
    // Tasks A–E (5.5.10.2). Same scoring shape per task; the round → task
    // schedule and per-task working times are deferred (per-discipline). Every
    // task carries the NLH slopes (AC6) and the shared F5K penalty catalogue.
    tasks: (["A", "B", "C", "D", "E"] as const).map((letter) =>
      stockTask({
        id: `${stockModelIdFor("F5K")}-task-${letter.toLowerCase()}`,
        name: `Task ${letter}`,
        timingPrecision: WHOLE_SECOND_TRUNCATED,
        nlhApplicable: true,
        nlhCoefficients: { ...F5K_NLH_COEFFICIENTS },
        penaltyTypes: [
          { code: "overfly-window", label: "Overfly landing window", defaultDeduction: 100 },
          { code: "safety-zone", label: "Safety-zone infringement", defaultDeduction: 300 },
          { code: "landing-outside-area", label: "Landing outside pilot area (per landing)", defaultDeduction: 10 },
        ],
      }),
    ),
  },
  {
    id: stockModelIdFor("F5L"),
    name: "F5L",
    sourceClass: "F5L",
    origin: "stock",
    sourceModelId: null,
    basis: "single-group",
    speedInverted: false,
    // Drop-worst beyond 5 rounds (f5l.md).
    dropWorst: { threshold: 5, unit: "round" },
    // F5L fixes no per-group minimum (AC6).
    groupSizeMinimumClause: null,
    // Minimum 4 completed rounds for a valid contest (f5l.md).
    minimumForValidContest: { rounds: 4, tasks: null },
    lonePilotBehaviour: "dummy",
    tasks: [
      // 2 pt/s (5.5.12.11.1), whole seconds truncated, the 100→0 fine table
      // (f5l.md). Its penalties zero the flight/task rather than deduct a fixed
      // amount (defaultDeduction 0, the label carries the zeroing rule).
      stockTask({
        id: `${stockModelIdFor("F5L")}-task`,
        name: "Duration",
        timingPrecision: WHOLE_SECOND_TRUNCATED,
        pointsPerSecond: 2,
        landingScored: true,
        landingTable: stockLandingTable("F5L", FINE_LANDING_ENTRIES),
        penaltyTypes: [
          { code: "landing-outside-area", label: "Landing outside area (flight scores zero)", defaultDeduction: 0 },
          { code: "overfly", label: "Overfly working time by > 30 s (task scores zero)", defaultDeduction: 0 },
        ],
      }),
    ],
  },
];

// Structural safety net: every class has exactly one stock model.
void (STOCK_CLASS_MODELS.length === DISCIPLINES.length);

function landingTablesEqual(a: LandingBonusTable | null, b: LandingBonusTable | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.entries.length !== b.entries.length) return false;
  return a.entries.every((entry, i) => {
    const other = b.entries[i];
    return other !== undefined && entry.distanceM === other.distanceM && entry.points === other.points;
  });
}

function timingPrecisionsEqual(a: TimingPrecision, b: TimingPrecision): boolean {
  return a.stepSeconds === b.stepSeconds && a.rounding === b.rounding;
}

function nlhCoefficientsEqual(a: NlhCoefficients | null, b: NlhCoefficients | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.belowPerMetre === b.belowPerMetre &&
    a.above1to10PerMetre === b.above1to10PerMetre &&
    a.above11PlusPerMetre === b.above11PlusPerMetre
  );
}

function penaltyTypesEqual(a: PenaltyType[], b: PenaltyType[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((type, i) => {
    const other = b[i];
    return (
      other !== undefined &&
      type.code === other.code &&
      type.label === other.label &&
      type.defaultDeduction === other.defaultDeduction
    );
  });
}

// Diff a custom model against its stock source, emitting one entry per differing
// rule-fixed field (AC2/AC5/AC6). Identity fields (id, name, origin,
// sourceModelId, sourceClass) are excluded — only the scoring shape counts as a
// deviation. Tasks are diffed positionally by task id (dotted field names).
export function deriveDeviations(
  custom: ContestClassModel,
  source: ContestClassModel,
): ModelFieldDeviation[] {
  const deviations: ModelFieldDeviation[] = [];
  const note = (field: string, stockValue: unknown, chosenValue: unknown) => {
    deviations.push({ field, stockValue, chosenValue });
  };

  if (custom.basis !== source.basis) note("basis", source.basis, custom.basis);
  if (custom.speedInverted !== source.speedInverted) {
    note("speedInverted", source.speedInverted, custom.speedInverted);
  }
  if (custom.dropWorst.threshold !== source.dropWorst.threshold) {
    note("dropWorst.threshold", source.dropWorst.threshold, custom.dropWorst.threshold);
  }
  if (custom.dropWorst.unit !== source.dropWorst.unit) {
    note("dropWorst.unit", source.dropWorst.unit, custom.dropWorst.unit);
  }
  if (custom.lonePilotBehaviour !== source.lonePilotBehaviour) {
    note("lonePilotBehaviour", source.lonePilotBehaviour, custom.lonePilotBehaviour);
  }

  // Positional task diff keyed by task id. A task added or removed relative to
  // the source is itself a deviation; matched tasks diff their rule-fixed slots.
  const sourceTasks = new Map(source.tasks.map((task) => [task.id, task]));
  const seen = new Set<string>();
  custom.tasks.forEach((task, index) => {
    seen.add(task.id);
    const from = sourceTasks.get(task.id);
    const label = `tasks[${index}]`;
    if (!from) {
      note(label, undefined, task);
      return;
    }
    if (!timingPrecisionsEqual(task.timingPrecision, from.timingPrecision)) {
      note(`${label}.timingPrecision`, from.timingPrecision, task.timingPrecision);
    }
    if (task.pointsPerSecond !== from.pointsPerSecond) {
      note(`${label}.pointsPerSecond`, from.pointsPerSecond, task.pointsPerSecond);
    }
    if (task.speedInverted !== from.speedInverted) {
      note(`${label}.speedInverted`, from.speedInverted, task.speedInverted);
    }
    if (task.landingScored !== from.landingScored) {
      note(`${label}.landingScored`, from.landingScored, task.landingScored);
    }
    if (!landingTablesEqual(task.landingTable, from.landingTable)) {
      note(`${label}.landingTable`, from.landingTable, task.landingTable);
    }
    if (task.perRoundOverrideAllowed !== from.perRoundOverrideAllowed) {
      note(`${label}.perRoundOverrideAllowed`, from.perRoundOverrideAllowed, task.perRoundOverrideAllowed);
    }
    if (!nlhCoefficientsEqual(task.nlhCoefficients, from.nlhCoefficients)) {
      note(`${label}.nlhCoefficients`, from.nlhCoefficients, task.nlhCoefficients);
    }
    if (!penaltyTypesEqual(task.penaltyTypes, from.penaltyTypes)) {
      note(`${label}.penaltyTypes`, from.penaltyTypes, task.penaltyTypes);
    }
    if (task.minGroupSize !== from.minGroupSize) {
      note(`${label}.minGroupSize`, from.minGroupSize, task.minGroupSize);
    }
    if (task.minGroupSizeAllCompetitorsFallback !== from.minGroupSizeAllCompetitorsFallback) {
      note(
        `${label}.minGroupSizeAllCompetitorsFallback`,
        from.minGroupSizeAllCompetitorsFallback,
        task.minGroupSizeAllCompetitorsFallback,
      );
    }
  });
  // A source task the custom model dropped is a deviation too.
  source.tasks.forEach((task) => {
    if (!seen.has(task.id)) note(`tasks[${task.id}]`, task, undefined);
  });
  return deviations;
}

// Shared name field — trimmed, required, ≤100 chars — matching the competition
// / landing-table field idiom so flatten().fieldErrors names `name`.
const modelName = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, "Name is required")
  .refine((value) => value.length <= 100, "Name must be 100 characters or fewer");

const basisSchema = z.enum(["single-group", "separate-per-task"], {
  errorMap: () => ({ message: "A scoring basis is required" }),
});

const dropWorstSchema = z.object({
  threshold: z
    .number()
    .int("Drop-worst threshold must be a whole number")
    .nonnegative("Drop-worst threshold must be zero or greater"),
  unit: z.enum(["round", "task"], {
    errorMap: () => ({ message: "A drop-worst unit is required" }),
  }),
});

// Landing table on an update: nullable; when present, name + ≥1 entry validated
// by the shared landingBonusEntrySchema (the id is preserved server-side).
const updateLandingTableSchema = z
  .object({
    id: z.string().optional(),
    name: z
      .string()
      .transform((value) => value.trim())
      .refine((value) => value.length > 0, "Name is required"),
    entries: z.array(landingBonusEntrySchema).min(1, "At least one entry is required"),
  })
  .nullable();

const timingPrecisionSchema = z.object({
  stepSeconds: z.number().positive("Timing step must be greater than zero"),
  rounding: z.enum(["truncate", "nearest"], {
    errorMap: () => ({ message: "Rounding must be truncate or nearest" }),
  }),
});

const nlhCoefficientsSchema = z
  .object({
    belowPerMetre: z.number(),
    above1to10PerMetre: z.number(),
    above11PlusPerMetre: z.number(),
  })
  .nullable();

const penaltyTypeSchema = z.object({
  code: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, "A penalty code is required"),
  label: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, "A penalty label is required"),
  defaultDeduction: z.number().nonnegative("A penalty deduction must be zero or greater"),
});

// One task's editable rule-fixed surface. The id is preserved server-side where
// the edit kept a task, minted otherwise (mirrors the landing-table id handling).
const updateTaskSchema = z.object({
  id: z.string().optional(),
  name: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, "A task name is required"),
  timingPrecision: timingPrecisionSchema,
  pointsPerSecond: z
    .number()
    .nonnegative("Points per second must be zero or greater")
    .nullable(),
  speedInverted: z.boolean(),
  landingScored: z.boolean(),
  landingTable: updateLandingTableSchema,
  perRoundOverrideAllowed: z.boolean(),
  nlhApplicable: z.boolean(),
  nlhCoefficients: nlhCoefficientsSchema,
  penaltyTypes: z.array(penaltyTypeSchema),
  minGroupSize: z.number().int().positive().nullable(),
  minGroupSizeAllCompetitorsFallback: z.boolean(),
});

// Clone request: the Organiser supplies only the new name; all rule-fixed values
// are deep-copied from the source model.
export const cloneClassModelRequestSchema = z.object({ name: modelName });

// Edit request (custom models only): the full editable rule-fixed surface.
// origin / sourceModelId / sourceClass are preserved server-side, never sent.
export const updateClassModelRequestSchema = z.object({
  name: modelName,
  basis: basisSchema,
  speedInverted: z.boolean(),
  dropWorst: dropWorstSchema,
  tasks: z.array(updateTaskSchema).min(1, "At least one task is required"),
  lonePilotBehaviour: z.enum(["dummy", "annul"], {
    errorMap: () => ({ message: "A lone-pilot behaviour is required" }),
  }),
});

export type CloneClassModelRequest = z.infer<typeof cloneClassModelRequestSchema>;
export type UpdateClassModelRequest = z.infer<typeof updateClassModelRequestSchema>;
