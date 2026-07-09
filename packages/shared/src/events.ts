import type { Pilot } from "./pilot.js";
import type { LandingBonusEntry, LandingBonusTable } from "./landing-table.js";
import type { Competition, Discipline } from "./competition.js";
import type { ContestTemplate } from "./contest-template.js";
import type { RosterEntry } from "./roster.js";

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

// Roster events are the first per-competition content events: they file under
// scope = competitionId (the model the competition projection's comment
// promises), never under the fixed "competitions" / "master-data" scopes.
export type RosterEventType =
  | "roster.entryAdded"
  | "roster.entryUpdated"
  | "roster.entryRemoved"
  | "roster.entryReplaced";

export interface RosterEntryAddedPayload {
  id: string;
  competitionId: string;
  pilotId: string;
  pilotNumber: number | null;
  pilotClass: string | null;
}

export type RosterEntryUpdatedPayload = RosterEntryAddedPayload;

export interface RosterEntryRemovedPayload {
  rosterEntryId: string;
  competitionId: string;
}

// Same entry id, new occupant (RD4) — the seat is stable and every draw slot
// keyed on it is inherited. previousPilotId keeps the prior occupant visible
// in the immutable log (D4); attributes are the state after the swap.
export interface RosterEntryReplacedPayload {
  rosterEntryId: string;
  competitionId: string;
  previousPilotId: string;
  pilotId: string;
  pilotNumber: number | null;
  pilotClass: string | null;
}

export type RosterEventPayload =
  | RosterEntryAddedPayload
  | RosterEntryUpdatedPayload
  | RosterEntryRemovedPayload
  | RosterEntryReplacedPayload;

export function rosterEntryToPayload(entry: RosterEntry): RosterEntryAddedPayload {
  return {
    id: entry.id,
    competitionId: entry.competitionId,
    pilotId: entry.pilotId,
    pilotNumber: entry.pilotNumber,
    pilotClass: entry.pilotClass,
  };
}

export type ContestTemplateEventType =
  | "contestTemplate.created"
  | "contestTemplate.updated"
  | "contestTemplate.deleted"
  | "contestTemplate.seeded";

export interface ContestTemplateCreatedPayload {
  id: string;
  name: string;
  discipline: Discipline;
  pilotNumbersEnabled: boolean;
  pilotClassesEnabled: boolean;
  pilotClasses: string[];
}

export type ContestTemplateUpdatedPayload = ContestTemplateCreatedPayload;

export interface ContestTemplateDeletedPayload {
  templateId: string;
}

// Audit-only provenance (RD4): no projection consumes it — the seeded
// competition carries no template reference. templateName is denormalised so
// the log stays meaningful after the template is deleted.
export interface ContestTemplateSeededPayload {
  templateId: string;
  templateName: string;
  competitionId: string;
}

export type ContestTemplateEventPayload =
  | ContestTemplateCreatedPayload
  | ContestTemplateUpdatedPayload
  | ContestTemplateDeletedPayload
  | ContestTemplateSeededPayload;

export function contestTemplateToCreatedPayload(
  template: ContestTemplate,
): ContestTemplateCreatedPayload {
  return {
    id: template.id,
    name: template.name,
    discipline: template.discipline,
    pilotNumbersEnabled: template.pilotNumbersEnabled,
    pilotClassesEnabled: template.pilotClassesEnabled,
    pilotClasses: [...template.pilotClasses],
  };
}

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
