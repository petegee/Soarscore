import { z } from "zod";
import {
  competitionConfigurationFields,
  competitionIdentityFields,
  normalisePilotClasses,
  pilotClassesRefinement,
  type Discipline,
} from "./competition.js";

// A reusable configuration snapshot (RD4: copy-on-seed, never a live link).
// Mirrors the competition's configuration fields flat — never identity
// (name/date/venue), roster, or results.
export interface ContestTemplate {
  id: string;
  name: string;
  discipline: Discipline;
  pilotNumbersEnabled: boolean;
  pilotClassesEnabled: boolean;
  pilotClasses: string[];
}

const templateName = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, "Name is required")
  .refine((value) => value.length <= 100, "Name must be 100 characters or fewer");

// Template name + the shared configuration fragment, under the same
// cross-field pilot-classes rule and normalisation as competitions — a seed
// can therefore never emit an invalid create request.
export const createContestTemplateRequestSchema = z
  .object({ name: templateName, ...competitionConfigurationFields })
  .superRefine(pilotClassesRefinement)
  .transform(normalisePilotClasses);

// Whole-aggregate update (RD5 house style) — same composition as create.
export const updateContestTemplateRequestSchema = z
  .object({ name: templateName, ...competitionConfigurationFields })
  .superRefine(pilotClassesRefinement)
  .transform(normalisePilotClasses);

// Capture verb: the Organiser supplies only the template name; the
// configuration is copied from the source competition.
export const saveAsTemplateRequestSchema = z.object({ name: templateName });

// Seed verb: per-event identity only — configuration comes from the template.
export const seedCompetitionRequestSchema = z.object(competitionIdentityFields);

export type CreateContestTemplateRequest = z.infer<typeof createContestTemplateRequestSchema>;
export type UpdateContestTemplateRequest = z.infer<typeof updateContestTemplateRequestSchema>;
export type SaveAsTemplateRequest = z.infer<typeof saveAsTemplateRequestSchema>;
export type SeedCompetitionRequest = z.infer<typeof seedCompetitionRequestSchema>;
