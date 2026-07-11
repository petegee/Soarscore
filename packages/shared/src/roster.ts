import { z } from "zod";

// A roster entry is the durable *seat* (RD4): its id is what draw slots,
// scores and reports key on. It references the master pilot by id only —
// pilot fields are never copied (AC2); views join the name at read time.
export interface RosterEntry {
  id: string;
  competitionId: string;
  pilotId: string;
  pilotNumber: number | null;
  pilotClass: string | null;
}

export interface RosterEntryView extends RosterEntry {
  pilotName: string;
  retired: boolean;
}

// Structural validation only. The cross-aggregate rules (entry-option toggles,
// class vocabulary, number uniqueness, duplicate pilots) live in RosterService
// because Zod cannot see the owning competition.
const pilotIdField = z
  .string({ required_error: "A pilot is required" })
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, "A pilot is required");

// Optional positive integer, normalised to null when absent.
const pilotNumberField = z
  .number({ invalid_type_error: "Pilot number must be a positive whole number" })
  .int("Pilot number must be a positive whole number")
  .positive("Pilot number must be a positive whole number")
  .nullable()
  .optional()
  .transform((value) => value ?? null);

// Optional trimmed string, normalised to null when blank or absent.
const pilotClassField = z
  .string()
  .nullable()
  .optional()
  .transform((value) => {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  });

export const addRosterEntryRequestSchema = z.object({
  pilotId: pilotIdField,
  pilotNumber: pilotNumberField,
  pilotClass: pilotClassField,
});

// No pilotId — the occupant changes only via replace (RD4).
export const updateRosterEntryRequestSchema = z.object({
  pilotNumber: pilotNumberField,
  pilotClass: pilotClassField,
});

export const replaceRosterEntryRequestSchema = z.object({
  pilotId: pilotIdField,
  confirmDrawAffected: z.boolean().default(false),
});

export type AddRosterEntryRequest = z.infer<typeof addRosterEntryRequestSchema>;
export type UpdateRosterEntryRequest = z.infer<typeof updateRosterEntryRequestSchema>;
export type ReplaceRosterEntryRequest = z.infer<typeof replaceRosterEntryRequestSchema>;
