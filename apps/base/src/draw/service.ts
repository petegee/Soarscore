import crypto from "node:crypto";
import { z, type ZodType } from "zod";
import {
  saveDrawSpecRequestSchema,
  drawSpecToPayload,
  generatedDrawToPayload,
  type Attribution,
  type Competition,
  type ConstraintWarning,
  type ContestClassModel,
  type DrawEvidenceView,
  type DrawSpecification,
  type FairnessMetric,
  type FlightGroup,
  type GeneratedDraw,
  type GroupMembership,
  type LaneAllocationPolicy,
  type MatchupDistribution,
  type MeetCount,
  type RoundDraw,
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
  DrawSpecNotFoundError,
  GroupSizeOutOfBoundsError,
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
      ? this.computeWarnings(spec, this.rosterSize(competitionId), this.resolveMin(model, spec.minGroupSizeOverride))
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
    const parsed = parseOrThrow(saveDrawSpecRequestSchema, input);

    const resolvedMin = this.resolveMin(model, parsed.minGroupSizeOverride);
    const R = this.rosterSize(competitionId);
    // AC1 hard bound — enforced at save whenever a roster exists (≥ 2 seats);
    // an empty/near-empty roster defers to generate (Safeguard 6) so the policy
    // can be authored before pilots are entered.
    if (R >= 2) {
      this.assertGroupBound(R, parsed.groupsPerRound, resolvedMin, parsed.allowSingleGroup);
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
    const resolvedMin = this.resolveMin(model, spec.minGroupSizeOverride);

    // Re-check the bound against the *current* roster: it may have shrunk since
    // the spec was saved (Safeguard 6). Also rejects an empty roster (R < 2).
    this.assertGroupBound(R, spec.groupsPerRound, resolvedMin, spec.allowSingleGroup);

    const contestNumbers = new Map<string, number | null>(
      roster.map((entry) => [entry.id, entry.pilotNumber]),
    );

    // Run the attempts; keep the fairest valid one by the chosen metric.
    let bestPlacement: string[][][] | null = null;
    let bestDistribution: MatchupDistribution | null = null;
    let bestKey: number[] | null = null;
    for (let i = 0; i < ATTEMPTS; i++) {
      const placement = this.runAttempt(seatIds, spec);
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
      // AC6: no attempt yielded a valid draw (e.g. the no-back-to-back rule is
      // unsatisfiable for this roster/spec). Nothing is appended (Safeguard 3).
      throw new DrawGenerationFailedError(
        `Could not generate a valid draw after ${ATTEMPTS} attempts — the constraints may be unsatisfiable for this roster and specification`,
      );
    }

    const draw: GeneratedDraw = {
      id: crypto.randomUUID(),
      competitionId,
      specId: spec.id,
      rounds: this.materialise(bestPlacement, spec.lanePolicy, contestNumbers),
      metric: spec.fairnessMetric,
      metricValue: metricValueOf(bestDistribution, spec.fairnessMetric),
      distribution: bestDistribution,
      attemptsRun: ATTEMPTS,
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
  accept(competitionId: string, drawId: string, attribution: Attribution): DrawEvidenceView {
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

    const record = this.eventStore.append({
      scope: competitionId,
      type: "draw.accepted",
      payload: { competitionId, drawId: candidate.id, specId: candidate.specId },
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

  // The binding per-group minimum: the Organiser's override wins (it relaxes
  // the per-group minimum size only); otherwise the largest of the model
  // tasks' rule-fixed minima; null everywhere → 1 (no rule minimum, only the
  // D1 two-per-group rule applies, folded into the bound below).
  private resolveMin(model: ContestClassModel, override: number | null): number {
    if (override !== null) return override;
    const mins = model.tasks
      .map((task) => task.minGroupSize)
      .filter((value): value is number => value !== null);
    return mins.length > 0 ? Math.max(...mins) : 1;
  }

  // AC1: with G groups over R seats the smallest group is floor(R/G); require it
  // ≥ resolvedMin AND ≥ 2 (D1). Equivalently G ≤ floor(R/resolvedMin) and
  // G ≤ floor(R/2). Reject outside [lower, upper], explaining the bound. The
  // lower end is 1 when the spare-scorer override is set, else 2 (Area 4.1,
  // amended 2026-07-12): the override relaxes only the D1 floor — the per-group
  // minimum and the R/2 ceiling still apply. A groupsPerRound of 1 without the
  // flag never reaches here: the Zod cross-field refine rejects it first as
  // VALIDATION_FAILED.
  private assertGroupBound(
    R: number,
    G: number,
    resolvedMin: number,
    allowSingleGroup: boolean,
  ): void {
    const lower = allowSingleGroup ? 1 : 2;
    const maxByMin = Math.floor(R / resolvedMin);
    const maxByD1 = Math.floor(R / 2); // D1: every group needs ≥ 2 scoring pilots
    const upper = Math.min(maxByMin, maxByD1);
    if (upper < lower || G > upper) {
      throw new GroupSizeOutOfBoundsError(
        `Groups per round must be between ${lower} and ${Math.max(upper, 0)} for a roster of ${R} ` +
          `(each group needs at least ${resolvedMin} scoring pilot${resolvedMin === 1 ? "" : "s"} ` +
          `and at most ${maxByD1} group${maxByD1 === 1 ? "" : "s"} keep two per group); ` +
          `${G} would force groups below the minimum`,
      );
    }
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
  private runAttempt(seatIds: string[], spec: DrawSpecification): string[][][] | null {
    const G = spec.groupsPerRound;
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

  // Materialise seat placement into stored rounds: ordered groups with explicit
  // per-slot lanes, keyed on rosterEntryId (RD4). A singleton group is flagged
  // (AC5) — under the D1-bounded even split this cannot arise for a valid spec,
  // so the flag is a safeguard the STORY-001-011 scoring guard relies on.
  private materialise(
    placement: string[][][],
    policy: LaneAllocationPolicy,
    contestNumbers: Map<string, number | null>,
  ): RoundDraw[] {
    return placement.map((groups, roundIdx) => ({
      roundNumber: roundIdx + 1,
      groups: groups.map(
        (seatIds, groupIdx): FlightGroup => ({
          flyingOrder: groupIdx + 1,
          lonePilotFlagged: seatIds.length === 1,
          members: assignLanes(seatIds, roundIdx + 1, policy, contestNumbers),
        }),
      ),
    }));
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
