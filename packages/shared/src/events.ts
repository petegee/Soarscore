import type { Pilot } from "./pilot.js";

export type PilotEventType = "pilot.created" | "pilot.updated" | "pilot.deleted";

export interface PilotCreatedPayload {
  id: string;
  name: string;
  registrationId: string | null;
  club: string | null;
  contact: string | null;
}

export type PilotUpdatedPayload = PilotCreatedPayload;

export interface PilotDeletedPayload {
  pilotId: string;
}

export type PilotEventPayload = PilotCreatedPayload | PilotUpdatedPayload | PilotDeletedPayload;

export function pilotToCreatedPayload(pilot: Pilot): PilotCreatedPayload {
  return {
    id: pilot.id,
    name: pilot.name,
    registrationId: pilot.registrationId,
    club: pilot.club,
    contact: pilot.contact,
  };
}
