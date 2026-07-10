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

export interface DropWorstRule {
  threshold: number;
  unit: DropWorstUnit;
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
  // Speed tasks invert the ratio (fastest = best); a marker, applied in scoring.
  speedInverted: boolean;
  // Linear flight-time rate. null where the class fixes no single rate (F3B
  // per-task, F3K tenths timing without a bonus, F5K all-up) — never a
  // placeholder number (house rule 1).
  pointsPerSecond: number | null;
  dropWorst: DropWorstRule;
  // The class's own landing table (owned outright, D12) — null where the class
  // mandates no single table.
  landingTable: LandingBonusTable | null;
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

// The six MVP stock models, transcribed only from docs/requirements/rules/
// (house rule 1). Numbers must not contravene those docs; where a class fixes
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
    pointsPerSecond: null,
    dropWorst: { threshold: 5, unit: "task" },
    landingTable: null,
  },
  {
    id: stockModelIdFor("F3J"),
    name: "F3J",
    sourceClass: "F3J",
    origin: "stock",
    sourceModelId: null,
    basis: "single-group",
    speedInverted: false,
    // 1 pt/s; drop-worst only beyond 7 rounds — the highest threshold of the
    // six classes (f3j.md).
    pointsPerSecond: 1,
    dropWorst: { threshold: 7, unit: "round" },
    landingTable: stockLandingTable("F3J", FINE_LANDING_ENTRIES),
  },
  {
    id: stockModelIdFor("F3K"),
    name: "F3K",
    sourceClass: "F3K",
    origin: "stock",
    sourceModelId: null,
    // Per-task scored-time rules and 1/10 s timing with no landing bonus
    // (f3k.md) — no single points-per-second rate, no owned table.
    basis: "single-group",
    speedInverted: false,
    pointsPerSecond: null,
    // Drop the lowest round once 6 or more rounds are flown (f3k.md).
    dropWorst: { threshold: 5, unit: "round" },
    landingTable: null,
  },
  {
    id: stockModelIdFor("F5J"),
    name: "F5J",
    sourceClass: "F5J",
    origin: "stock",
    sourceModelId: null,
    basis: "single-group",
    speedInverted: false,
    // 1 pt/s; drop-worst beyond 4 rounds; its own coarser table (f5j.md).
    pointsPerSecond: 1,
    dropWorst: { threshold: 4, unit: "round" },
    landingTable: stockLandingTable("F5J", F5J_LANDING_ENTRIES),
  },
  {
    id: stockModelIdFor("F5K"),
    name: "F5K",
    sourceClass: "F5K",
    origin: "stock",
    sourceModelId: null,
    // All-up summed scoring per task (f5k.md) — no single rate, no owned table.
    basis: "single-group",
    speedInverted: false,
    pointsPerSecond: null,
    // Drop the lowest round once 7 or more rounds are flown (f5k.md).
    dropWorst: { threshold: 6, unit: "round" },
    landingTable: null,
  },
  {
    id: stockModelIdFor("F5L"),
    name: "F5L",
    sourceClass: "F5L",
    origin: "stock",
    sourceModelId: null,
    basis: "single-group",
    speedInverted: false,
    // 2 pt/s; drop-worst beyond 5 rounds; the 100→0 fine table (f5l.md).
    pointsPerSecond: 2,
    dropWorst: { threshold: 5, unit: "round" },
    landingTable: stockLandingTable("F5L", FINE_LANDING_ENTRIES),
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

// Diff a custom model against its stock source, emitting one entry per differing
// rule-fixed field (AC6). Identity fields (id, name, origin, sourceModelId,
// sourceClass) are excluded — only the scoring shape counts as a deviation.
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
  if (custom.pointsPerSecond !== source.pointsPerSecond) {
    note("pointsPerSecond", source.pointsPerSecond, custom.pointsPerSecond);
  }
  if (custom.dropWorst.threshold !== source.dropWorst.threshold) {
    note("dropWorst.threshold", source.dropWorst.threshold, custom.dropWorst.threshold);
  }
  if (custom.dropWorst.unit !== source.dropWorst.unit) {
    note("dropWorst.unit", source.dropWorst.unit, custom.dropWorst.unit);
  }
  if (!landingTablesEqual(custom.landingTable, source.landingTable)) {
    note("landingTable", source.landingTable, custom.landingTable);
  }
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

// Clone request: the Organiser supplies only the new name; all rule-fixed values
// are deep-copied from the source model.
export const cloneClassModelRequestSchema = z.object({ name: modelName });

// Edit request (custom models only): the full editable rule-fixed surface.
// origin / sourceModelId / sourceClass are preserved server-side, never sent.
export const updateClassModelRequestSchema = z.object({
  name: modelName,
  basis: basisSchema,
  speedInverted: z.boolean(),
  pointsPerSecond: z
    .number()
    .nonnegative("Points per second must be zero or greater")
    .nullable(),
  dropWorst: dropWorstSchema,
  landingTable: updateLandingTableSchema,
});

export type CloneClassModelRequest = z.infer<typeof cloneClassModelRequestSchema>;
export type UpdateClassModelRequest = z.infer<typeof updateClassModelRequestSchema>;
