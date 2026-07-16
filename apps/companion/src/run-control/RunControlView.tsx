import type { Actor } from "../identity/useActor.js";
import { useRunControlState, deriveNextAction } from "./useRunControlState.js";
import type { RunControlState } from "./useRunControlState.js";

// STORY-001-045: Companion-app run-control console view. Renders RunControlState
// and dispatches the hook's action callbacks; no direct API calls. Pure rendering
// — state banner, single next-boundary-action button, phase-gated authority-
// control grid, outstanding-items lists, prep-gate banner — driven entirely by
// the hook's returned RunControlState; no direct apiRequest calls in this file
// (all routed through the hook).

interface RunControlViewProps {
  competitionId: string;
  actor: Actor;
  onBack?: () => void;
}

export function RunControlView({ competitionId, actor, onBack }: RunControlViewProps) {
  const { state, loading, error, actions } = useRunControlState(competitionId, actor);

  if (loading) {
    return <p className="status-text">Loading run control…</p>;
  }

  if (!state) {
    return <p className="status-text">Unable to load run control state.</p>;
  }

  const nextAction = deriveNextAction(state);

  // Contest-complete fallback (Safeguard 9): when deriveNextAction returns
  // "contest-complete", render only the completion banner and return early.
  if (nextAction === "contest-complete") {
    return (
      <div className="run-control-view">
        <div className="state-banner">
          <p>Contest complete — proceed to Lock</p>
        </div>
        {onBack && (
          <div className="toolbar">
            <button className="btn" onClick={onBack}>
              Back
            </button>
          </div>
        )}
      </div>
    );
  }

  // Render the full console: state banner, blocked-items, prep-gate, boundary
  // actions, and authority controls.
  return (
    <div className="run-control-view">
      {/* State banner: state/subState/phase as plain text */}
      <div className="state-banner">
        <p>
          {state.lifecycle.state}
          {state.lifecycle.subState && ` — ${state.lifecycle.subState}`}
          {state.phase && ` (${state.phase.phase}, ${state.phase.remainingSeconds}s)`}
        </p>
      </div>

      {/* Blocked-items banner (AC2/AC6): render when present */}
      {state.blockedStartItems && state.blockedStartItems.length > 0 && (
        <div className="blocked-items-banner" role="alert">
          <p>Cannot start proceedings:</p>
          <ul>
            {state.blockedStartItems.map((item) => (
              <li key={item.code}>{item.message}</li>
            ))}
          </ul>
        </div>
      )}

      {state.blockedRoundAdvanceItems && state.blockedRoundAdvanceItems.length > 0 && (
        <div className="blocked-items-banner" role="alert">
          <p>Cannot advance round:</p>
          <ul>
            {state.blockedRoundAdvanceItems.map((item) => (
              <li key={item.code}>{item.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Prep-gate-held banner (AC4): when prepGate.held, list outstanding devices */}
      {state.prepGate?.held && state.prepGate.outstanding.length > 0 && (
        <div className="prep-gate-banner" role="alert">
          <p>Preparation gate held — awaiting:</p>
          <ul>
            {state.prepGate.outstanding.map((device) => (
              <li key={device.rosterEntryId}>
                <span>
                  {device.pilotName} ({device.deviceId})
                </span>
                <div className="device-actions">
                  <button
                    className="btn btn-small"
                    onClick={() =>
                      actions.onReleaseGateDeviceOffline(device.rosterEntryId, device.deviceId)
                    }
                  >
                    Device offline
                  </button>
                  <button
                    className="btn btn-small"
                    onClick={() =>
                      actions.onReleaseGatePilotUnconfirmed(device.rosterEntryId, device.deviceId)
                    }
                  >
                    Pilot unconfirmed
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Error display: generic inline message for unhandled ApiErrors */}
      {error && (
        <div className="error-banner" role="alert">
          <p>{error.message}</p>
        </div>
      )}

      {/* Primary boundary actions (AC1/AC3/AC7) */}
      <div className="boundary-actions">
        {nextAction === "start-proceedings" && (
          <button className="btn btn-primary" onClick={actions.onStartProceedings}>
            Start Proceedings
          </button>
        )}

        {nextAction === "start-group" && (
          <>
            <button className="btn btn-primary" onClick={actions.onStartGroup}>
              Start Group
            </button>
            <button className="btn btn-primary" onClick={actions.onAdvanceRound}>
              Advance Round
            </button>
          </>
        )}
      </div>

      {/* Authority-control grid (AC5), shown only when phase !== null */}
      {state.phase && (
        <div className="authority-controls">
          <fieldset>
            <legend>CD Authority Controls</legend>

            {/* Preparation phase: pause/resume/fast-forward/add-time enabled */}
            {state.phase.phase === "Preparation" && (
              <div className="button-grid">
                <button className="btn btn-secondary" onClick={actions.onPausePrep}>
                  Pause
                </button>
                <button className="btn btn-secondary" onClick={actions.onResumePrep}>
                  Resume
                </button>
                <button className="btn btn-secondary" onClick={actions.onFastForwardPrep}>
                  Fast-forward
                </button>
                <button className="btn btn-secondary" onClick={actions.onAddPrepTime}>
                  Add time
                </button>
              </div>
            )}

            {/* WorkingTime phase: abort only */}
            {state.phase.phase === "WorkingTime" && (
              <div className="button-grid">
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    const reason = prompt("Reason for abort:");
                    if (reason !== null) {
                      actions.onAbort(reason);
                    }
                  }}
                >
                  Abort
                </button>
              </div>
            )}

            {/* Landing phase: no authority controls offered */}
            {state.phase.phase === "Landing" && (
              <p className="status-text">Landing phase — no authority controls available.</p>
            )}
          </fieldset>
        </div>
      )}

      {/* "Advance anyway" button (AC6), shown only alongside blockedRoundAdvanceItems */}
      {state.blockedRoundAdvanceItems && state.blockedRoundAdvanceItems.length > 0 && (
        <div className="advance-anyway">
          <button className="btn btn-danger" onClick={actions.onAdvanceRoundAnyway}>
            Advance anyway
          </button>
        </div>
      )}

      {/* Back button if provided */}
      {onBack && (
        <div className="toolbar">
          <button className="btn" onClick={onBack}>
            Back
          </button>
        </div>
      )}
    </div>
  );
}
