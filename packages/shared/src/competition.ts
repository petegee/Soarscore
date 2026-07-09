import { z } from "zod";

// The six FAI classes in MVP scope. Additive-only (NFR-2): a new class extends
// this tuple; the aggregate is never reshaped and existing codes never renamed.
// Discipline is a *key*, never a copy of a rule number (house rule 1): under
// D12 a class's numbers — scoring basis, drop-worst, points-per-second,
// landing table — live in the one derived Contest Class Model (NFR-1), which
// `discipline` pivots to *reference* (STORY-001-016). This bare enum is the
// pre-pivot form, retained until that story lands. It is kept strictly
// separate from the product-level pilotClasses grouping.
export const DISCIPLINES = ["F3B", "F3J", "F3K", "F5J", "F5K", "F5L"] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export interface Competition {
  id: string;
  name: string;
  date: string;
  venue: string | null;
  discipline: Discipline;
  pilotNumbersEnabled: boolean;
  pilotClassesEnabled: boolean;
  pilotClasses: string[];
}

// Case-insensitive dedupe that preserves first-seen order and original casing.
function dedupeClasses(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

// Cross-field rule: an enabled pilot-classes toggle requires ≥1 usable name;
// evaluated against the deduped set so "Open, open" still counts as one.
// Exported so the contest-template schema enforces the same invariant.
export function pilotClassesRefinement(
  value: { pilotClassesEnabled: boolean; pilotClasses: string[] },
  ctx: z.RefinementCtx,
): void {
  if (value.pilotClassesEnabled && dedupeClasses(value.pilotClasses).length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["pilotClasses"],
      message: "At least one pilot class is required",
    });
  }
}

// Normalise the allowed-name set: deduped when enabled, discarded to [] when
// disabled (RD4) so a toggled-off competition never carries a stale set.
// Exported so the contest-template schema normalises the same way.
export function normalisePilotClasses<
  T extends { pilotClassesEnabled: boolean; pilotClasses: string[] },
>(value: T): T {
  return {
    ...value,
    pilotClasses: value.pilotClassesEnabled ? dedupeClasses(value.pilotClasses) : [],
  };
}

// Per-event identity fields (name/date/venue) — everything a contest template
// must NOT capture. Mirrors the landing-table field style: trim + required +
// field-named messages so flatten().fieldErrors names the offending field.
export const competitionIdentityFields = {
  name: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, "Name is required")
    .refine((value) => value.length <= 100, "Name must be 100 characters or fewer"),
  // ISO calendar date (event start date, no end date). Well-formed YYYY-MM-DD
  // that also parses to a real date.
  date: z
    .string()
    .refine(
      (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)),
      "A valid date is required",
    ),
  // Optional; blank or absent normalises to null, like registrationId / club.
  venue: z
    .string()
    .transform((value) => value.trim())
    .transform((value) => (value.length ? value : null))
    .nullable()
    .optional(),
};

// Configuration fields — the contest-template snapshot surface. Any field
// added here must be added to the template snapshot and seed mapping in the
// same change (STORY-001-007/008/009 obligation).
export const competitionConfigurationFields = {
  // Required on both create and update (RD1); a competition never exists without
  // one. The single errorMap covers a missing value and an unknown code alike.
  discipline: z.enum(DISCIPLINES, {
    errorMap: () => ({ message: "A discipline is required" }),
  }),
  // Per-competition entry options; default off so existing callers are additive.
  pilotNumbersEnabled: z.boolean().default(false),
  pilotClassesEnabled: z.boolean().default(false),
  // Allowed pilot-class name set; each name trimmed and non-empty. Cross-field
  // dedupe / discard is applied at the object level below.
  pilotClasses: z
    .array(
      z
        .string()
        .transform((value) => value.trim())
        .refine((value) => value.length > 0, "Class names cannot be blank"),
    )
    .default([]),
};

// Both schemas compose the same fields (RD5), then apply the cross-field
// pilot-classes rule and normalisation.
export const createCompetitionRequestSchema = z
  .object({ ...competitionIdentityFields, ...competitionConfigurationFields })
  .superRefine(pilotClassesRefinement)
  .transform(normalisePilotClasses);

export const updateCompetitionRequestSchema = z
  .object({ ...competitionIdentityFields, ...competitionConfigurationFields })
  .superRefine(pilotClassesRefinement)
  .transform(normalisePilotClasses);

export type CreateCompetitionRequest = z.infer<typeof createCompetitionRequestSchema>;
export type UpdateCompetitionRequest = z.infer<typeof updateCompetitionRequestSchema>;
