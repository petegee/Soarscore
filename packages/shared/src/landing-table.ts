import { z } from "zod";

export interface LandingBonusEntry {
  distanceM: number;
  points: number;
}

export interface LandingBonusTable {
  id: string;
  name: string;
  entries: LandingBonusEntry[];
}

// Structural validation only — ordering / monotonicity / rule-conformance are
// deferred to STORY-001-007. Entries are round-tripped verbatim; the boundary
// semantics ("≤ first", "over last → 0") are held positionally, not as flags.
export const landingBonusEntrySchema = z.object({
  distanceM: z.number().nonnegative("Distance must be zero or greater"),
  points: z.number().int("Points must be a whole number").nonnegative("Points must be zero or greater"),
});

const landingTableFields = {
  name: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, "Name is required")
    .refine((value) => value.length <= 100, "Name must be 100 characters or fewer"),
  entries: z.array(landingBonusEntrySchema).min(1, "At least one entry is required"),
};

export const createLandingTableRequestSchema = z.object(landingTableFields);
export const updateLandingTableRequestSchema = z.object(landingTableFields);

export type CreateLandingTableRequest = z.infer<typeof createLandingTableRequestSchema>;
export type UpdateLandingTableRequest = z.infer<typeof updateLandingTableRequestSchema>;
