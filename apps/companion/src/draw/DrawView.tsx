import { useCallback, useEffect, useState } from "react";
import type {
  Competition,
  DrawEvidenceView,
  FairnessMetric,
  FlightGroup,
  GeneratedDraw,
  MatchupDistribution,
  RosterEntryView,
  TaskGroupSet,
  TaskMatchupDistribution,
} from "@soarscore/shared";
import { apiRequest, ApiError } from "../api/client.js";
import type { Actor } from "../identity/useActor.js";
import { acceptDraw, cancelDraw, generateDraw, getDraw } from "./api.js";

// The competition-scoped draw console (STORY-001-018): generate a candidate
// draw, review it and its fairness evidence, and take the Contest Director's
// decision — accept, regenerate, or cancel (Area 4.2/4.3). Pure UI over the
// STORY-001-009 generation and STORY-001-017 acceptance backends; it holds no
// draw truth of its own (D8) — every render derives from the last fetch and
// every mutation is followed by refresh(), so a replacement client shows the
// same status by construction (AC8).

// Draw slots key on rosterEntryId, never pilotId (RD4) — a post-draw
// replacement inherits the seat, and the name join happens at read time.
function buildRosterMap(entries: RosterEntryView[]): Map<string, RosterEntryView> {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

// Resolve a draw's rosterEntryId to a display label. The roster and draw are
// fetched independently and the roster is mutable, so an unmatched id must
// degrade to a visible placeholder — never a crash.
function nameFor(map: Map<string, RosterEntryView>, rosterEntryId: string): string {
  const entry = map.get(rosterEntryId);
  if (!entry) return `⟨entry ${rosterEntryId.slice(0, 8)}⟩`;
  return entry.pilotNumber != null ? `#${entry.pilotNumber} ${entry.pilotName}` : entry.pilotName;
}

// Shared per-round group/lane table body (STORY-001-021): extracted out of
// DrawRounds so both the single-task path (whole round, unchanged below) and
// the multi-task per-task sections (TaskDrawSections) render an identical
// group/lane table without duplicating the sort/lonePilotFlagged logic.
function renderRoundGroupsTable(
  groups: FlightGroup[],
  rosterMap: Map<string, RosterEntryView>,
): JSX.Element {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Group</th>
            <th>Lane</th>
            <th>Pilot</th>
          </tr>
        </thead>
        <tbody>
          {[...groups]
            .sort((a, b) => a.flyingOrder - b.flyingOrder)
            .flatMap((group) =>
              [...group.members]
                .sort((a, b) => a.lane - b.lane)
                .map((member, index) => (
                  <tr key={`${group.flyingOrder}-${member.rosterEntryId}`}>
                    <td>
                      {index === 0 && (
                        <>
                          Group {group.flyingOrder}
                          {/* An arithmetically unavoidable singleton —
                              badge it so the CD sees it before accepting. */}
                          {group.lonePilotFlagged && (
                            <>
                              {" "}
                              <span className="badge">lone pilot</span>
                            </>
                          )}
                        </>
                      )}
                    </td>
                    <td>{member.lane}</td>
                    <td>{nameFor(rosterMap, member.rosterEntryId)}</td>
                  </tr>
                )),
            )}
        </tbody>
      </table>
    </div>
  );
}

// Rounds → groups (by flyingOrder) → lane-ordered pilots, names joined from
// the roster (AC1). Shared verbatim between the candidate and accepted
// renders so "accepted" is a status treatment, not a different draw view.
// Single-task path only (STORY-001-021 AC3): body is unchanged other than
// delegating the table itself to renderRoundGroupsTable — output is
// identical to the pre-021 rendering.
export function DrawRounds({
  draw,
  rosterMap,
}: {
  draw: GeneratedDraw;
  rosterMap: Map<string, RosterEntryView>;
}) {
  return (
    <>
      {draw.rounds.map((round) => (
        <section key={round.roundNumber}>
          <h2>Round {round.roundNumber}</h2>
          {renderRoundGroupsTable(round.groups, rosterMap)}
        </section>
      ))}
    </>
  );
}

// Shared fairness-summary-line + pairs-table body (STORY-001-021). label is
// null for the single-task path (no visible task label, per AC3) and the
// task's name for a per-task card; attemptsRun is a whole-draw figure so it
// is only shown when supplied (never repeated per task, per the analysis).
function renderFairnessCard(
  label: string | null,
  metric: FairnessMetric,
  metricValue: number,
  distribution: MatchupDistribution,
  attemptsRun: number | null,
  rosterMap: Map<string, RosterEntryView>,
): JSX.Element {
  return (
    <section>
      <h2>{label ? `Fairness evidence — ${label}` : "Fairness evidence"}</h2>
      <p className="status-text">
        Metric: {metric} = {metricValue} · worst repeat {distribution.maxMeets} · total excess
        meets {distribution.totalExcessMeets} · variance {distribution.variance}
        {attemptsRun != null && <> · fairest of {attemptsRun} attempts</>}
      </p>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Pilot</th>
              <th>Pilot</th>
              <th>Meets</th>
            </tr>
          </thead>
          <tbody>
            {distribution.pairs.map((pair) => (
              <tr key={`${pair.a}-${pair.b}`}>
                <td>{nameFor(rosterMap, pair.a)}</td>
                <td>{nameFor(rosterMap, pair.b)}</td>
                <td>{pair.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// The anti-repeat evidence (AC2): the metric and its scalar, the distribution
// summary, and every pair's meet count with names substituted — enough for
// the CD to judge fairness before deciding. Single-task path only
// (STORY-001-021 AC3): delegates to renderFairnessCard with label/attemptsRun
// set from the flat fields — no new label introduced here.
export function FairnessEvidence({
  draw,
  rosterMap,
}: {
  draw: GeneratedDraw;
  rosterMap: Map<string, RosterEntryView>;
}) {
  return renderFairnessCard(
    null,
    draw.metric,
    draw.metricValue,
    draw.distribution,
    draw.attemptsRun,
    rosterMap,
  );
}

// Multi-task composition view (STORY-001-021 AC1): one labelled section per
// class-model task, each holding its own round-by-round group tables. Task
// identity/order comes from the first round's taskGroups — constant across
// rounds for a given draw (STORY-001-020) — never re-sorted here.
export function TaskDrawSections({
  draw,
  rosterMap,
}: {
  draw: GeneratedDraw;
  rosterMap: Map<string, RosterEntryView>;
}) {
  const tasks: TaskGroupSet[] = draw.rounds[0]?.taskGroups ?? [];
  return (
    <>
      {tasks.map((task) => (
        <section key={task.taskId}>
          <h2>{task.taskName}</h2>
          {draw.rounds.map((round) => {
            const taskGroups = round.taskGroups.find((tg) => tg.taskId === task.taskId);
            if (!taskGroups) return null;
            return (
              <section key={`${task.taskId}-${round.roundNumber}`}>
                <h3>Round {round.roundNumber}</h3>
                {renderRoundGroupsTable(taskGroups.groups, rosterMap)}
              </section>
            );
          })}
        </section>
      ))}
    </>
  );
}

// Multi-task fairness view (STORY-001-021 AC2): one fairness card per task,
// laid out side by side so the CD can compare tasks' figures without
// scrolling — each card's metricValue/distribution stays its own, never
// summed or averaged across tasks (per the business-rule safeguard).
export function TaskFairnessRow({
  draw,
  rosterMap,
}: {
  draw: GeneratedDraw;
  rosterMap: Map<string, RosterEntryView>;
}) {
  const taskDistributions: TaskMatchupDistribution[] = draw.taskDistributions;
  return (
    <div className="task-fairness-row">
      {taskDistributions.map((entry) => (
        <div key={entry.taskId}>
          {renderFairnessCard(
            entry.taskName,
            draw.metric,
            entry.metricValue,
            entry.distribution,
            null,
            rosterMap,
          )}
        </div>
      ))}
    </div>
  );
}

// Display-mode gate (STORY-001-021): a draw's taskGroups length is constant
// across rounds (one entry per class-model task), so the first round is a
// sufficient, single source of truth — no separate class-model fetch. Every
// existing single-task class's draw evaluates false here, unchanged.
export function isMultiTask(draw: GeneratedDraw): boolean {
  return (draw.rounds[0]?.taskGroups.length ?? 1) > 1;
}

export function DrawView({
  competitionId,
  actor,
  onBack,
}: {
  competitionId: string;
  actor: Actor;
  onBack: () => void;
}) {
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [evidence, setEvidence] = useState<DrawEvidenceView | null>(null);
  const [roster, setRoster] = useState<RosterEntryView[]>([]);
  const [loading, setLoading] = useState(true);
  // In-flight guard: generation runs 200 attempts synchronously on the base,
  // so every action button disables while a call runs (no double-fire).
  const [busy, setBusy] = useState(false);
  // Top-level failure/guidance message (AC7 and the 409 reconciliations).
  const [alert, setAlert] = useState<string | null>(null);
  // Drives the role="dialog" cancel confirmation.
  const [cancelPending, setCancelPending] = useState(false);

  const actorName = actor.actorName ?? "unknown";
  const request = useCallback(
    <T,>(path: string, method?: string, body?: unknown) =>
      apiRequest<T>(path, { method, body, actorName, clientId: actor.clientId }),
    [actorName, actor.clientId],
  );

  // Re-fetch all base state — the sole source of truth. A fresh or replaced
  // client renders the current status purely from this fetch (AC8).
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [drawEvidence, entries, comp] = await Promise.all([
        getDraw(request, competitionId),
        request<RosterEntryView[]>(`/api/competitions/${competitionId}/roster`),
        request<Competition>(`/api/competitions/${competitionId}`),
      ]);
      setEvidence(drawEvidence);
      setRoster(entries);
      setCompetition(comp);
    } finally {
      setLoading(false);
    }
  }, [request, competitionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Generate and regenerate are the same call (AC5): the projection keeps a
  // single candidate, so generating again supersedes the displayed one.
  async function handleGenerate() {
    setBusy(true);
    setAlert(null);
    try {
      await generateDraw(request, competitionId);
      await refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.response.code === "DRAW_SPEC_NOT_FOUND") {
          // Missing prerequisite, not a crash: no companion flow reaches here
          // without a saved spec once the guidance state below is in place,
          // but a concurrent client may have deleted/never saved one.
          setAlert(
            "No draw specification has been configured for this competition yet — " +
              "a draw cannot be generated until one exists. Configure it on the " +
              "Draw spec screen first.",
          );
        } else {
          // DRAW_GENERATION_FAILED and any other spec/bound code: show the
          // base's reason verbatim; nothing was stored, Generate stays
          // available (AC7).
          setAlert(error.response.message);
        }
      } else {
        throw error;
      }
    } finally {
      setBusy(false);
    }
  }

  // Accept/cancel reference the displayed candidate by id (017 AC6). A 409
  // means the candidate changed under the operator (a concurrent client
  // regenerated or cleared it): alert + refresh() re-syncs to the base's
  // current state and lets the operator re-decide — last-action-wins
  // (companion-app §2), never a forced stale decision.
  async function handleDecision(decide: "accept" | "cancel") {
    const candidate = evidence?.candidate;
    if (!candidate) return;
    setBusy(true);
    setAlert(null);
    try {
      const next =
        decide === "accept"
          ? await acceptDraw(request, competitionId, candidate.id)
          : await cancelDraw(request, competitionId, candidate.id);
      // Show the returned view transiently, then re-canonicalise from the
      // base — the returned view is never the retained source of truth.
      setEvidence(next);
      await refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        setAlert(error.response.message);
        await refresh();
      } else {
        throw error;
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading || !competition || !evidence) {
    return <p className="status-text">Loading…</p>;
  }

  const rosterMap = buildRosterMap(roster);
  const { spec, candidate, accepted, status, warnings } = evidence;

  return (
    <div>
      <div className="toolbar">
        <button className="btn" onClick={onBack}>
          ← Competitions
        </button>
      </div>
      <h1>Draw — {competition.name}</h1>

      {alert && (
        <p role="alert" className="field-error">
          {alert}
        </p>
      )}

      {/* Missing prerequisite: no companion spec-editor existed when this
          story was drafted (STORY-001-019 has since built one at Draw spec);
          without a saved spec, generate would only 409 DRAW_SPEC_NOT_FOUND,
          so guide instead of offering a dead button. This screen deliberately
          does not create or edit a spec. */}
      {spec === null && (
        <p className="status-text">
          No draw specification configured yet — configure the draw on the Draw
          spec screen before generating.
        </p>
      )}

      {/* Soft advisories from the spec/roster (never blocking). */}
      {warnings.map((warning) => (
        <p role="alert" className="status-text" key={warning.constraint}>
          <span className="badge">advisory</span> {warning.message}
        </p>
      ))}

      {status === "no-draw" && (
        <div className="toolbar">
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={busy || spec === null}
          >
            Generate draw
          </button>
          {busy && <span className="status-text">Generating…</span>}
          {!busy && spec !== null && (
            <span className="status-text">No draw yet — generate a candidate to review.</span>
          )}
        </div>
      )}

      {status === "awaiting-decision" && candidate && (
        <>
          {/* Generate ≠ accept: this candidate is not the contest draw until
              the CD accepts it. */}
          <p className="status-text">
            <span className="badge">candidate</span> Awaiting decision — review the draw and
            fairness evidence, then accept, regenerate, or cancel.
          </p>
          <div className="toolbar">
            <button
              className="btn btn-primary"
              onClick={() => handleDecision("accept")}
              disabled={busy}
            >
              Accept
            </button>
            <button className="btn" onClick={handleGenerate} disabled={busy}>
              Regenerate
            </button>
            <button
              className="btn btn-danger"
              onClick={() => setCancelPending(true)}
              disabled={busy}
            >
              Cancel draw
            </button>
            {busy && <span className="status-text">Working…</span>}
          </div>
          {isMultiTask(candidate) ? (
            <>
              <TaskDrawSections draw={candidate} rosterMap={rosterMap} />
              <TaskFairnessRow draw={candidate} rosterMap={rosterMap} />
            </>
          ) : (
            <>
              <DrawRounds draw={candidate} rosterMap={rosterMap} />
              <FairnessEvidence draw={candidate} rosterMap={rosterMap} />
            </>
          )}
        </>
      )}

      {status === "accepted" && accepted && (
        <>
          {/* Accept-once MVP: no cancel/regenerate after acceptance (re-draw
              after acceptance is Scope Out). AC4 is observable here only as
              this accepted status/fact — the downstream consumers (lanes 010,
              groups 011, reports 015) are separate stories. */}
          <p className="status-text">
            <span className="badge">accepted</span> This draw is the competition&apos;s accepted
            draw — lane adjustments, group management and reports build on it.
          </p>
          {isMultiTask(accepted) ? (
            <>
              <TaskDrawSections draw={accepted} rosterMap={rosterMap} />
              <TaskFairnessRow draw={accepted} rosterMap={rosterMap} />
            </>
          ) : (
            <>
              <DrawRounds draw={accepted} rosterMap={rosterMap} />
              <FairnessEvidence draw={accepted} rosterMap={rosterMap} />
            </>
          )}
        </>
      )}

      {cancelPending && (
        <div className="dialog-backdrop">
          <div role="dialog" className="dialog">
            <p>
              Cancel the candidate draw? It will be discarded and a new one can
              be generated.
            </p>
            <div className="form-actions">
              <button
                className="btn btn-danger"
                disabled={busy}
                onClick={async () => {
                  setCancelPending(false);
                  await handleDecision("cancel");
                }}
              >
                Cancel draw
              </button>
              <button className="btn" onClick={() => setCancelPending(false)}>
                Keep candidate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
