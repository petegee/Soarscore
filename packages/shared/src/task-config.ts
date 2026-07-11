import { z } from "zod";

// The per-competition task-configuration overlay (STORY-001-008). It holds the
// two genuinely per-event quantities a shared class model cannot carry — a
// task's base target/working time with a sparse per-round override map (AC1),
// and the CD-announced F5K Nominal Launch Height *value* (AC6) — filed under
// scope = competitionId (the roster pattern). Everything else (precision,
// points-per-second, landing table, penalty catalogue, NLH coefficients) stays
// rule-fixed on the referenced class model; this overlay reads its defaults from
// there and persists only overrides/values, never a copy of the model shape.
export interface CompetitionTaskConfig {
  id: string;
  competitionId: string;
  classModelId: string;
  tasks: TaskConfigEntry[];
  // The CD-announced NLH for this event (F5K); null until announced. Never
  // demanded at save — an unset NLH is a downstream "not ready" condition.
  nlhValue: number | null;
}

// One task's per-event overlay. `taskId` references a TaskParameterSet on the
// class model. `roundOverrides` is a sparse round-number → seconds map; a round
// with no entry inherits `baseTargetSeconds`. Overrides for not-yet-created or
// later-removed rounds are tolerated (the draw is STORY-001-009).
export interface TaskConfigEntry {
  taskId: string;
  baseTargetSeconds: number | null;
  roundOverrides: Record<number, number>;
}

// Round-override map: positive-integer round keys → non-negative seconds. Object
// keys arrive as strings over JSON; coerce to a positive integer and reject the
// rest, so the projected map is always numeric-keyed.
const roundOverridesSchema = z
  .record(z.string(), z.number().nonnegative("An override time must be zero or greater"))
  .transform((raw, ctx) => {
    const out: Record<number, number> = {};
    for (const [key, value] of Object.entries(raw)) {
      const round = Number(key);
      if (!Number.isInteger(round) || round < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Round numbers must be positive whole numbers",
        });
        return z.NEVER;
      }
      out[round] = value;
    }
    return out;
  })
  .default({});

const taskConfigEntrySchema = z.object({
  taskId: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, "A task is required"),
  baseTargetSeconds: z
    .number()
    .nonnegative("A target time must be zero or greater")
    .nullable(),
  roundOverrides: roundOverridesSchema,
});

// Structural validation only. Cross-aggregate rules — the task exists on the
// class model, per-round overrides are allowed for that task, NLH applies —
// live in the service, which alone can see the referenced model.
export const updateCompetitionTaskConfigRequestSchema = z.object({
  tasks: z.array(taskConfigEntrySchema),
  nlhValue: z
    .number()
    .nonnegative("The Nominal Launch Height must be zero or greater")
    .nullable()
    .optional()
    .transform((value) => value ?? null),
});

export type UpdateCompetitionTaskConfigRequest = z.infer<
  typeof updateCompetitionTaskConfigRequestSchema
>;
