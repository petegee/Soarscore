import { z } from "zod";

// The per-competition draw (STORY-001-009). Two persisted facts — a validated
// draw *specification* (the fair-draw policy) and a generated *outcome* (the
// materialised flight groups) — plus a derived evidence read-model for the CD's
// accept/re-draw decision (4.3, out of scope here). Both facts file under
// scope = competitionId (the roster / task-config pattern). This story produces
// *candidate* draws only: generate ≠ accept.

// The draw mode. MVP has one — random initial order + anti-repeat intent
// (00-general-rules §1). Progressive/seeded modes are a Future Enhancement, so
// the union is deliberately a single member rather than an open string.
export type DrawMode = "random-anti-repeat";

// How an attempt's fairness is scored, and thus which attempt is retained
// (Resolved Decision #2, Organiser-selected). All three read the matchup
// distribution; they differ only in the scalar/tuple they minimise.
//  - min-max-then-excess: lexicographic [maxMeets, totalExcessMeets] — flatten
//    the worst repeat first, then the bulk of excess.
//  - min-total-excess:    total meets above one across all pairs.
//  - min-variance:        variance of per-pair meet counts (evenest spread).
export type FairnessMetric =
  | "min-max-then-excess"
  | "min-total-excess"
  | "min-variance";

// How a seat's lane is assigned within its group (Resolved Decision #6). Stored
// explicitly per slot regardless of policy so STORY-001-010 (lane management)
// has a concrete anchor.
export type LaneAllocationPolicy = "rotate" | "fixed-by-contest-number" | "random";

// The saved fair-draw policy for one competition. classModelId is denormalised
// from the competition at save so the outcome is self-describing in the log.
export interface DrawSpecification {
  id: string;
  competitionId: string;
  classModelId: string;
  drawMode: DrawMode;
  // 1 ≤ roundCount ≤ 8 (D7 cap). Validated structurally in Zod.
  roundCount: number;
  // groupsPerRound ≥ 2 structurally unless allowSingleGroup is set (then ≥ 1);
  // the roster-derived upper bound (≤ R/2, D1) is a cross-aggregate check in
  // the service.
  groupsPerRound: number;
  fairnessMetric: FairnessMetric;
  // Opt-in (Decision #5, default false): forbid a seat in the last group of a
  // round and the first group of the next. Groups are stored ordered either way.
  avoidConsecutiveFlights: boolean;
  lanePolicy: LaneAllocationPolicy;
  // Deprecated-in-place (STORY-001-022, D14): the class model's rule-fixed
  // minima are always resolved now, and a genuine shortfall warns-and-generates
  // instead of being pre-empted by an Organiser-supplied number. This field is
  // kept only for backward compatibility with already-saved specs — it has
  // zero effect on `resolveMin`, `assertGroupBound`, or generation.
  minGroupSizeOverride: number | null;
  // The Area 4.1 spare-scorer override (Decision #1, amended 2026-07-12):
  // records that spare non-flying scorers are present. Normally non-flying
  // pilots score the flying group, which is why a round needs at least two
  // groups; with this set the floor relaxes and groupsPerRound = 1 becomes
  // saveable. All other bounds (per-group minimum, roster-derived maximum)
  // still apply.
  allowSingleGroup: boolean;
}

// One seat's membership of a flight group. Keys on rosterEntryId, never pilotId
// (RD4): a post-draw replacement inherits the slot. lane is an explicit integer.
export interface GroupMembership {
  rosterEntryId: string;
  lane: number;
}

// One flight group within a round. flyingOrder is the group's position in the
// round's flying sequence (stored ordered irrespective of the consecutive-flight
// toggle, Safeguard 9). lonePilotFlagged marks an arithmetically unavoidable
// singleton (AC5) — distinct from AC6's store-nothing failure.
export interface FlightGroup {
  flyingOrder: number;
  members: GroupMembership[];
  lonePilotFlagged: boolean;
}

// One task's independent group composition within a round (STORY-001-020).
// taskId/taskName are denormalised from the class model's TaskParameterSet at
// generation time (mirrors DrawSpecification.classModelId's denormalisation
// precedent) so a stored draw remains self-describing even if the class model
// is later edited or cloned.
export interface TaskGroupSet {
  taskId: string;
  taskName: string;
  groups: FlightGroup[];
}

// One qualifying round's ordered flight groups. taskGroups carries one entry
// per ContestClassModel.tasks entry, each with that task's own independent
// composition (STORY-001-020) — never empty once a round has been generated.
// groups remains required and always populated as a back-compat flat view: it
// always equals taskGroups[0].groups exactly, by construction in the service
// (single-task classes: their one task, verbatim; multi-task classes: the
// first task's real, valid grouping — e.g. F3B's Duration — until
// STORY-001-021 gives consumers the full per-task view).
export interface RoundDraw {
  roundNumber: number;
  groups: FlightGroup[];
  taskGroups: TaskGroupSet[];
}

// The anti-repeat evidence for the retained attempt (AC4). Each pair's meet
// count, the worst repeat, the summed excess over one meet, and the variance —
// enough for the CD to judge fairness and for the metric to be recomputable.
export interface MeetCount {
  a: string;
  b: string;
  count: number;
}

export interface MatchupDistribution {
  pairs: MeetCount[];
  maxMeets: number;
  totalExcessMeets: number;
  variance: number;
}

// One task's fairness evidence within a generated draw (STORY-001-020),
// computed only from that task's own placement's pairings — never blended
// across tasks. Same taskId/taskName denormalisation rule as TaskGroupSet.
export interface TaskMatchupDistribution {
  taskId: string;
  taskName: string;
  distribution: MatchupDistribution;
  metricValue: number;
}

// The fully materialised generated outcome (Safeguard 3). The draw.generated
// payload IS this — never an RNG seed — so event-log replay reproduces the
// identical draw with no RNG in the projection (D4). metricValue is the chosen
// metric's scalar reduction; attemptsRun records the honest "fairest of K".
export interface GeneratedDraw {
  id: string;
  competitionId: string;
  specId: string;
  rounds: RoundDraw[];
  metric: FairnessMetric;
  metricValue: number;
  distribution: MatchupDistribution;
  attemptsRun: number;
  // Rule-fixed per-group-minimum shortfall warnings raised by this specific
  // generated outcome (STORY-001-022, D14). Empty when the resolved minimum
  // was met by the groups-per-round actually generated. Each entry gates
  // acceptance via its `id` until acknowledged. Task-qualified ids
  // (`group-size-minimum:<taskId>`, STORY-001-020) let multiple co-occurring
  // per-task warnings stay independently acknowledgeable.
  groupSizeWarnings: ConstraintWarning[];
  // Per-task fairness evidence (STORY-001-020) — one entry per
  // ContestClassModel.tasks entry, same ordering rule as rounds[].taskGroups.
  // The flat distribution/metricValue fields above always mirror
  // taskDistributions[0] (same pairing rule as groups/taskGroups[0]).
  taskDistributions: TaskMatchupDistribution[];
}

// A soft, non-blocking warning (AC2): a constraint that cannot be *jointly*
// satisfied for this roster/spec. Rides the successful save response — never an
// error (AC1 rejects; AC6 fails; these three paths stay distinct).
export interface ConstraintWarning {
  constraint: string;
  message: string;
  // Present only for warnings that gate acceptance (the group-size-minimum
  // kind, STORY-001-022) — the id an acknowledgement references. Absent for
  // the existing non-gating anti-repeat/consecutive-flight warnings above.
  id?: string;
}

// The draw's acceptance state (STORY-001-017, AC2). Exactly three
// distinguishable values:
//  - no-draw:            no candidate has been generated (or it was cancelled).
//  - awaiting-decision:  a candidate exists but the CD has not accepted it.
//  - accepted:           a candidate has been committed as the authoritative
//                        accepted draw.
export type DrawAcceptanceStatus = "no-draw" | "awaiting-decision" | "accepted";

// The derived read-model over the retained outcome. The candidate is null until
// the first successful generate; accepted is null until the CD accepts (017);
// status is the three-valued acceptance state derived in the service.
export interface DrawEvidenceView {
  spec: DrawSpecification | null;
  candidate: GeneratedDraw | null;
  accepted: GeneratedDraw | null;
  status: DrawAcceptanceStatus;
  warnings: ConstraintWarning[];
}

// Structural validation only (Norm 2). Cross-aggregate rules — roster size, the
// class model's minGroupSize, joint feasibility — live in DrawService, which
// alone can see the sibling aggregates.
export const saveDrawSpecRequestSchema = z
  .object({
    drawMode: z.enum(["random-anti-repeat"]),
    roundCount: z
      .number()
      .int("The round count must be a whole number")
      .min(1, "A draw needs at least one round")
      .max(8, "A draw covers up to 8 rounds per day (D7)"),
    groupsPerRound: z
      .number()
      .int("Groups per round must be a whole number")
      .min(1, "A round needs at least one group"),
    fairnessMetric: z.enum(["min-max-then-excess", "min-total-excess", "min-variance"]),
    avoidConsecutiveFlights: z.boolean().default(false),
    lanePolicy: z.enum(["rotate", "fixed-by-contest-number", "random"]),
    minGroupSizeOverride: z
      .number()
      .int("The minimum group size must be a whole number")
      .positive("The minimum group size must be greater than zero")
      .nullable()
      .default(null),
    // The Area 4.1 spare-scorer override (amended 2026-07-12): records that
    // spare non-flying scorers are present — D1's rationale for the two-group
    // floor — permitting groupsPerRound = 1 via the refine below.
    allowSingleGroup: z.boolean().default(false),
  })
  // Cross-field floor (AC7): both fields live in this request, so per the
  // validation split (Norm 2) the two-group floor is structural. The rejection
  // must cite the override as the way to permit a single group; it surfaces as
  // VALIDATION_FAILED (400) via parseOrThrow — never as
  // DRAW_GROUP_SIZE_OUT_OF_BOUNDS, which stays reserved for roster-derived
  // bounds.
  .refine((spec) => !(spec.groupsPerRound === 1 && spec.allowSingleGroup !== true), {
    path: ["groupsPerRound"],
    message: "A round needs at least two groups unless the spare-scorer override is set",
  });

export type SaveDrawSpecRequest = z.infer<typeof saveDrawSpecRequestSchema>;

// A CD decision (accept or cancel) references the awaiting-decision candidate
// by id (AC6): the same schema serves both routes, and a stale id is rejected
// in the service so a decision can never attach to a superseded candidate.
export const drawDecisionRequestSchema = z.object({
  drawId: z.string().min(1, "A draw id is required to accept or cancel"),
  // The Contest Director's acknowledgement of any group-size-minimum warnings
  // carried by the candidate (STORY-001-022, D14). Cancel ignores this field
  // (matching today's shared-schema pattern); a client that never sends it
  // behaves exactly as before for any draw carrying no such warning.
  acknowledgedWarningIds: z.array(z.string()).default([]),
});

export type DrawDecisionRequest = z.infer<typeof drawDecisionRequestSchema>;

// STORY-001-011: Organiser-authority group management (move a pilot, split a
// group) and re-flight preparation — an overlay on the *accepted* draw that
// never rewrites its stored draw.generated/draw.accepted payload. Every
// concept here is task-scoped ((roundNumber, taskId)), mirroring
// STORY-001-020's per-task independence: a move in F3B's Duration task never
// implies the same move in Distance or Speed.

// One seat moved between two groups of the same round/task (AC1).
// taskName is denormalised at write time (mirrors TaskGroupSet), the same
// self-describing-payload discipline as everywhere else in this module.
export interface GroupMovedPayload {
  competitionId: string;
  drawId: string;
  roundNumber: number;
  taskId: string;
  taskName: string;
  rosterEntryId: string;
  fromGroupFlyingOrder: number;
  toGroupFlyingOrder: number;
}

// A group split into two: the seats named in movedRosterEntryIds leave the
// source group for a brand-new group (AC1).
export interface GroupSplitPayload {
  competitionId: string;
  drawId: string;
  roundNumber: number;
  taskId: string;
  taskName: string;
  sourceGroupFlyingOrder: number;
  newGroupFlyingOrder: number;
  movedRosterEntryIds: string[];
}

// A Contest-Director-authority decision's status: pending CD approval, approved,
// declined, or lapsed (STORY-001-032). The full union is fixed as of this canvas
// (user-confirmed, 202607160945) so STORY-001-028 implements against it as a
// stable contract. Additive-only (NFR-2) — no existing member renamed; "lapsed"
// is applied only as a side-effect of roundAdvance.overridden's fold, never as a
// direct CD action (that would collide with STORY-001-028's approve/decline surface).
export type ApprovalStatus =
  | "pending-contest-director-approval"
  | "approved"
  | "declined"
  | "lapsed";

// A re-flight prepared for one entitled pilot: a new re-flyer group filled to
// the task's resolved minimum by random draw from eligible others (AC3/AC4).
// approvalStatus records that CD approval is *needed*, not granted.
export interface ReflightPreparedPayload {
  competitionId: string;
  drawId: string;
  roundNumber: number;
  taskId: string;
  taskName: string;
  entitledRosterEntryId: string;
  reflightGroupFlyingOrder: number;
  fillerRosterEntryIds: string[];
  approvalStatus: ApprovalStatus;
  reason: string;
}

// Structural validation only (Norm 2) — the existence of the round/task/
// rosterEntryId/target group in *this* accepted draw, and every clash check,
// is a cross-aggregate concern that stays in DrawService.
export const groupMoveRequestSchema = z.object({
  roundNumber: z.number().int().positive(),
  // Optional: defaults to model.tasks[0].id (single-task classes never see a
  // selector), same idiom as every other task-scoped request in this module.
  taskId: z.string().min(1).optional(),
  rosterEntryId: z.string().min(1, "A roster entry id is required"),
  toGroupFlyingOrder: z.number().int().positive(),
});

export type GroupMoveRequest = z.infer<typeof groupMoveRequestSchema>;

export const groupSplitRequestSchema = z.object({
  roundNumber: z.number().int().positive(),
  taskId: z.string().min(1).optional(),
  sourceGroupFlyingOrder: z.number().int().positive(),
  movedRosterEntryIds: z
    .array(z.string().min(1))
    .min(1, "At least one pilot must move to the new group"),
});

export type GroupSplitRequest = z.infer<typeof groupSplitRequestSchema>;

export const reflightPrepareRequestSchema = z.object({
  roundNumber: z.number().int().positive(),
  taskId: z.string().min(1).optional(),
  entitledRosterEntryId: z.string().min(1, "A roster entry id is required"),
  reason: z.string().min(1, "A reason is required").max(500),
});

export type ReflightPrepareRequest = z.infer<typeof reflightPrepareRequestSchema>;

// One round's effective group composition for one task: the accepted draw's
// stored groups, overlaid with any move/split/re-flight-prepared facts —
// "latest overlay wins", never a rewrite of the stored draw (mirrors
// DrawProjection's other overlay maps). reflightGroupFlags is parallel to
// groups[] (true marks a group synthesised by prepareReflight).
export interface EffectiveRound {
  roundNumber: number;
  groups: FlightGroup[];
  reflightGroupFlags: boolean[];
}

// The read view returned by group move/split/prepare and by a direct read of
// the effective composition for one task across every round (AC1/AC3).
export interface EffectiveGroupsView {
  drawId: string;
  taskId: string;
  taskName: string;
  rounds: EffectiveRound[];
}

// Deep-copy the spec for an event payload so no appended payload aliases caller
// state (mirrors taskConfigToPayload).
export function drawSpecToPayload(spec: DrawSpecification): DrawSpecification {
  return {
    id: spec.id,
    competitionId: spec.competitionId,
    classModelId: spec.classModelId,
    drawMode: spec.drawMode,
    roundCount: spec.roundCount,
    groupsPerRound: spec.groupsPerRound,
    fairnessMetric: spec.fairnessMetric,
    avoidConsecutiveFlights: spec.avoidConsecutiveFlights,
    lanePolicy: spec.lanePolicy,
    minGroupSizeOverride: spec.minGroupSizeOverride,
    allowSingleGroup: spec.allowSingleGroup,
  };
}

// Deep-copy the fully materialised outcome (rounds → groups → memberships, plus
// the distribution's pairs) so the persisted fact is independent of the
// generator's working arrays.
export function generatedDrawToPayload(draw: GeneratedDraw): GeneratedDraw {
  return {
    id: draw.id,
    competitionId: draw.competitionId,
    specId: draw.specId,
    metric: draw.metric,
    metricValue: draw.metricValue,
    attemptsRun: draw.attemptsRun,
    rounds: draw.rounds.map((round) => ({
      roundNumber: round.roundNumber,
      groups: round.groups.map((group) => ({
        flyingOrder: group.flyingOrder,
        lonePilotFlagged: group.lonePilotFlagged,
        members: group.members.map((m) => ({ rosterEntryId: m.rosterEntryId, lane: m.lane })),
      })),
      taskGroups: round.taskGroups.map((tg) => ({
        taskId: tg.taskId,
        taskName: tg.taskName,
        groups: tg.groups.map((group) => ({
          flyingOrder: group.flyingOrder,
          lonePilotFlagged: group.lonePilotFlagged,
          members: group.members.map((m) => ({ rosterEntryId: m.rosterEntryId, lane: m.lane })),
        })),
      })),
    })),
    distribution: {
      maxMeets: draw.distribution.maxMeets,
      totalExcessMeets: draw.distribution.totalExcessMeets,
      variance: draw.distribution.variance,
      pairs: draw.distribution.pairs.map((p) => ({ a: p.a, b: p.b, count: p.count })),
    },
    groupSizeWarnings: draw.groupSizeWarnings.map((w) => ({ ...w })),
    taskDistributions: draw.taskDistributions.map((td) => ({
      taskId: td.taskId,
      taskName: td.taskName,
      metricValue: td.metricValue,
      distribution: {
        maxMeets: td.distribution.maxMeets,
        totalExcessMeets: td.distribution.totalExcessMeets,
        variance: td.distribution.variance,
        pairs: td.distribution.pairs.map((p) => ({ a: p.a, b: p.b, count: p.count })),
      },
    })),
  };
}
