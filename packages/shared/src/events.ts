import type { Pilot } from "./pilot.js";
import type { LandingBonusEntry, LandingBonusTable } from "./landing-table.js";
import type { Competition, Discipline } from "./competition.js";

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

export type LandingTableEventType =
  | "landingTable.created"
  | "landingTable.updated"
  | "landingTable.deleted";

export interface LandingTableCreatedPayload {
  id: string;
  name: string;
  entries: LandingBonusEntry[];
}

export type LandingTableUpdatedPayload = LandingTableCreatedPayload;

export interface LandingTableDeletedPayload {
  tableId: string;
}

export type LandingTableEventPayload =
  | LandingTableCreatedPayload
  | LandingTableUpdatedPayload
  | LandingTableDeletedPayload;

export function landingTableToCreatedPayload(
  table: LandingBonusTable,
): LandingTableCreatedPayload {
  return {
    id: table.id,
    name: table.name,
    entries: table.entries.map((e) => ({ ...e })),
  };
}

export type CompetitionEventType =
  | "competition.created"
  | "competition.updated"
  | "competition.deleted";

export interface CompetitionCreatedPayload {
  id: string;
  name: string;
  date: string;
  venue: string | null;
  // Discipline + entry options ride the existing created/updated events (RD5);
  // there is no dedicated disciplineChanged event.
  discipline: Discipline;
  pilotNumbersEnabled: boolean;
  pilotClassesEnabled: boolean;
  pilotClasses: string[];
}

export type CompetitionUpdatedPayload = CompetitionCreatedPayload;

export interface CompetitionDeletedPayload {
  competitionId: string;
}

export type CompetitionEventPayload =
  | CompetitionCreatedPayload
  | CompetitionUpdatedPayload
  | CompetitionDeletedPayload;

export function competitionToCreatedPayload(
  competition: Competition,
): CompetitionCreatedPayload {
  return {
    id: competition.id,
    name: competition.name,
    date: competition.date,
    venue: competition.venue,
    discipline: competition.discipline,
    pilotNumbersEnabled: competition.pilotNumbersEnabled,
    pilotClassesEnabled: competition.pilotClassesEnabled,
    pilotClasses: competition.pilotClasses,
  };
}
