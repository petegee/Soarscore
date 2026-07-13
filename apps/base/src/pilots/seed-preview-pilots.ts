import type { Attribution } from "@soarscore/shared";
import type { PilotService } from "./service.js";

// Demo/preview convenience only — never runs unless explicitly enabled (see
// app.ts), and only on a service whose SQLite file is ephemeral to begin with
// (Dockerfile). Idempotent: skips entirely once any pilot exists, so it never
// duplicates across restarts/redeploys.
const SEED_ATTRIBUTION: Attribution = {
  actorName: "system",
  originClient: "base-seed",
  authority: "system",
};

const PREVIEW_PILOT_NAMES = [
  "Aroha Ngata",
  "Ben Sutherland",
  "Chloe Harrington",
  "Dave Prentice",
  "Emma Fitzgerald",
  "Finn O'Callaghan",
  "Grace Mackenzie",
  "Hemi Walker",
  "Isla Robertson",
  "Jack Whitmore",
  "Kiri Anderson",
  "Liam Fraser",
] as const;

export function seedPreviewPilots(
  pilotService: PilotService,
  attribution: Attribution = SEED_ATTRIBUTION,
): void {
  if (pilotService.list().length > 0) return;

  for (const name of PREVIEW_PILOT_NAMES) {
    pilotService.create(
      { name, registrationId: null, club: null, contact: null },
      attribution,
    );
  }
}
