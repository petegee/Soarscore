import { z } from "zod";

export interface Competition {
  id: string;
  name: string;
  date: string;
  venue: string | null;
}

// Identity fields shared by create and update (whole-aggregate update). Mirrors
// the landing-table field style: trim + required + length-bound so
// flatten().fieldErrors names the offending field. No uniqueness constraint —
// name is a mutable label over a stable surrogate id (follow precedent).
const competitionFields = {
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

export const createCompetitionRequestSchema = z.object(competitionFields);
export const updateCompetitionRequestSchema = z.object(competitionFields);

export type CreateCompetitionRequest = z.infer<typeof createCompetitionRequestSchema>;
export type UpdateCompetitionRequest = z.infer<typeof updateCompetitionRequestSchema>;
