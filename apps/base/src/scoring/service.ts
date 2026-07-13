import crypto from "node:crypto";
import { z, type ZodType } from "zod";
import {
  captureResultRequestSchema,
  eligibleOtherPilots,
  normaliseGroup,
  selectOfficialResult,
  type AnnulmentOverrideRequestedPayload,
  type Attribution,
  type CapturedFlightResult,
  type Competition,
  type ContestClassModel,
  type GroupEntryWithResults,
  type GroupScoreEntry,
  type GroupScoreView,
  type LonePilotResolvedPayload,
  type ResultCapturedPayload,
  type ResultKind,
  type TaskParameterSet,
} from "@soarscore/shared";
import type { EventStore } from "../eventstore/event-store.js";
import type { CompetitionProjection } from "../competitions/projection.js";
import type { ClassModelProjection } from "../class-models/projection.js";
import type { RosterProjection } from "../roster/projection.js";
import type { GroupCompositionProvider } from "../draw/group-composition-provider.js";
import type { ScoringProjection } from "./projection.js";
import { CaptureTargetNotFoundError, ValidationError } from "./errors.js";

// System attribution for the one RNG side-effect a GET can trigger (the first
// recompute to observe a lone-pilot group) — mirrors ClassModelService's seed
// attribution (system, not an Organiser action).
const SYSTEM_ATTRIBUTION: Attribution = {
  actorName: "system",
  originClient: "base-recompute",
  authority: "system",
};

// STORY-001-011: the minimal captured-flight-result aggregate — capture facts
// (scoring.resultCaptured) plus a pure, on-demand recompute (getGroupScore)
// over which-score-counts, lone-pilot dummy insertion, and F3B's class-fixed
// annulment. No device identity, no concurrency/session model, no sync —
// this is the Organiser/system "record a raw number" path (manual entry
// after the pen-and-paper failure policy, D6), never the future Scorer
// device-capture flow.
export class ScoringService {
  constructor(
    private readonly eventStore: EventStore,
    private readonly projection: ScoringProjection,
    private readonly classModelProjection: ClassModelProjection,
    private readonly competitionProjection: CompetitionProjection,
    private readonly groupCompositionProvider: GroupCompositionProvider,
    private readonly rosterProjection: RosterProjection,
  ) {}

  // Record one raw result for one pilot's seat in one round/task. Two
  // legitimate captures per pilot/round/task ("original"/"reflight");
  // a repeated capture of the same kind supersedes (latest wins).
  captureResult(competitionId: string, input: unknown, attribution: Attribution): CapturedFlightResult {
    const parsed = parseOrThrow(captureResultRequestSchema, input);
    const competition = this.getCompetition(competitionId);
    const model = this.getModel(competition);
    const { task, resolvedTaskId } = this.resolveTask(model, parsed.taskId);

    const groups = this.groupCompositionProvider.getEffectiveGroups(
      competitionId,
      parsed.roundNumber,
      resolvedTaskId,
    );
    const seated = groups.some((g) => g.members.some((m) => m.rosterEntryId === parsed.rosterEntryId));
    if (!seated) {
      throw new CaptureTargetNotFoundError(
        `Roster entry ${parsed.rosterEntryId} is not seated in round ${parsed.roundNumber} of ${task.name}`,
      );
    }
    // pilotId denormalised at capture time — the seat's occupant right now
    // (EntryScoresProvider's planted contract).
    const entry = this.rosterProjection.getEntry(competitionId, parsed.rosterEntryId);
    if (!entry) {
      throw new CaptureTargetNotFoundError(`Roster entry ${parsed.rosterEntryId} not found`);
    }

    const payload: ResultCapturedPayload = {
      competitionId,
      roundNumber: parsed.roundNumber,
      taskId: resolvedTaskId,
      taskName: task.name,
      rosterEntryId: parsed.rosterEntryId,
      pilotId: entry.pilotId,
      raw: parsed.raw,
      resultKind: parsed.resultKind,
      capturedAt: new Date().toISOString(),
    };
    const record = this.eventStore.append({
      scope: competitionId,
      type: "scoring.resultCaptured",
      payload,
      attribution,
    });
    this.projection.apply(record);
    return {
      id: `${payload.roundNumber}|${payload.taskId}|${payload.rosterEntryId}|${payload.resultKind}`,
      ...payload,
    };
  }

  // Recompute the official score for one group, on demand — never a stored
  // fact (D4). Composes CapturedResultProjection + the effective group
  // composition + the class model, then which-score-counts (AC5) and
  // lone-pilot resolution (AC6/AC7).
  getGroupScore(
    competitionId: string,
    roundNumber: number,
    taskId: string,
    groupFlyingOrder: number,
  ): GroupScoreView {
    const competition = this.getCompetition(competitionId);
    const model = this.getModel(competition);
    const { task, resolvedTaskId } = this.resolveTask(model, taskId);

    const groups = this.groupCompositionProvider.getEffectiveGroups(competitionId, roundNumber, resolvedTaskId);
    const group = groups.find((g) => g.flyingOrder === groupFlyingOrder);
    if (!group) {
      throw new CaptureTargetNotFoundError(
        `Group ${groupFlyingOrder} does not exist in round ${roundNumber} of ${task.name}`,
      );
    }

    if (group.members.length > 1) {
      return this.scoreMultiPilotGroup(competitionId, roundNumber, resolvedTaskId, groupFlyingOrder, group, task);
    }
    return this.scoreLonePilotGroup(competitionId, roundNumber, resolvedTaskId, groupFlyingOrder, group, model, task);
  }

  private scoreMultiPilotGroup(
    competitionId: string,
    roundNumber: number,
    taskId: string,
    groupFlyingOrder: number,
    group: { members: { rosterEntryId: string }[] },
    task: TaskParameterSet,
  ): GroupScoreView {
    const memberIds = group.members.map((m) => m.rosterEntryId);
    const withResults: GroupEntryWithResults[] = memberIds.map((rosterEntryId) => ({
      rosterEntryId,
      results: this.projection
        .getResults(competitionId, roundNumber, taskId, rosterEntryId)
        .map((r) => ({ raw: r.raw, resultKind: r.resultKind })),
    }));
    // AC5: entitlement is observable from having captured a "reflight" result
    // at all — no separate "who is entitled" lookup is needed.
    const entitledIds = new Set(
      withResults.filter((e) => e.results.some((r) => r.resultKind === "reflight")).map((e) => e.rosterEntryId),
    );
    const groupEntries = withResults.map((e) => ({
      id: e.rosterEntryId,
      raw: selectOfficialResult(e, entitledIds.has(e.rosterEntryId), task.speedInverted),
    }));
    const normalised = normaliseGroup(groupEntries, { speedInverted: task.speedInverted });
    const byId = new Map(withResults.map((e) => [e.rosterEntryId, e]));
    const entries: GroupScoreEntry[] = normalised.map((n) => ({
      rosterEntryId: n.id,
      officialRaw: n.raw,
      normalised: n.normalised,
      countedResultKind: countedKindFor(byId.get(n.id)!, entitledIds.has(n.id), task.speedInverted),
    }));
    return {
      competitionId,
      roundNumber,
      taskId,
      groupFlyingOrder,
      entries,
      lonePilotMode: null,
      pendingAnnulmentOverride: false,
    };
  }

  private scoreLonePilotGroup(
    competitionId: string,
    roundNumber: number,
    taskId: string,
    groupFlyingOrder: number,
    group: { members: { rosterEntryId: string }[] },
    model: ContestClassModel,
    task: TaskParameterSet,
  ): GroupScoreView {
    const loneRosterEntryId = group.members[0]!.rosterEntryId;
    const existingDummy = this.projection.getLonePilotResolution(competitionId, roundNumber, taskId, groupFlyingOrder);
    const existingAnnulment = this.projection.getAnnulmentRequest(competitionId, roundNumber, taskId, groupFlyingOrder);

    let dummyId = existingDummy?.dummyRosterEntryId ?? null;
    let isAnnulled = !!existingAnnulment;

    // The FIRST recompute to observe this singleton materialises and
    // persists the resolution (RNG lives only here, Norm 5); every
    // subsequent recompute is a pure read (Safeguard 3 — never re-rolled).
    if (!existingDummy && !existingAnnulment) {
      const outcome = this.resolveLonePilot(
        competitionId,
        roundNumber,
        taskId,
        task.name,
        groupFlyingOrder,
        model,
        loneRosterEntryId,
      );
      if (outcome.mode === "annul") {
        isAnnulled = true;
      } else {
        dummyId = outcome.dummyRosterEntryId;
      }
    }

    if (isAnnulled || !dummyId) {
      // F3B (or any class fixing "annul"): no dummy is ever chosen for this
      // group within this story's surface (AC7) — recompute produces no
      // normalised scores until a future story's CD-approval action
      // supersedes the pending fact.
      return {
        competitionId,
        roundNumber,
        taskId,
        groupFlyingOrder,
        entries: [],
        lonePilotMode: "annul",
        pendingAnnulmentOverride: true,
      };
    }

    // Dummy path (AC6): the lone pilot is normalised against the dummy's own
    // captured raw (0 if uncaptured — normaliseGroup's existing all-non-
    // positive handling covers it, Safeguard 4). The dummy's own
    // GroupScoreEntry is never surfaced from this group's view.
    const loneResults = this.projection
      .getResults(competitionId, roundNumber, taskId, loneRosterEntryId)
      .map((r) => ({ raw: r.raw, resultKind: r.resultKind }));
    const dummyResults = this.projection
      .getResults(competitionId, roundNumber, taskId, dummyId)
      .map((r) => ({ raw: r.raw, resultKind: r.resultKind }));
    const loneEntry: GroupEntryWithResults = { rosterEntryId: loneRosterEntryId, results: loneResults };
    const dummyEntry: GroupEntryWithResults = { rosterEntryId: dummyId, results: dummyResults };
    const loneEntitled = loneResults.some((r) => r.resultKind === "reflight");
    const dummyEntitled = dummyResults.some((r) => r.resultKind === "reflight");
    const loneRaw = selectOfficialResult(loneEntry, loneEntitled, task.speedInverted);
    const dummyRaw = selectOfficialResult(dummyEntry, dummyEntitled, task.speedInverted);

    const normalised = normaliseGroup(
      [
        { id: loneRosterEntryId, raw: loneRaw },
        { id: dummyId, raw: dummyRaw },
      ],
      { speedInverted: task.speedInverted },
    );
    const loneNormalised = normalised.find((n) => n.id === loneRosterEntryId)!;
    return {
      competitionId,
      roundNumber,
      taskId,
      groupFlyingOrder,
      entries: [
        {
          rosterEntryId: loneRosterEntryId,
          officialRaw: loneNormalised.raw,
          normalised: loneNormalised.normalised,
          countedResultKind: countedKindFor(loneEntry, loneEntitled, task.speedInverted),
        },
      ],
      lonePilotMode: "dummy",
      pendingAnnulmentOverride: false,
    };
  }

  // AC6/AC7: (a) reads model.lonePilotBehaviour; (b) "annul" appends
  // scoring.annulmentOverrideRequested with no dummy chosen; (c) "dummy"
  // randomly selects one eligible other pilot (same exclusion rules as
  // re-flight filling: anyone already lone-pilot this round is excluded) and
  // appends scoring.lonePilotResolved. Data, never a code branch on
  // sourceClass/basis (Safeguard 5).
  private resolveLonePilot(
    competitionId: string,
    roundNumber: number,
    taskId: string,
    taskName: string,
    groupFlyingOrder: number,
    model: ContestClassModel,
    loneRosterEntryId: string,
  ): { mode: "annul" } | { mode: "dummy"; dummyRosterEntryId: string } {
    if (model.lonePilotBehaviour === "annul") {
      const payload: AnnulmentOverrideRequestedPayload = {
        competitionId,
        roundNumber,
        taskId,
        taskName,
        groupFlyingOrder,
        approvalStatus: "pending-contest-director-approval",
        reason: `${model.name} annuls a one-valid-result group (f3b.md); Contest Director approval is required to override with a dummy`,
      };
      const record = this.eventStore.append({
        scope: competitionId,
        type: "scoring.annulmentOverrideRequested",
        payload,
        attribution: SYSTEM_ATTRIBUTION,
      });
      this.projection.apply(record);
      return { mode: "annul" };
    }

    const groups = this.groupCompositionProvider.getEffectiveGroups(competitionId, roundNumber, taskId);
    const allSeatedIds = groups.flatMap((g) => g.members.map((m) => m.rosterEntryId));
    const loneSeatedIds = new Set(
      groups.filter((g) => g.members.length === 1).flatMap((g) => g.members.map((m) => m.rosterEntryId)),
    );
    const excludeIds = new Set<string>([loneRosterEntryId, ...loneSeatedIds]);
    const pool = eligibleOtherPilots(allSeatedIds, excludeIds);
    // At MVP scale a singleton group should always have an eligible other
    // pilot; an exhausted pool is a degenerate edge case (a round with only
    // one other seat, all of it lone-pilot) — fall back to the lone pilot's
    // own id rather than throw, so a recompute never hard-fails.
    const dummyRosterEntryId = pool.length > 0 ? pool[crypto.randomInt(pool.length)]! : loneRosterEntryId;

    const payload: LonePilotResolvedPayload = {
      competitionId,
      roundNumber,
      taskId,
      taskName,
      groupFlyingOrder,
      mode: "dummy",
      dummyRosterEntryId,
    };
    const record = this.eventStore.append({
      scope: competitionId,
      type: "scoring.lonePilotResolved",
      payload,
      attribution: SYSTEM_ATTRIBUTION,
    });
    this.projection.apply(record);
    return { mode: "dummy", dummyRosterEntryId };
  }

  // ---- cross-aggregate resolution ---------------------------------------

  private getCompetition(competitionId: string): Competition {
    const competition = this.competitionProjection.getById(competitionId);
    if (!competition) {
      throw new CaptureTargetNotFoundError(`Competition ${competitionId} not found`);
    }
    return competition;
  }

  private getModel(competition: Competition): ContestClassModel {
    const model = this.classModelProjection.getById(competition.classModelId);
    if (!model) {
      // A competition can never reference a missing model (016 blocks
      // deletion), so this is a genuine integrity fault, not a client 404.
      throw new CaptureTargetNotFoundError(`Class model ${competition.classModelId} not found`);
    }
    return model;
  }

  private resolveTask(
    model: ContestClassModel,
    requestedTaskId: string | undefined,
  ): { task: TaskParameterSet; resolvedTaskId: string } {
    const resolvedTaskId = requestedTaskId ?? model.tasks[0]!.id;
    const task = model.tasks.find((t) => t.id === resolvedTaskId);
    if (!task) {
      throw new CaptureTargetNotFoundError(`Task ${resolvedTaskId} not found on this class model`);
    }
    return { task, resolvedTaskId };
  }
}

// Which captured raw's *kind* was counted (AC5) — mirrors selectOfficialResult's
// rule exactly (kept local: GroupScoreEntry's `countedResultKind` field is a
// display/audit concern, not part of the shared pure function's numeric
// contract).
function countedKindFor(entry: GroupEntryWithResults, isEntitled: boolean, speedInverted: boolean): ResultKind {
  if (entry.results.length === 0) return "original";
  if (entry.results.length === 1) return entry.results[0]!.resultKind;
  const reflight = entry.results.find((r) => r.resultKind === "reflight");
  if (isEntitled && reflight) return "reflight";
  const best = entry.results.reduce((current, candidate) => {
    const candidateWins = speedInverted ? candidate.raw < current.raw : candidate.raw > current.raw;
    return candidateWins ? candidate : current;
  });
  return best.resultKind;
}

function parseOrThrow<S extends ZodType<unknown, z.ZodTypeDef, unknown>>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError("Validation failed", result.error.flatten());
  }
  return result.data;
}
