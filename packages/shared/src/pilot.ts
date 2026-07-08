import { z } from "zod";

export interface Pilot {
  id: string;
  name: string;
  registrationId: string | null;
  club: string | null;
  contact: string | null;
}

function normaliseOptional(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

const optionalField = z
  .string()
  .max(200, "Must be 200 characters or fewer")
  .nullable()
  .optional()
  .transform(normaliseOptional);

const pilotFields = {
  name: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, "Name is required")
    .refine((value) => value.length <= 100, "Name must be 100 characters or fewer"),
  registrationId: optionalField,
  club: optionalField,
  contact: optionalField,
};

export const createPilotRequestSchema = z.object(pilotFields);
export const updatePilotRequestSchema = z.object(pilotFields);

export type CreatePilotRequest = z.infer<typeof createPilotRequestSchema>;
export type UpdatePilotRequest = z.infer<typeof updatePilotRequestSchema>;
