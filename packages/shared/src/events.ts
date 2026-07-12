import type { Pilot } from "./pilot.js";
import type { LandingBonusEntry, LandingBonusTable } from "./landing-table.js";
import type { Competition } from "./competition.js";
import type { ContestClassModel, TaskParameterSet } from "./class-model.js";
import type { ContestTemplate } from "./contest-template.js";
import type { RosterEntry } from "./roster.js";
import type { CompetitionTaskConfig } from "./task-config.js";
import type { DrawSpecification, GeneratedDraw } from "./draw.js";

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

// Class-model events (STORY-001-016). Stock models arrive via classModel.seeded
// (idempotent seed-on-init under system attribution); custom clones via
// classModel.created; edits via classModel.updated; tombstones via
// classModel.deleted. All three write events carry the full model shape,
// denormalised for audit.
export type ClassModelEventType =
  | "classModel.seeded"
  | "classModel.created"
  | "classModel.updated"
  | "classModel.deleted";

export type ClassModelSeededPayload = ContestClassModel;
export type ClassModelCreatedPayload = ContestClassModel;
export type ClassModelUpdatedPayload = ContestClassModel;

export interface ClassModelDeletedPayload {
  modelId: string;
}

export type ClassModelEventPayload =
  | ClassModelSeededPayload
  | ClassModelCreatedPayload
  | ClassModelUpdatedPayload
  | ClassModelDeletedPayload;

// Deep-copies one task's mutable nested structures (timingPrecision,
// nlhCoefficients, penaltyTypes, owned landingTable) so no appended payload
// aliases the caller's model. Exported for reuse by the class-model clone/edit
// deep-copy paths (STORY-001-008).
export function copyTaskParameterSet(task: TaskParameterSet): TaskParameterSet {
  return {
    id: task.id,
    name: task.name,
    timingPrecision: { ...task.timingPrecision },
    pointsPerSecond: task.pointsPerSecond,
    speedInverted: task.speedInverted,
    landingScored: task.landingScored,
    landingTable: task.landingTable
      ? {
          id: task.landingTable.id,
          name: task.landingTable.name,
          entries: task.landingTable.entries.map((e) => ({ ...e })),
        }
      : null,
    perRoundOverrideAllowed: task.perRoundOverrideAllowed,
    nlhApplicable: task.nlhApplicable,
    nlhCoefficients: task.nlhCoefficients ? { ...task.nlhCoefficients } : null,
    penaltyTypes: task.penaltyTypes.map((p) => ({ ...p })),
    minGroupSize: task.minGroupSize,
    minGroupSizeAllCompetitorsFallback: task.minGroupSizeAllCompetitorsFallback,
  };
}

// Deep-copies the mutable nested rule structures (dropWorst, tasks[] and each
// task's owned table/precision/coefficients/penalties) so no appended payload
// aliases the caller's model.
export function classModelToCreatedPayload(model: ContestClassModel): ClassModelCreatedPayload {
  return {
    id: model.id,
    name: model.name,
    sourceClass: model.sourceClass,
    origin: model.origin,
    sourceModelId: model.sourceModelId,
    basis: model.basis,
    speedInverted: model.speedInverted,
    dropWorst: { ...model.dropWorst },
    tasks: model.tasks.map(copyTaskParameterSet),
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
  // Class-model reference + entry options ride the existing created/updated
  // events (RD5); there is no dedicated classChanged event. Legacy events
  // carry `discipline` instead — the projection back-fills them (D12).
  classModelId: string;
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
  // Class-model reference (D12); legacy events carry `discipline` and are
  // back-filled by the projection.
  classModelId: string;
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
    classModelId: template.classModelId,
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
    classModelId: competition.classModelId,
    pilotNumbersEnabled: competition.pilotNumbersEnabled,
    pilotClassesEnabled: competition.pilotClassesEnabled,
    pilotClasses: competition.pilotClasses,
  };
}

// Per-competition task-config events (STORY-001-008). Like roster, these are
// per-competition content events filed under scope = competitionId. The overlay
// is written whole on every save (there is no partial patch event), so a single
// taskConfig.updated type carries the full denormalised shape for audit.
export type TaskConfigEventType = "taskConfig.updated";

export type TaskConfigUpdatedPayload = CompetitionTaskConfig;

export type TaskConfigEventPayload = TaskConfigUpdatedPayload;

// Deep-copies the overlay (tasks[] with their roundOverrides maps) so no
// appended payload aliases the caller's config.
export function taskConfigToPayload(config: CompetitionTaskConfig): TaskConfigUpdatedPayload {
  return {
    id: config.id,
    competitionId: config.competitionId,
    classModelId: config.classModelId,
    nlhValue: config.nlhValue,
    tasks: config.tasks.map((task) => ({
      taskId: task.taskId,
      baseTargetSeconds: task.baseTargetSeconds,
      roundOverrides: { ...task.roundOverrides },
    })),
  };
}

// Per-competition draw events (STORY-001-009). Like roster and task-config,
// these are per-competition content events filed under scope = competitionId.
// draw.specSaved carries the whole validated specification; draw.generated
// carries the fully materialised outcome (Safeguard 3) — never an RNG seed — so
// replay reproduces the identical draw with no RNG in the projection (D4). Each
// success appends a fresh draw.generated: supersede, never mutate (Decision #7).
//
// STORY-001-017 adds the CD's decision facts, also under scope = competitionId:
// draw.accepted is a *promotion* fact — it carries only references (drawId,
// specId) binding the acceptance to a specific stored draw.generated outcome,
// never a re-copy of the outcome itself; draw.cancelled is a *discard* fact
// that returns the contest to a generatable no-draw state. Supersede/append,
// never mutate.
export type DrawEventType =
  | "draw.specSaved"
  | "draw.generated"
  | "draw.accepted"
  | "draw.cancelled";

export type DrawSpecSavedPayload = DrawSpecification;
export type DrawGeneratedPayload = GeneratedDraw;

export interface DrawAcceptedPayload {
  competitionId: string;
  drawId: string;
  specId: string;
  // Which group-size-minimum warning ids the Contest Director acknowledged
  // (STORY-001-022, D4/D14). Additive field on an append-only event log —
  // older events predate it, so the projection must default a missing value
  // to [] on replay, never throw.
  acknowledgedWarningIds: string[];
}

export interface DrawCancelledPayload {
  competitionId: string;
  drawId: string;
}

export type DrawEventPayload =
  | DrawSpecSavedPayload
  | DrawGeneratedPayload
  | DrawAcceptedPayload
  | DrawCancelledPayload;
