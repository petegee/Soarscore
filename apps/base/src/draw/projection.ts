import type {
  DrawAcceptedPayload,
  DrawSpecification,
  FlightGroup,
  GeneratedDraw,
  GroupMovedPayload,
  GroupSplitPayload,
  ReflightPreparedPayload,
} from "@soarscore/shared";
import type { EventRecord } from "../eventstore/event-store.js";

// One projection for all competitions' draws — derived state only (D4/D7), safe
// to discard and rebuild from the log at any time. draw.* events file under
// scope = competitionId, so this projection guards by event type and files each
// fact under its record's scope: one competition's draw never bleeds into
// another's. A deleted competition drops all three maps so nothing orphans
// (the roster / task-config idiom).
//
// This is a PURE LOADER (Safeguard 2/Norm 5): it never invokes the randomiser
// and never re-generates. The stored draw.generated payload is the fully
// materialised outcome, so replay reproduces the identical candidate. Any
// randomness in apply/rebuild is a defect.
export class DrawProjection {
  private specs = new Map<string, DrawSpecification>();
  private candidates = new Map<string, GeneratedDraw>();
  private accepted = new Map<string, GeneratedDraw>();
  // STORY-001-011: the latest effective group set for one (round, task) once
  // at least one move/split/re-flight-prepare has happened for that key —
  // "latest overlay wins", never a rewrite of the stored draw.accepted
  // payload. Outer key competitionId; inner key `${roundNumber}|${taskId}`.
  private groupTopologyOverlay = new Map<string, Map<string, FlightGroup[]>>();
  // Every re-flight preparation recorded for a competition, append-only
  // (never superseded within this story's surface — a future CD-approval
  // story supersedes with its own event, not an edit here).
  private reflightPreparations = new Map<string, ReflightPreparedPayload[]>();

  apply(record: EventRecord): void {
    switch (record.type) {
      case "draw.specSaved": {
        const payload = record.payload as DrawSpecification;
        this.specs.set(record.scope, this.copySpec(payload));
        break;
      }
      case "draw.generated": {
        // Latest wins — supersede, never overwrite in place (Decision #7). The
        // log retains every prior attempt; this map holds only the current one.
        const payload = record.payload as GeneratedDraw;
        this.candidates.set(record.scope, this.copyDraw(payload));
        break;
      }
      case "draw.accepted": {
        // Promotion of the already-stored outcome (STORY-001-017): the payload
        // carries only references, so the accepted draw is the candidate the
        // drawId names — a deep copy, no RNG, no re-materialisation (D4). The
        // service guards candidate presence/id before appending, so replay of a
        // well-formed log always finds it; a mismatch leaves accepted unset.
        const payload = record.payload as DrawAcceptedPayload;
        const candidate = this.candidates.get(record.scope);
        if (candidate && candidate.id === payload.drawId) {
          this.accepted.set(record.scope, this.copyDraw(candidate));
        }
        break;
      }
      case "draw.cancelled": {
        // Discard the awaiting-decision candidate (AC4): the contest returns
        // to no-draw/generatable. The spec is retained (re-generation is
        // possible) and accepted is untouched — cancel targets an *unaccepted*
        // candidate by AC4; cancelling an accepted draw is out of scope.
        this.candidates.delete(record.scope);
        break;
      }
      case "draw.groupMoved": {
        // AC1: move one seat between two groups of the same round/task.
        // Recompute the affected key's full group set from the *current*
        // effective composition (accepted snapshot, or the prior overlay
        // entry if one already exists) and supersede the overlay's latest
        // value — never patch a group in place (same discipline as every
        // other supersede-on-repeat fact in this file).
        const payload = record.payload as GroupMovedPayload;
        const next = this.deepCopyGroups(
          this.currentGroupsFor(record.scope, payload.roundNumber, payload.taskId),
        );
        const fromGroup = next.find((g) => g.flyingOrder === payload.fromGroupFlyingOrder);
        const toGroup = next.find((g) => g.flyingOrder === payload.toGroupFlyingOrder);
        if (fromGroup && toGroup) {
          const index = fromGroup.members.findIndex((m) => m.rosterEntryId === payload.rosterEntryId);
          if (index >= 0) {
            const [member] = fromGroup.members.splice(index, 1);
            toGroup.members.push(member!);
            fromGroup.lonePilotFlagged = fromGroup.members.length === 1;
            toGroup.lonePilotFlagged = toGroup.members.length === 1;
          }
        }
        this.setOverlay(record.scope, payload.roundNumber, payload.taskId, next);
        break;
      }
      case "draw.groupSplit": {
        // AC1: carve movedRosterEntryIds out of the source group into a
        // freshly appended group at newGroupFlyingOrder.
        const payload = record.payload as GroupSplitPayload;
        const next = this.deepCopyGroups(
          this.currentGroupsFor(record.scope, payload.roundNumber, payload.taskId),
        );
        const source = next.find((g) => g.flyingOrder === payload.sourceGroupFlyingOrder);
        if (source) {
          const moving = source.members.filter((m) => payload.movedRosterEntryIds.includes(m.rosterEntryId));
          source.members = source.members.filter(
            (m) => !payload.movedRosterEntryIds.includes(m.rosterEntryId),
          );
          source.lonePilotFlagged = source.members.length === 1;
          next.push({
            flyingOrder: payload.newGroupFlyingOrder,
            members: moving,
            lonePilotFlagged: moving.length === 1,
          });
        }
        this.setOverlay(record.scope, payload.roundNumber, payload.taskId, next);
        break;
      }
      case "draw.reflightPrepared": {
        // AC3/AC4: record the preparation, and synthesize the new re-flyer
        // group into the overlay — structurally a split-off group whose
        // membership is [entitled, ...fillers]. The entitled pilot and every
        // filler keep their original-group membership too (a re-flight is an
        // *extra* flight opportunity, not a seat move — Approach §3).
        const payload = record.payload as ReflightPreparedPayload;
        const preparations = this.reflightPreparations.get(record.scope) ?? [];
        preparations.push({ ...payload, fillerRosterEntryIds: [...payload.fillerRosterEntryIds] });
        this.reflightPreparations.set(record.scope, preparations);

        const next = this.deepCopyGroups(
          this.currentGroupsFor(record.scope, payload.roundNumber, payload.taskId),
        );
        const memberIds = [payload.entitledRosterEntryId, ...payload.fillerRosterEntryIds];
        next.push({
          flyingOrder: payload.reflightGroupFlyingOrder,
          members: memberIds.map((rosterEntryId, i) => ({ rosterEntryId, lane: i + 1 })),
          lonePilotFlagged: memberIds.length === 1,
        });
        this.setOverlay(record.scope, payload.roundNumber, payload.taskId, next);
        break;
      }
      case "competition.deleted": {
        if (record.scope !== "competitions") break;
        const payload = record.payload as { competitionId: string };
        this.specs.delete(payload.competitionId);
        this.candidates.delete(payload.competitionId);
        this.accepted.delete(payload.competitionId);
        this.groupTopologyOverlay.delete(payload.competitionId);
        this.reflightPreparations.delete(payload.competitionId);
        break;
      }
      default:
        break;
    }
  }

  rebuild(events: Iterable<EventRecord>): void {
    this.specs = new Map();
    this.candidates = new Map();
    this.accepted = new Map();
    this.groupTopologyOverlay = new Map();
    this.reflightPreparations = new Map();
    for (const event of events) {
      this.apply(event);
    }
  }

  getSpec(competitionId: string): DrawSpecification | undefined {
    const spec = this.specs.get(competitionId);
    return spec ? this.copySpec(spec) : undefined;
  }

  getCandidate(competitionId: string): GeneratedDraw | undefined {
    const draw = this.candidates.get(competitionId);
    return draw ? this.copyDraw(draw) : undefined;
  }

  getAccepted(competitionId: string): GeneratedDraw | undefined {
    const draw = this.accepted.get(competitionId);
    return draw ? this.copyDraw(draw) : undefined;
  }

  // The DrawStateProvider contract's question (STORY-001-005): "exists" means
  // an *accepted* draw, never mere candidate existence.
  hasAccepted(competitionId: string): boolean {
    return this.accepted.has(competitionId);
  }

  // STORY-001-011: the effective group composition for one round/task — the
  // overlay's latest value if any move/split/re-flight has touched this key,
  // else the accepted draw's stored groups, else [] if no draw is accepted.
  // Deep-copy on return (matches every other getter's discipline).
  getEffectiveGroups(competitionId: string, roundNumber: number, taskId: string): FlightGroup[] {
    return this.deepCopyGroups(this.currentGroupsFor(competitionId, roundNumber, taskId));
  }

  getReflightPreparations(competitionId: string): ReflightPreparedPayload[] {
    return (this.reflightPreparations.get(competitionId) ?? []).map((p) => ({
      ...p,
      fillerRosterEntryIds: [...p.fillerRosterEntryIds],
    }));
  }

  // Pure replay only (no RNG, no clash-checking) — the overlay value if
  // present, else the accepted draw's stored groups for that round/task, else
  // []. Not deep-copied — callers that mutate (apply's own branches above)
  // deep-copy first via deepCopyGroups; getters deep-copy on the way out.
  private currentGroupsFor(competitionId: string, roundNumber: number, taskId: string): FlightGroup[] {
    const key = `${roundNumber}|${taskId}`;
    const overlay = this.groupTopologyOverlay.get(competitionId)?.get(key);
    if (overlay) return overlay;
    const accepted = this.accepted.get(competitionId);
    const round = accepted?.rounds.find((r) => r.roundNumber === roundNumber);
    const taskGroups = round?.taskGroups.find((tg) => tg.taskId === taskId);
    return taskGroups?.groups ?? [];
  }

  private setOverlay(competitionId: string, roundNumber: number, taskId: string, groups: FlightGroup[]): void {
    const key = `${roundNumber}|${taskId}`;
    let forCompetition = this.groupTopologyOverlay.get(competitionId);
    if (!forCompetition) {
      forCompetition = new Map();
      this.groupTopologyOverlay.set(competitionId, forCompetition);
    }
    forCompetition.set(key, groups);
  }

  private deepCopyGroups(groups: FlightGroup[]): FlightGroup[] {
    return groups.map((g) => ({
      flyingOrder: g.flyingOrder,
      lonePilotFlagged: g.lonePilotFlagged,
      members: g.members.map((m) => ({ rosterEntryId: m.rosterEntryId, lane: m.lane })),
    }));
  }

  private copySpec(spec: DrawSpecification): DrawSpecification {
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

  private copyDraw(draw: GeneratedDraw): GeneratedDraw {
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
        // Older stored draw.generated payloads (pre-STORY-001-020) predate
        // this field entirely — default to [] on replay rather than throw
        // (D4).
        taskGroups: (round.taskGroups ?? []).map((tg) => ({
          taskId: tg.taskId,
          taskName: tg.taskName,
          groups: tg.groups.map((g) => ({
            flyingOrder: g.flyingOrder,
            lonePilotFlagged: g.lonePilotFlagged,
            members: g.members.map((m) => ({ rosterEntryId: m.rosterEntryId, lane: m.lane })),
          })),
        })),
      })),
      distribution: {
        maxMeets: draw.distribution.maxMeets,
        totalExcessMeets: draw.distribution.totalExcessMeets,
        variance: draw.distribution.variance,
        pairs: draw.distribution.pairs.map((p) => ({ a: p.a, b: p.b, count: p.count })),
      },
      // Older stored draw.generated payloads (pre-STORY-001-022) predate this
      // field entirely — default to [] on replay rather than throw (D4).
      groupSizeWarnings: (draw.groupSizeWarnings ?? []).map((w) => ({ ...w })),
      // Older stored draw.generated payloads (pre-STORY-001-020) predate this
      // field entirely — default to [] on replay rather than throw (D4).
      taskDistributions: (draw.taskDistributions ?? []).map((td) => ({
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
}
