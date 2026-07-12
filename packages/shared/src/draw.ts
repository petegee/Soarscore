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
  // Organiser override of the rule-derived per-group minimum; null → use the
  // class model's task minGroupSize. Relaxes only the per-group minimum size —
  // the D1 two-group floor is allowSingleGroup's concern, below.
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

// One qualifying round's ordered flight groups.
export interface RoundDraw {
  roundNumber: number;
  groups: FlightGroup[];
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
}

// A soft, non-blocking warning (AC2): a constraint that cannot be *jointly*
// satisfied for this roster/spec. Rides the successful save response — never an
// error (AC1 rejects; AC6 fails; these three paths stay distinct).
export interface ConstraintWarning {
  constraint: string;
  message: string;
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
});

export type DrawDecisionRequest = z.infer<typeof drawDecisionRequestSchema>;

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
    })),
    distribution: {
      maxMeets: draw.distribution.maxMeets,
      totalExcessMeets: draw.distribution.totalExcessMeets,
      variance: draw.distribution.variance,
      pairs: draw.distribution.pairs.map((p) => ({ a: p.a, b: p.b, count: p.count })),
    },
  };
}
