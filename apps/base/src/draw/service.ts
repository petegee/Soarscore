import crypto from "node:crypto";
import { z, type ZodType } from "zod";
import {
  saveDrawSpecRequestSchema,
  drawSpecToPayload,
  generatedDrawToPayload,
  eligibleOtherPilots,
  groupMoveRequestSchema,
  groupSplitRequestSchema,
  reflightPrepareRequestSchema,
  type Attribution,
  type Competition,
  type ConstraintWarning,
  type ContestClassModel,
  type DrawEvidenceView,
  type DrawSpecification,
  type EffectiveGroupsView,
  type EffectiveRound,
  type FairnessMetric,
  type FlightGroup,
  type GeneratedDraw,
  type GroupMembership,
  type GroupMovedPayload,
  type GroupSplitPayload,
  type LaneAllocationPolicy,
  type MatchupDistribution,
  type MeetCount,
  modelAllowsAllCompetitorsFallback,
  type ReflightPreparedPayload,
  type RoundDraw,
  type TaskGroupSet,
  type TaskMatchupDistribution,
  type TaskParameterSet,
} from "@soarscore/shared";
import type { EventStore } from "../eventstore/event-store.js";
import type { CompetitionProjection } from "../competitions/projection.js";
import type { ClassModelProjection } from "../class-models/projection.js";
import type { RosterProjection } from "../roster/projection.js";
import type { DrawProjection } from "./projection.js";
import {
  DrawCandidateNotFoundError,
  DrawCandidateSupersededError,
  DrawGenerationFailedError,
  DrawGroupSizeWarningUnacknowledgedError,
  DrawNotAcceptedError,
  DrawSpecNotFoundError,
  GroupMoveClashError,
  GroupMoveTargetNotFoundError,
  GroupSizeOutOfBoundsError,
  GroupSplitInvalidError,
  ReflightEntitlementNotFoundError,
  ValidationError,
} from "./errors.js";

// Fixed attempt budget (Decision #7). At MVP scale (≤ 20 pilots, ≤ 8 rounds) a
// couple hundred randomised attempts run comfortably and give the fairness
// metric a meaningful field to pick from. The retained draw is the "fairest of
// the attempts run", not a proven global optimum — the evidence says so.
const ATTEMPTS = 200;

export class DrawService {
  constructor(
    private readonly eventStore: EventStore,
    private readonly projection: DrawProjection,
    private readonly competitionProjection: CompetitionProjection,
    private readonly classModelProjection: ClassModelProjection,
    private readonly rosterProjection: RosterProjection,
  ) {}

  // The evidence read-model (4.3): the saved spec, the current candidate (null
  // until first generate), the accepted draw (null until the CD accepts, 017),
  // the three-valued acceptance status (AC2 — derived here so the projection
  // stays a pure loader), and the soft warnings recomputed against the live
  // roster. 404 only if the competition itself is absent.
  getEvidence(competitionId: string): DrawEvidenceView {
    const competition = this.getCompetition(competitionId);
    const model = this.getModel(competition);
    const spec = this.projection.getSpec(competitionId) ?? null;
    const candidate = this.projection.getCandidate(competitionId) ?? null;
    const accepted = this.projection.getAccepted(competitionId) ?? null;
    const status = accepted ? "accepted" : candidate ? "awaiting-decision" : "no-draw";
    const warnings = spec
      ? this.computeWarnings(spec, this.rosterSize(competitionId), this.resolveMin(model))
      : [];
    return { spec, candidate, accepted, status, warnings };
  }

  // Save (or replace) the validated draw specification. AC1 rejects a
  // groups-per-round that cannot satisfy the per-group minimum; AC2 warnings
  // ride the success response (never an error). The spec id is stable across
  // re-saves (mirrors the task-config overlay).
  saveSpec(competitionId: string, input: unknown, attribution: Attribution): DrawEvidenceView {
    const competition = this.getCompetition(competitionId);
    const model = this.getModel(competition);
    const allowsAllCompetitorsFallback = modelAllowsAllCompetitorsFallback(model);
    // The Zod cross-field refine structurally requires allowSingleGroup=true
    // whenever groupsPerRound=1 (Norm 2 — model-agnostic input shape). For a
    // class carrying the "or all competitors" escape (e.g. F3B Speed), a
    // single group is *always* rule-legal on its own account, so the CD
    // shouldn't have to separately tick the (unrelated) spare-scorer override
    // just to request it. Fill it in ahead of parsing rather than relaxing the
    // schema itself, keeping the schema's structural rule intact.
    const coercedInput =
      allowsAllCompetitorsFallback &&
      typeof input === "object" &&
      input !== null &&
      (input as Record<string, unknown>).groupsPerRound === 1
        ? { ...(input as Record<string, unknown>), allowSingleGroup: true }
        : input;
    const parsed = parseOrThrow(saveDrawSpecRequestSchema, coercedInput);

    const resolvedMin = this.resolveMin(model);
    const R = this.rosterSize(competitionId);
    // D1 hard bound — enforced at save whenever a roster exists (≥ 2 seats);
    // an empty/near-empty roster defers to generate (Safeguard 6) so the policy
    // can be authored before pilots are entered. The rule-fixed minimum no
    // longer hard-rejects here (D14) — a shortfall against it surfaces only as
    // a generate-time warning (STORY-001-022).
    if (R >= 2) {
      this.assertGroupBound(R, parsed.groupsPerRound, parsed.allowSingleGroup, allowsAllCompetitorsFallback);
    }

    const existing = this.projection.getSpec(competitionId);
    const spec: DrawSpecification = {
      id: existing?.id ?? crypto.randomUUID(),
      competitionId,
      classModelId: model.id,
      drawMode: parsed.drawMode,
      roundCount: parsed.roundCount,
      groupsPerRound: parsed.groupsPerRound,
      fairnessMetric: parsed.fairnessMetric,
      avoidConsecutiveFlights: parsed.avoidConsecutiveFlights,
      lanePolicy: parsed.lanePolicy,
      minGroupSizeOverride: parsed.minGroupSizeOverride,
      allowSingleGroup: parsed.allowSingleGroup,
    };

    const record = this.eventStore.append({
      scope: competitionId,
      type: "draw.specSaved",
      payload: drawSpecToPayload(spec),
      attribution,
    });
    this.projection.apply(record);

    const warnings = this.computeWarnings(spec, R, resolvedMin);
    const candidate = this.projection.getCandidate(competitionId) ?? null;
    const accepted = this.projection.getAccepted(competitionId) ?? null;
    return {
      spec: this.projection.getSpec(competitionId) ?? spec,
      candidate,
      accepted,
      status: accepted ? "accepted" : candidate ? "awaiting-decision" : "no-draw",
      warnings,
    };
  }

  // Generate a candidate draw: the fairest of ATTEMPTS randomised attempts by
  // the spec's metric. On success appends the fully materialised outcome
  // (draw.generated); on failure (AC6) appends nothing and throws with a reason.
  // This is the ONLY place RNG lives (Norm 5).
  generate(competitionId: string, attribution: Attribution): GeneratedDraw {
    const competition = this.getCompetition(competitionId);
    const model = this.getModel(competition);
    const spec = this.projection.getSpec(competitionId);
    if (!spec) {
      throw new DrawSpecNotFoundError(
        `Competition ${competitionId} has no saved draw specification to generate from`,
      );
    }
    const roster = this.rosterProjection.getRoster(competitionId);
    const seatIds = roster.map((entry) => entry.id);
    const R = seatIds.length;

    // Re-check the D1 bound against the *current* roster: it may have shrunk
    // since the spec was saved (Safeguard 6). Also rejects an empty roster
    // (R < 2). The rule-fixed minimum is no longer a hard rejection here
    // (D14) — each task's own minimum is resolved independently below
    // (STORY-001-020). assertGroupBound remains a single whole-spec gate on
    // spec.groupsPerRound itself — it never varies per task.
    this.assertGroupBound(R, spec.groupsPerRound, spec.allowSingleGroup, modelAllowsAllCompetitorsFallback(model));

    const contestNumbers = new Map<string, number | null>(
      roster.map((entry) => [entry.id, entry.pilotNumber]),
    );

    // Per-task generation (STORY-001-020): each of the class model's tasks
    // (F3B: Duration/Distance/Speed; every other class: exactly one) resolves
    // its own rule-fixed minimum and runs its own independent
    // ATTEMPTS-budget attempt/refine/score search — runAttempt already builds
    // a fresh meet map per call, so calling it once per task, unchanged,
    // already isolates each task's anti-repeat accounting from every other
    // task's. A single-task class's model.tasks has length 1, so this loop
    // runs exactly once — the identical code path as today (AC5, NFR-2), with
    // no discipline branch anywhere.
    const perTask = model.tasks.map((task) => {
      const { effectiveG, warning } = this.resolveGroupPlanForTask(
        model,
        task,
        R,
        spec.groupsPerRound,
        spec.allowSingleGroup,
      );

      let bestPlacement: string[][][] | null = null;
      let bestDistribution: MatchupDistribution | null = null;
      let bestKey: number[] | null = null;
      for (let i = 0; i < ATTEMPTS; i++) {
        const placement = this.runAttempt(seatIds, spec, effectiveG);
        if (!placement) continue;
        const distribution = this.computeDistribution(placement, seatIds);
        const key = scoreKey(distribution, spec.fairnessMetric);
        if (bestKey === null || keyLess(key, bestKey)) {
          bestPlacement = placement;
          bestDistribution = distribution;
          bestKey = key;
        }
      }

      if (!bestPlacement || !bestDistribution) {
        // AC6: no attempt yielded a valid draw for this task (e.g. the
        // no-back-to-back rule is unsatisfiable for its grouping alone, even
        // if other tasks succeed). Nothing is appended (Safeguard 3). Name
        // the task so the failure is traceable to which one dead-ended.
        throw new DrawGenerationFailedError(
          `Could not generate a valid draw for ${task.name} after ${ATTEMPTS} attempts — the constraints may be unsatisfiable for this roster and specification`,
        );
      }

      return { task, placement: bestPlacement, distribution: bestDistribution, warning };
    });

    const taskGroups: TaskGroupSet[][] = perTask.map(({ task, placement }) =>
      placement.map((_roundPlacement, roundIdx) => ({
        taskId: task.id,
        taskName: task.name,
        groups: this.materialiseOneTasksGroups(placement, roundIdx, spec.lanePolicy, contestNumbers),
      })),
    );
    // taskGroups is task-major (one array per task, each with one entry per
    // round); transpose to round-major for RoundDraw[] below.
    const roundCount = perTask[0]?.placement.length ?? 0;
    const rounds: RoundDraw[] = Array.from({ length: roundCount }, (_, roundIdx) => {
      const roundTaskGroups = taskGroups.map((taskRounds) => taskRounds[roundIdx]!);
      return {
        roundNumber: roundIdx + 1,
        groups: roundTaskGroups[0]!.groups,
        taskGroups: roundTaskGroups,
      };
    });

    const taskDistributions: TaskMatchupDistribution[] = perTask.map(({ task, distribution }) => ({
      taskId: task.id,
      taskName: task.name,
      distribution,
      metricValue: metricValueOf(distribution, spec.fairnessMetric),
    }));

    const draw: GeneratedDraw = {
      id: crypto.randomUUID(),
      competitionId,
      specId: spec.id,
      rounds,
      metric: spec.fairnessMetric,
      metricValue: taskDistributions[0]!.metricValue,
      distribution: taskDistributions[0]!.distribution,
      attemptsRun: ATTEMPTS,
      groupSizeWarnings: perTask.map((p) => p.warning).filter((w): w is ConstraintWarning => w !== null),
      taskDistributions,
    };

    const record = this.eventStore.append({
      scope: competitionId,
      type: "draw.generated",
      payload: generatedDrawToPayload(draw),
      attribution,
    });
    this.projection.apply(record);
    return this.projection.getCandidate(competitionId) ?? draw;
  }

  // Accept the awaiting-decision candidate as the contest's one authoritative
  // accepted draw (STORY-001-017, AC1). The event carries only references —
  // acceptance is a *promotion* of the stored draw.generated outcome, bound to
  // a specific candidate id (AC6) so a stale decision can never attach to a
  // superseded attempt. Accept is permitted whenever a candidate awaits a
  // decision (cancel → generate → accept is a valid cycle); re-draw *after*
  // acceptance is out of scope (Area 5.5). Attribution is the CD's (D1:
  // recorded, not enforced).
  accept(
    competitionId: string,
    drawId: string,
    acknowledgedWarningIds: string[],
    attribution: Attribution,
  ): DrawEvidenceView {
    this.getCompetition(competitionId);
    const candidate = this.projection.getCandidate(competitionId);
    if (!candidate) {
      // AC5: nothing is appended.
      throw new DrawCandidateNotFoundError(
        `Competition ${competitionId} has no generated draw awaiting a decision; generate a draw first`,
      );
    }
    if (candidate.id !== drawId) {
      throw new DrawCandidateSupersededError(
        "The referenced draw has been superseded by a newer generation; re-read the draw and decide again",
      );
    }

    // STORY-001-022 AC3: every group-size-minimum warning on this specific
    // candidate must be acknowledged by id before it can be accepted. A draw
    // with no such warnings accepts exactly as before this story.
    const missing = candidate.groupSizeWarnings.filter(
      (warning) => warning.id && !acknowledgedWarningIds.includes(warning.id),
    );
    if (missing.length > 0) {
      throw new DrawGroupSizeWarningUnacknowledgedError(
        `The following group-size warning(s) must be acknowledged before accepting this draw: ${missing
          .map((warning) => warning.message)
          .join("; ")}`,
      );
    }

    const record = this.eventStore.append({
      scope: competitionId,
      type: "draw.accepted",
      payload: {
        competitionId,
        drawId: candidate.id,
        specId: candidate.specId,
        acknowledgedWarningIds,
      },
      attribution,
    });
    this.projection.apply(record);
    return this.getEvidence(competitionId);
  }

  // Cancel (discard) the awaiting-decision candidate (STORY-001-017, AC4): the
  // contest returns to a generatable no-draw state; the spec is retained.
  // Rejections mirror accept — no candidate (nothing to cancel) and a stale id
  // are both refused, and nothing is appended.
  cancel(competitionId: string, drawId: string, attribution: Attribution): DrawEvidenceView {
    this.getCompetition(competitionId);
    const candidate = this.projection.getCandidate(competitionId);
    if (!candidate) {
      throw new DrawCandidateNotFoundError(
        `Competition ${competitionId} has no generated draw awaiting a decision; there is nothing to cancel`,
      );
    }
    if (candidate.id !== drawId) {
      throw new DrawCandidateSupersededError(
        "The referenced draw has been superseded by a newer generation; re-read the draw and decide again",
      );
    }

    const record = this.eventStore.append({
      scope: competitionId,
      type: "draw.cancelled",
      payload: { competitionId, drawId: candidate.id },
      attribution,
    });
    this.projection.apply(record);
    return this.getEvidence(competitionId);
  }

  // ---- STORY-001-011: group management + re-flight preparation ----------

  // AC1/AC2: move one seat between two groups of the same round/task on the
  // *accepted* draw. Clash-checked before any append (Safeguard 1) — nothing
  // is appended if any check fails.
  moveGroup(competitionId: string, input: unknown, attribution: Attribution): EffectiveGroupsView {
    const parsed = parseOrThrow(groupMoveRequestSchema, input);
    const competition = this.getCompetition(competitionId);
    const model = this.getModel(competition);
    const accepted = this.projection.getAccepted(competitionId);
    if (!accepted) {
      throw new DrawNotAcceptedError(
        `Competition ${competitionId} has no accepted draw to adjust — accept a draw first`,
      );
    }
    const { task, resolvedTaskId } = this.resolveTask(model, parsed.taskId);

    const effective = this.projection.getEffectiveGroups(competitionId, parsed.roundNumber, resolvedTaskId);
    if (effective.length === 0) {
      throw new GroupMoveTargetNotFoundError(
        `Round ${parsed.roundNumber} of ${task.name} has no groups in the accepted draw`,
      );
    }
    const fromGroup = effective.find((g) =>
      g.members.some((m) => m.rosterEntryId === parsed.rosterEntryId),
    );
    if (!fromGroup) {
      throw new GroupMoveTargetNotFoundError(
        `Roster entry ${parsed.rosterEntryId} is not seated in round ${parsed.roundNumber} of ${task.name}`,
      );
    }
    const toGroup = effective.find((g) => g.flyingOrder === parsed.toGroupFlyingOrder);
    if (!toGroup) {
      throw new GroupMoveTargetNotFoundError(
        `Group ${parsed.toGroupFlyingOrder} does not exist in round ${parsed.roundNumber} of ${task.name}`,
      );
    }
    if (fromGroup.flyingOrder === toGroup.flyingOrder) {
      throw new GroupMoveTargetNotFoundError("The pilot is already in the target group");
    }

    // Clash (a): the destination group must have room — the move must not
    // itself starve the *source* group below its resolved minimum without a
    // compensating fill (Approach §2). An already-lonePilotFlagged source
    // dropping further isn't a *new* clash.
    const min = task.minGroupSize ?? 1;
    if (fromGroup.members.length - 1 < min && !fromGroup.lonePilotFlagged) {
      throw new GroupMoveClashError(
        `group-size-minimum: moving this pilot would drop round ${parsed.roundNumber}'s group ${fromGroup.flyingOrder} (${task.name}) below the required minimum of ${min} scoring pilots`,
      );
    }

    // Clash (b): the consecutive-flight constraint (AC2), only when the
    // accepted spec opted in.
    const spec = this.projection.getSpec(competitionId);
    if (spec?.avoidConsecutiveFlights) {
      this.assertNoConsecutiveFlightClash(
        competitionId,
        resolvedTaskId,
        task.name,
        parsed.roundNumber,
        parsed.rosterEntryId,
        toGroup.flyingOrder,
        effective.length,
      );
    }

    const payload: GroupMovedPayload = {
      competitionId,
      drawId: accepted.id,
      roundNumber: parsed.roundNumber,
      taskId: resolvedTaskId,
      taskName: task.name,
      rosterEntryId: parsed.rosterEntryId,
      fromGroupFlyingOrder: fromGroup.flyingOrder,
      toGroupFlyingOrder: toGroup.flyingOrder,
    };
    const record = this.eventStore.append({
      scope: competitionId,
      type: "draw.groupMoved",
      payload,
      attribution,
    });
    this.projection.apply(record);
    return this.buildEffectiveGroupsView(competitionId, accepted.id, resolvedTaskId, task.name);
  }

  // AC1: split sourceGroupFlyingOrder's membership, carving
  // movedRosterEntryIds off into a brand-new group. Reuses the same
  // resolution as moveGroup, substituting "both resulting groups clear the
  // floor" for the single-group check.
  splitGroup(competitionId: string, input: unknown, attribution: Attribution): EffectiveGroupsView {
    const parsed = parseOrThrow(groupSplitRequestSchema, input);
    const competition = this.getCompetition(competitionId);
    const model = this.getModel(competition);
    const accepted = this.projection.getAccepted(competitionId);
    if (!accepted) {
      throw new DrawNotAcceptedError(
        `Competition ${competitionId} has no accepted draw to adjust — accept a draw first`,
      );
    }
    const { task, resolvedTaskId } = this.resolveTask(model, parsed.taskId);

    const effective = this.projection.getEffectiveGroups(competitionId, parsed.roundNumber, resolvedTaskId);
    const source = effective.find((g) => g.flyingOrder === parsed.sourceGroupFlyingOrder);
    if (!source) {
      throw new GroupMoveTargetNotFoundError(
        `Group ${parsed.sourceGroupFlyingOrder} does not exist in round ${parsed.roundNumber} of ${task.name}`,
      );
    }

    const sourceIds = new Set(source.members.map((m) => m.rosterEntryId));
    const movedIds = new Set(parsed.movedRosterEntryIds);
    const isStrictSubset =
      movedIds.size === parsed.movedRosterEntryIds.length &&
      movedIds.size > 0 &&
      movedIds.size < source.members.length &&
      [...movedIds].every((id) => sourceIds.has(id));
    if (!isStrictSubset) {
      throw new GroupSplitInvalidError(
        `The pilots to move must be a strict, non-empty subset of group ${source.flyingOrder}'s current membership`,
      );
    }

    // Floor check: neither resulting group may be left empty. Unlike a
    // *move* (whose group-size-minimum clash actively protects an existing
    // group from being starved, AC1), a deliberate split producing a
    // singleton is exactly this story's mechanism for constructing a
    // post-disruption lone-pilot group (AC6/AC7) — Norm 4 treats a
    // split-induced singleton and a draw-time-flagged one identically at
    // recompute time, so the split action must be able to create one. This
    // is a deliberate, narrower reading than the Canvas's literal "neither
    // resulting group drops below 2 unless already permitted" text — that
    // reading would make AC6's own "via a split that leaves a singleton"
    // scenario unreachable for every class except F3B Speed (the one task
    // carrying minGroupSizeAllCompetitorsFallback), which cannot be the
    // intent given AC6 is framed as "a non-F3B group".
    const remainingCount = source.members.length - movedIds.size;
    if (remainingCount < 1 || movedIds.size < 1) {
      throw new GroupSplitInvalidError(
        `Splitting group ${source.flyingOrder} of round ${parsed.roundNumber} (${task.name}) would leave an empty group`,
      );
    }

    const newGroupFlyingOrder = Math.max(0, ...effective.map((g) => g.flyingOrder)) + 1;
    const payload: GroupSplitPayload = {
      competitionId,
      drawId: accepted.id,
      roundNumber: parsed.roundNumber,
      taskId: resolvedTaskId,
      taskName: task.name,
      sourceGroupFlyingOrder: source.flyingOrder,
      newGroupFlyingOrder,
      movedRosterEntryIds: parsed.movedRosterEntryIds,
    };
    const record = this.eventStore.append({
      scope: competitionId,
      type: "draw.groupSplit",
      payload,
      attribution,
    });
    this.projection.apply(record);
    return this.buildEffectiveGroupsView(competitionId, accepted.id, resolvedTaskId, task.name);
  }

  // AC3/AC4: build a new re-flyer group to the task's resolved minimum by
  // random draw from eligible others, and record the pending-CD-approval
  // handoff (Safeguard 6) — never appends a second event that flips it.
  prepareReflight(
    competitionId: string,
    input: unknown,
    attribution: Attribution,
  ): ReflightPreparedPayload {
    const parsed = parseOrThrow(reflightPrepareRequestSchema, input);
    const competition = this.getCompetition(competitionId);
    const model = this.getModel(competition);
    const accepted = this.projection.getAccepted(competitionId);
    if (!accepted) {
      throw new DrawNotAcceptedError(
        `Competition ${competitionId} has no accepted draw to adjust — accept a draw first`,
      );
    }
    const { task, resolvedTaskId } = this.resolveTask(model, parsed.taskId);

    const effective = this.projection.getEffectiveGroups(competitionId, parsed.roundNumber, resolvedTaskId);
    const allSeatedIds = effective.flatMap((g) => g.members.map((m) => m.rosterEntryId));
    if (!allSeatedIds.includes(parsed.entitledRosterEntryId)) {
      throw new ReflightEntitlementNotFoundError(
        `Roster entry ${parsed.entitledRosterEntryId} is not seated in round ${parsed.roundNumber} of ${task.name}`,
      );
    }

    // Every other competitor already in a re-flight group this round/task,
    // and anyone whose own group is currently lonePilotFlagged, is excluded
    // from the filler pool (Approach §3, a stated conservative assumption) —
    // a filler draw must never create a *second* lone-pilot group as a side
    // effect.
    const existingPreparations = this.projection
      .getReflightPreparations(competitionId)
      .filter((p) => p.roundNumber === parsed.roundNumber && p.taskId === resolvedTaskId);
    const alreadyInReflight = new Set<string>();
    for (const p of existingPreparations) {
      alreadyInReflight.add(p.entitledRosterEntryId);
      for (const filler of p.fillerRosterEntryIds) alreadyInReflight.add(filler);
    }
    const loneSeatedIds = new Set(
      effective.filter((g) => g.lonePilotFlagged).flatMap((g) => g.members.map((m) => m.rosterEntryId)),
    );
    const excludeIds = new Set<string>([
      parsed.entitledRosterEntryId,
      ...alreadyInReflight,
      ...loneSeatedIds,
    ]);
    const pool = eligibleOtherPilots(allSeatedIds, excludeIds);

    // The task's resolved minimum (never a hardcoded "4"/"6", Safeguard 7);
    // one seat is the entitled pilot, so min - 1 fillers are drawn.
    const min = task.minGroupSize ?? 1;
    const fillerCount = Math.max(0, min - 1);
    const fillers: string[] = [];
    const remaining = [...pool];
    for (let i = 0; i < fillerCount && remaining.length > 0; i++) {
      const index = crypto.randomInt(remaining.length);
      fillers.push(remaining.splice(index, 1)[0]!);
    }

    const reflightGroupFlyingOrder = Math.max(0, ...effective.map((g) => g.flyingOrder)) + 1;
    const payload: ReflightPreparedPayload = {
      competitionId,
      drawId: accepted.id,
      roundNumber: parsed.roundNumber,
      taskId: resolvedTaskId,
      taskName: task.name,
      entitledRosterEntryId: parsed.entitledRosterEntryId,
      reflightGroupFlyingOrder,
      fillerRosterEntryIds: fillers,
      approvalStatus: "pending-contest-director-approval",
      reason: parsed.reason,
    };
    const record = this.eventStore.append({
      scope: competitionId,
      type: "draw.reflightPrepared",
      payload,
      attribution,
    });
    this.projection.apply(record);
    return payload;
  }

  // The effective-groups read view for one task across every round of the
  // accepted draw (defaults taskId to model.tasks[0].id, same idiom as every
  // other task-scoped entry point here).
  getEffectiveGroups(competitionId: string, taskId?: string): EffectiveGroupsView {
    const competition = this.getCompetition(competitionId);
    const model = this.getModel(competition);
    const accepted = this.projection.getAccepted(competitionId);
    if (!accepted) {
      throw new DrawNotAcceptedError(
        `Competition ${competitionId} has no accepted draw`,
      );
    }
    const { task, resolvedTaskId } = this.resolveTask(model, taskId);
    return this.buildEffectiveGroupsView(competitionId, accepted.id, resolvedTaskId, task.name);
  }

  // Resolve the requested taskId against the model, defaulting to
  // model.tasks[0].id (single-task classes never see a selector) — the exact
  // idiom STORY-001-020 established for per-task requests.
  private resolveTask(
    model: ContestClassModel,
    requestedTaskId: string | undefined,
  ): { task: TaskParameterSet; resolvedTaskId: string } {
    const resolvedTaskId = requestedTaskId ?? model.tasks[0]!.id;
    const task = model.tasks.find((t) => t.id === resolvedTaskId);
    if (!task) {
      throw new GroupMoveTargetNotFoundError(`Task ${resolvedTaskId} not found on this class model`);
    }
    return { task, resolvedTaskId };
  }

  // AC2: reuses STORY-001-009's no-back-to-back rule verbatim — a seat must
  // not end up in the last group of round r AND the first group of round
  // r+1. Checked in both directions against the destination's position:
  // moving into the round's last group checks round r+1's first group;
  // moving into the round's first group checks round r-1's last group.
  private assertNoConsecutiveFlightClash(
    competitionId: string,
    taskId: string,
    taskName: string,
    roundNumber: number,
    rosterEntryId: string,
    destinationFlyingOrder: number,
    groupCountThisRound: number,
  ): void {
    const isLastGroup = destinationFlyingOrder === groupCountThisRound;
    const isFirstGroup = destinationFlyingOrder === 1;

    if (isLastGroup) {
      const nextRoundGroups = this.projection.getEffectiveGroups(competitionId, roundNumber + 1, taskId);
      const inFirstGroupNextRound = nextRoundGroups.some(
        (g) => g.flyingOrder === 1 && g.members.some((m) => m.rosterEntryId === rosterEntryId),
      );
      if (inFirstGroupNextRound) {
        throw new GroupMoveClashError(
          `consecutive-flight: moving into round ${roundNumber}'s last group of ${taskName} would place this pilot in the last group of round ${roundNumber} and the first group of round ${roundNumber + 1}, violating the no-back-to-back constraint`,
        );
      }
    }
    if (isFirstGroup) {
      const prevRoundGroups = this.projection.getEffectiveGroups(competitionId, roundNumber - 1, taskId);
      const lastFlyingOrderPrev = Math.max(0, ...prevRoundGroups.map((g) => g.flyingOrder));
      const inLastGroupPrevRound = prevRoundGroups.some(
        (g) => g.flyingOrder === lastFlyingOrderPrev && g.members.some((m) => m.rosterEntryId === rosterEntryId),
      );
      if (inLastGroupPrevRound) {
        throw new GroupMoveClashError(
          `consecutive-flight: moving into round ${roundNumber}'s first group of ${taskName} would place this pilot in the last group of round ${roundNumber - 1} and the first group of round ${roundNumber}, violating the no-back-to-back constraint`,
        );
      }
    }
  }

  // The EffectiveGroupsView read shape shared by moveGroup/splitGroup/
  // getEffectiveGroups: every round of the accepted draw, this task's
  // effective groups, and which of them are re-flyer groups.
  private buildEffectiveGroupsView(
    competitionId: string,
    drawId: string,
    taskId: string,
    taskName: string,
  ): EffectiveGroupsView {
    const accepted = this.projection.getAccepted(competitionId);
    const reflightPreparations = this.projection
      .getReflightPreparations(competitionId)
      .filter((p) => p.taskId === taskId);
    const rounds: EffectiveRound[] = (accepted?.rounds ?? []).map((round) => {
      const groups = this.projection.getEffectiveGroups(competitionId, round.roundNumber, taskId);
      const reflightFlyingOrdersThisRound = new Set(
        reflightPreparations
          .filter((p) => p.roundNumber === round.roundNumber)
          .map((p) => p.reflightGroupFlyingOrder),
      );
      return {
        roundNumber: round.roundNumber,
        groups,
        reflightGroupFlags: groups.map((g) => reflightFlyingOrdersThisRound.has(g.flyingOrder)),
      };
    });
    return { drawId, taskId, taskName, rounds };
  }

  // ---- cross-aggregate resolution ---------------------------------------

  private getCompetition(competitionId: string): Competition {
    const competition = this.competitionProjection.getById(competitionId);
    if (!competition) {
      throw new DrawSpecNotFoundError(`Competition ${competitionId} not found`);
    }
    return competition;
  }

  private getModel(competition: Competition): ContestClassModel {
    const model = this.classModelProjection.getById(competition.classModelId);
    if (!model) {
      // A competition can never reference a missing model (016 blocks deletion),
      // so this is a genuine integrity fault, not a client 404.
      throw new DrawSpecNotFoundError(`Class model ${competition.classModelId} not found`);
    }
    return model;
  }

  private rosterSize(competitionId: string): number {
    return this.rosterProjection.getRoster(competitionId).length;
  }

  // The class model's rule-fixed per-group minimum: the largest of its tasks'
  // rule-fixed minima; null everywhere → 1 (no rule minimum, only the D1
  // two-per-group rule applies). No longer influenced by the Organiser's
  // pre-emptive minGroupSizeOverride (deprecated per D14 consequence 3) — a
  // genuine shortfall now warns-and-generates instead (STORY-001-022).
  private resolveMin(model: ContestClassModel): number {
    const mins = model.tasks
      .map((task) => task.minGroupSize)
      .filter((value): value is number => value !== null);
    return mins.length > 0 ? Math.max(...mins) : 1;
  }

  // The *only* remaining hard-rejection gate (D14 consequence 1): the D1
  // two-scoring-pilot floor. With G groups over R seats the smallest group is
  // floor(R/G); reject only if that would drop below 2. The rule-fixed
  // minimum's shortfall no longer rejects here — it moves to the
  // warn-and-generate path (resolveEffectiveGroupsPerRound /
  // computeGroupSizeMinimumWarning) below.
  //
  // A single group (G = 1) is a special case handled separately, not folded
  // into [lower, upper]: it's permitted either by the Organiser's spare-scorer
  // override, or — independent of that override — whenever the class model
  // has a task whose minimum carries the "or all competitors" escape (e.g.
  // F3B.1.8b Task C: min 8 or all competitors). In the latter case a single
  // group containing the whole roster is always rule-legal regardless of R
  // (STORY-001-019 fix). A groupsPerRound of 1 without either allowance never
  // reaches here for a fresh save — the Zod cross-field refine rejects it
  // first as VALIDATION_FAILED — but saveSpec pre-parse coercion and
  // generate's re-check both route through here too.
  private assertGroupBound(
    R: number,
    G: number,
    allowSingleGroup: boolean,
    allowsAllCompetitorsFallback: boolean,
  ): void {
    const singleGroupPermitted = allowSingleGroup || allowsAllCompetitorsFallback;
    if (G === 1) {
      if (!singleGroupPermitted) {
        throw new GroupSizeOutOfBoundsError(
          `Groups per round must be at least 2 for a roster of ${R} unless the spare-scorer override is set`,
        );
      }
      return;
    }
    const maxByD1 = Math.floor(R / 2); // D1: every group needs ≥ 2 scoring pilots
    if (maxByD1 < 2 || G > maxByD1) {
      const singleGroupHint = allowsAllCompetitorsFallback
        ? ` a single group of all ${R} competitors (groupsPerRound = 1) is always valid for this class instead;`
        : "";
      const rangeClause =
        maxByD1 < 2
          ? `no groups-per-round value of 2 or more is valid for a roster of ${R}`
          : `groups per round must be between 2 and ${maxByD1} for a roster of ${R}`;
      throw new GroupSizeOutOfBoundsError(
        `${rangeClause} (at most ${maxByD1} group${maxByD1 === 1 ? "" : "s"} keep two scoring pilots per group);` +
          singleGroupHint +
          ` ${G} would force a group below two`,
      );
    }
  }

  // STORY-001-020: the task-scoped analogue of the pre-story `resolveGroupPlan`
  // — resolves one task's own minimum/escape instead of the whole model's
  // Math.max reduction, so a task's own rule-fixed minimum governs only that
  // task's own groups (AC2). The "closest available grouping" fallback logic
  // itself is unchanged from STORY-001-022, just parameterised per task.
  //
  // Returns the requested groups-per-round unchanged whenever it already
  // clears this task's own resolved minimum (or the task has no minimum at
  // all); otherwise searches downward for the largest group count that does,
  // never searching above the requested count — "closest" means fewer,
  // larger groups, never more groups than the Organiser asked for.
  //
  // The search floor is 1 (a single whole-roster group) ONLY when
  // `allowSingleGroup` (the CD's spare-scorer consent) or this task's own
  // `minGroupSizeAllCompetitorsFallback` escape applies — mirrors
  // assertGroupBound's own single-group consent gate, now evaluated per task
  // rather than via the whole-model `modelAllowsAllCompetitorsFallback`.
  //
  // Deviation from the Canvas's literal call-site pseudocode: that snippet
  // shows `resolveGroupPlanForTask(task, R, requestedG, allowSingleGroup)`
  // with no `model` parameter, but the same section's "Otherwise build the
  // warning via computeGroupSizeMinimumWarningForTask" step requires `model`
  // (for `model.name` and `model.groupSizeMinimumClause`). `model` is
  // added here as a fifth parameter to resolve that internal inconsistency —
  // the alternative (deriving the clause/name without the model) isn't
  // possible, so this is the minimal fix.
  private resolveGroupPlanForTask(
    model: ContestClassModel,
    task: TaskParameterSet,
    R: number,
    requestedG: number,
    allowSingleGroup: boolean,
  ): { effectiveG: number; warning: ConstraintWarning | null } {
    const resolvedMin = task.minGroupSize ?? 1;
    if (resolvedMin <= 1 || Math.floor(R / requestedG) >= resolvedMin) {
      return { effectiveG: requestedG, warning: null };
    }
    const floorG = allowSingleGroup || task.minGroupSizeAllCompetitorsFallback ? 1 : 2;
    for (let g = requestedG - 1; g >= floorG; g--) {
      if (Math.floor(R / g) >= resolvedMin) return { effectiveG: g, warning: null };
    }
    const effectiveG = floorG;
    // A single group containing literally all competitors is always
    // rule-compliant when this task carries the "or all competitors" escape
    // (e.g. F3B.1.8b Task C: Speed), regardless of the numeric minimum — so
    // no warning is raised for that case, even though the fallback only
    // reached G=1 as a last resort. Evaluated per task (never via the
    // whole-model modelAllowsAllCompetitorsFallback) so a task without the
    // escape still warns even if a sibling task has it.
    if (effectiveG === 1 && task.minGroupSizeAllCompetitorsFallback) {
      return { effectiveG, warning: null };
    }
    return {
      effectiveG,
      warning: this.computeGroupSizeMinimumWarningForTask(model, task, R, requestedG, effectiveG),
    };
  }

  // STORY-001-020: build a task-qualified, individually-acknowledgeable
  // warning when a task's own minimum cannot be met. The rule clause text
  // itself doesn't differ by task (model.groupSizeMinimumClause stays keyed
  // on the class, since F3B.1.8b's clause is shared by all three tasks) —
  // only the numeric minimum and the task name differ.
  private computeGroupSizeMinimumWarningForTask(
    model: ContestClassModel,
    task: TaskParameterSet,
    R: number,
    requestedG: number,
    effectiveG: number,
  ): ConstraintWarning {
    const ruleClause = model.groupSizeMinimumClause ?? "the class's group-size rule";
    return {
      // Task-qualified id (STORY-001-020): so AC4's Speed warning and any
      // co-occurring Duration/Distance warning stay independently
      // acknowledgeable via accept()'s existing by-id filter, unchanged.
      id: `group-size-minimum:${task.id}`,
      constraint: "group-size-minimum",
      message:
        `${model.name}: ${task.name} — ${ruleClause} requires at least ${task.minGroupSize} per group; ` +
        `a roster of ${R} requesting ${requestedG} group(s) cannot meet it, so ${effectiveG} group(s) were generated instead`,
    };
  }

  // AC2 soft warnings: constraints that cannot be *jointly* satisfied for this
  // roster/spec. Non-blocking — they ride the success response, never an error.
  private computeWarnings(
    spec: DrawSpecification,
    R: number,
    _resolvedMin: number,
  ): ConstraintWarning[] {
    const warnings: ConstraintWarning[] = [];
    if (R < 2) {
      warnings.push({
        constraint: "roster-size",
        message:
          "The roster is too small to validate group sizes yet; add pilots before generating the draw",
      });
      return warnings;
    }
    const groupSize = Math.floor(R / spec.groupsPerRound);
    // Anti-repeat is infeasible when a pilot must meet more opponents over the
    // rounds than the roster can supply distinctly — some pairings must repeat.
    if (spec.roundCount * (groupSize - 1) > R - 1) {
      warnings.push({
        constraint: "anti-repeat",
        message:
          `Over ${spec.roundCount} rounds each pilot meets more opponents than the ${R - 1} available, ` +
          "so some pairings must repeat; the draw minimises repeats but cannot avoid them all",
      });
    }
    // With a single group (spare-scorer override) the no-back-to-back rule is
    // strictly unsatisfiable over ≥ 2 rounds: the round's only group is both
    // last and first, so every seat flies back-to-back. Warn at save (AC2);
    // generation would fail (AC6).
    if (spec.avoidConsecutiveFlights && spec.groupsPerRound === 1 && spec.roundCount >= 2) {
      warnings.push({
        constraint: "avoid-consecutive-flights",
        message:
          "With a single group the no-back-to-back constraint cannot be satisfied over multiple rounds — the round's only group is both last and first",
      });
    }
    // With only two groups the no-back-to-back rule is very tight: a seat in the
    // last group is barred from the first group next round, over-constraining.
    if (spec.avoidConsecutiveFlights && spec.groupsPerRound === 2) {
      warnings.push({
        constraint: "avoid-consecutive-flights",
        message:
          "With only two groups the no-back-to-back constraint is very tight and may be unsatisfiable; consider more groups per round",
      });
    }
    return warnings;
  }

  // ---- generation algorithm (RNG lives here only) -----------------------

  // One randomised attempt: random initial order per round, then a greedy
  // anti-repeat placement (each seat joins the group that adds the fewest prior
  // meets, ties broken randomly), carrying a meet-count matrix forward across
  // rounds. When avoidConsecutiveFlights, a seat in the last group of round r is
  // barred from the first group of round r+1. Returns rounds→groups→seatIds, or
  // null if the constraints dead-ended this attempt (anti-repeat degrades
  // gracefully; only the consecutive-flight rule can hard-fail an attempt).
  private runAttempt(seatIds: string[], spec: DrawSpecification, groupsPerRound: number): string[][][] | null {
    const G = groupsPerRound;
    const R = seatIds.length;
    const meet = new Map<string, number>();
    let prevGroupIndex: Map<string, number> | null = null;
    const rounds: string[][][] = [];

    for (let r = 0; r < spec.roundCount; r++) {
      const caps = groupCapacities(R, G);
      const groups: string[][] = Array.from({ length: G }, () => []);
      for (const seat of shuffle(seatIds)) {
        let candidates: number[] = [];
        for (let i = 0; i < G; i++) {
          if (groups[i]!.length < caps[i]!) candidates.push(i);
        }
        if (spec.avoidConsecutiveFlights && prevGroupIndex?.get(seat) === G - 1) {
          candidates = candidates.filter((i) => i !== 0);
        }
        if (candidates.length === 0) return null;

        let best: number[] = [];
        let bestCost = Infinity;
        for (const g of candidates) {
          let cost = 0;
          for (const member of groups[g]!) cost += meet.get(pairKey(seat, member)) ?? 0;
          if (cost < bestCost) {
            bestCost = cost;
            best = [g];
          } else if (cost === bestCost) {
            best.push(g);
          }
        }
        groups[best[crypto.randomInt(best.length)]!]!.push(seat);
      }

      // Local search: hill-climb pairwise swaps between groups that reduce this
      // round's added repeats (given the prior-round meet matrix), respecting the
      // no-back-to-back bar. Greedy placement alone paints late seats into
      // corners; this recovers most of the achievable anti-repeat fairness.
      const forbidden = (seat: string, groupIndex: number): boolean =>
        spec.avoidConsecutiveFlights && prevGroupIndex?.get(seat) === G - 1 && groupIndex === 0;
      improveRound(groups, meet, forbidden);

      for (const group of groups) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const key = pairKey(group[i]!, group[j]!);
            meet.set(key, (meet.get(key) ?? 0) + 1);
          }
        }
      }
      prevGroupIndex = new Map();
      groups.forEach((group, index) => group.forEach((seat) => prevGroupIndex!.set(seat, index)));
      rounds.push(groups);
    }

    // Global refine (coordinate descent): re-optimise each round against every
    // *other* round's meets, not just the ones before it — the per-round greedy
    // leaves large residual excess a whole-draw pass recovers. Skipped when the
    // no-back-to-back rule is on: that couples adjacent rounds, so a swap in one
    // round could invalidate its neighbour's first/last-group bar. Anti-repeat
    // there rests on the in-round local search above (still graceful).
    if (!spec.avoidConsecutiveFlights) {
      this.globalRefine(rounds);
    }
    return rounds;
  }

  // A few whole-draw passes: for each round, rebuild the meet matrix from all the
  // *other* rounds and hill-climb that round's swaps against it. Converges toward
  // an evenly spread (low-excess) draw at MVP scale.
  private globalRefine(rounds: string[][][]): void {
    const noBar = () => false;
    for (let pass = 0; pass < 4; pass++) {
      for (let r = 0; r < rounds.length; r++) {
        const meetExcl = new Map<string, number>();
        rounds.forEach((groups, roundIdx) => {
          if (roundIdx === r) return;
          for (const group of groups) {
            for (let i = 0; i < group.length; i++) {
              for (let j = i + 1; j < group.length; j++) {
                const key = pairKey(group[i]!, group[j]!);
                meetExcl.set(key, (meetExcl.get(key) ?? 0) + 1);
              }
            }
          }
        });
        improveRound(rounds[r]!, meetExcl, noBar);
      }
    }
  }

  // Materialise one task's seat placement for one round: ordered groups with
  // explicit per-slot lanes, keyed on rosterEntryId (RD4). A singleton group
  // is flagged (AC5) — under the D1-bounded even split this cannot arise for
  // a valid spec, so the flag is a safeguard the STORY-001-011 scoring guard
  // relies on. STORY-001-020: narrowed from the pre-story `materialise` (which
  // mapped every round of the whole placement at once) to one round of one
  // task's own placement — the caller in `generate` loops rounds × tasks to
  // assemble the final RoundDraw[]. The per-slot mapping logic itself
  // (flyingOrder/lonePilotFlagged/assignLanes) is unchanged.
  private materialiseOneTasksGroups(
    placement: string[][][],
    roundIdx: number,
    policy: LaneAllocationPolicy,
    contestNumbers: Map<string, number | null>,
  ): FlightGroup[] {
    const groups = placement[roundIdx]!;
    return groups.map(
      (seatIds, groupIdx): FlightGroup => ({
        flyingOrder: groupIdx + 1,
        lonePilotFlagged: seatIds.length === 1,
        members: assignLanes(seatIds, roundIdx + 1, policy, contestNumbers),
      }),
    );
  }

  // The anti-repeat evidence over the whole draw (AC4). Counts every pairing
  // across all rounds/groups; variance is taken over all C(R,2) pairs (zeros
  // included) so an even spread scores low.
  private computeDistribution(placement: string[][][], seatIds: string[]): MatchupDistribution {
    const meet = new Map<string, number>();
    for (const groups of placement) {
      for (const group of groups) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const key = pairKey(group[i]!, group[j]!);
            meet.set(key, (meet.get(key) ?? 0) + 1);
          }
        }
      }
    }
    const pairs: MeetCount[] = [];
    let maxMeets = 0;
    let totalExcessMeets = 0;
    let sum = 0;
    let sumSq = 0;
    const n = seatIds.length;
    const numPairs = (n * (n - 1)) / 2;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const [a, b] = orderedPair(seatIds[i]!, seatIds[j]!);
        const count = meet.get(pairKey(a, b)) ?? 0;
        if (count > 0) pairs.push({ a, b, count });
        if (count > maxMeets) maxMeets = count;
        if (count > 1) totalExcessMeets += count - 1;
        sum += count;
        sumSq += count * count;
      }
    }
    const mean = numPairs > 0 ? sum / numPairs : 0;
    const variance = numPairs > 0 ? sumSq / numPairs - mean * mean : 0;
    return { pairs, maxMeets, totalExcessMeets, variance };
  }
}

// ---- pure helpers (no RNG except shuffle, which the service uses only in
//      generate) --------------------------------------------------------------

function parseOrThrow<S extends ZodType<unknown, z.ZodTypeDef, unknown>>(
  schema: S,
  input: unknown,
): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError("Validation failed", result.error.flatten());
  }
  return result.data;
}

// Even group sizes: the first (R mod G) groups take one extra seat, the rest the
// floor. Guarantees the smallest group is floor(R/G) — the AC1 bound reasons
// about exactly this.
function groupCapacities(R: number, G: number): number[] {
  const base = Math.floor(R / G);
  const remainder = R % G;
  return Array.from({ length: G }, (_, i) => (i < remainder ? base + 1 : base));
}

function shuffle<T>(input: readonly T[]): T[] {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

// Sum of prior meets between `seat` and the other members of its group.
function memberCost(seat: string, members: string[], meet: Map<string, number>): number {
  let cost = 0;
  for (const member of members) {
    if (member !== seat) cost += meet.get(pairKey(seat, member)) ?? 0;
  }
  return cost;
}

// Hill-climb pairwise swaps between two groups while any swap strictly reduces
// the round's added repeats. `forbidden(seat, groupIndex)` blocks a swap that
// would violate the no-back-to-back rule. Terminates at a local minimum; at MVP
// scale the round is tiny so this converges in a handful of passes.
function improveRound(
  groups: string[][],
  meet: Map<string, number>,
  forbidden: (seat: string, groupIndex: number) => boolean,
): void {
  let improved = true;
  while (improved) {
    improved = false;
    for (let g1 = 0; g1 < groups.length; g1++) {
      for (let g2 = g1 + 1; g2 < groups.length; g2++) {
        for (let xi = 0; xi < groups[g1]!.length; xi++) {
          for (let yi = 0; yi < groups[g2]!.length; yi++) {
            const x = groups[g1]![xi]!;
            const y = groups[g2]![yi]!;
            if (forbidden(x, g2) || forbidden(y, g1)) continue;
            const g1WithoutX = groups[g1]!.filter((_, k) => k !== xi);
            const g2WithoutY = groups[g2]!.filter((_, k) => k !== yi);
            const current = memberCost(x, g1WithoutX, meet) + memberCost(y, g2WithoutY, meet);
            const swapped = memberCost(x, g2WithoutY, meet) + memberCost(y, g1WithoutX, meet);
            if (swapped < current) {
              groups[g1]![xi] = y;
              groups[g2]![yi] = x;
              improved = true;
            }
          }
        }
      }
    }
  }
}

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function pairKey(a: string, b: string): string {
  const [x, y] = orderedPair(a, b);
  return `${x}|${y}`;
}

// Lane allocation (Decision #6). rotate: shift the starting lane each round so no
// seat keeps lane 1. fixed-by-contest-number: lanes follow pilot number order
// (unnumbered seats last). random: a shuffled permutation. Lanes are 1..size and
// stored explicitly per slot (Safeguard 9) — real lane management is 010.
function assignLanes(
  seatIds: string[],
  roundNumber: number,
  policy: LaneAllocationPolicy,
  contestNumbers: Map<string, number | null>,
): GroupMembership[] {
  const size = seatIds.length;
  if (policy === "fixed-by-contest-number") {
    const lane = new Map<string, number>();
    seatIds
      .slice()
      .sort((a, b) => {
        const na = contestNumbers.get(a) ?? null;
        const nb = contestNumbers.get(b) ?? null;
        if (na === null && nb === null) return a < b ? -1 : 1;
        if (na === null) return 1;
        if (nb === null) return -1;
        return na - nb;
      })
      .forEach((id, i) => lane.set(id, i + 1));
    return seatIds.map((id) => ({ rosterEntryId: id, lane: lane.get(id)! }));
  }
  if (policy === "random") {
    const lanes = shuffle(Array.from({ length: size }, (_, i) => i + 1));
    return seatIds.map((id, i) => ({ rosterEntryId: id, lane: lanes[i]! }));
  }
  // rotate (default)
  return seatIds.map((id, i) => ({ rosterEntryId: id, lane: ((i + (roundNumber - 1)) % size) + 1 }));
}

// Reduce a distribution to the chosen metric's comparison key (smaller = fairer;
// compared lexicographically). min-max-then-excess flattens the worst repeat
// first, then the bulk of excess.
function scoreKey(distribution: MatchupDistribution, metric: FairnessMetric): number[] {
  switch (metric) {
    case "min-max-then-excess":
      return [distribution.maxMeets, distribution.totalExcessMeets];
    case "min-total-excess":
      return [distribution.totalExcessMeets];
    case "min-variance":
      return [distribution.variance];
  }
}

// The single scalar surfaced as the retained metric value (the distribution
// carries the rest of the evidence).
function metricValueOf(distribution: MatchupDistribution, metric: FairnessMetric): number {
  switch (metric) {
    case "min-max-then-excess":
      return distribution.maxMeets;
    case "min-total-excess":
      return distribution.totalExcessMeets;
    case "min-variance":
      return distribution.variance;
  }
}

function keyLess(a: number[], b: number[]): boolean {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x < y) return true;
    if (x > y) return false;
  }
  return false;
}
