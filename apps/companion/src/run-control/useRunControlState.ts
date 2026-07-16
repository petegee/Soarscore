import { useCallback, useEffect, useState } from "react";
import type { LifecycleStateResponse, OutstandingItem } from "@soarscore/shared";
import { apiRequest, ApiError } from "../api/client.js";
import type { Actor } from "../identity/useActor.js";
import * as api from "./api.js";
import type {
  GroupRunPhase,
  PrepGateHoldView,
  RunControlRequest,
} from "./api.js";

// STORY-001-045: RunControlState is a plain client-side view-model shape
// (not a class hierarchy, not a persisted store) assembled from the existing
// LifecycleStateResponse plus the two new read calls. No entity here is a
// competition-class model or carries a discipline field (CLAUDE.md law).
export interface RunControlState {
  lifecycle: LifecycleStateResponse;
  phase: GroupRunPhase | null;
  prepGate: PrepGateHoldView | null;
  blockedStartItems: OutstandingItem[] | null;
  blockedRoundAdvanceItems: OutstandingItem[] | null;
  contestComplete: boolean;
}

export interface RunControlActions {
  onStartProceedings: () => Promise<void>;
  onStartGroup: () => Promise<void>;
  onAdvanceRound: () => Promise<void>;
  onPausePrep: () => Promise<void>;
  onResumePrep: () => Promise<void>;
  onFastForwardPrep: () => Promise<void>;
  onAddPrepTime: () => Promise<void>;
  onAbort: (reason: string) => Promise<void>;
  onReleaseGateDeviceOffline: (rosterEntryId: string, deviceId: string) => Promise<void>;
  onReleaseGatePilotUnconfirmed: (rosterEntryId: string, deviceId: string) => Promise<void>;
  onAdvanceRoundAnyway: () => Promise<void>;
}

interface UseRunControlStateResult {
  state: RunControlState | null;
  loading: boolean;
  error: ApiError | null;
  actions: RunControlActions;
}

// Derive the next boundary action: the "one state, one next action" business
// rule from the analysis. This is a pure function the view calls, so the rule
// stays testable in isolation.
export function deriveNextAction(
  state: RunControlState | null,
): "start-proceedings" | "start-group" | "advance-round" | "contest-complete" | null {
  if (!state) return null;

  // Contest complete takes precedence: it can only ever be true once already
  // derived and always overrides the boundary-action set.
  if (state.contestComplete) return "contest-complete";

  // Not running yet: show start-proceedings.
  if (state.lifecycle.state !== "Running") return "start-proceedings";

  // Between groups: show both start-group and advance-round (backend decides
  // which one actually succeeds).
  const runningSubState = state.lifecycle.subState as string | null;
  if (runningSubState === "BetweenGroups") {
    // Return start-group; the view will also show advance-round simultaneously.
    // We return just the first so the view can manage the simultaneous render.
    return "start-group";
  }

  // Group in progress: no boundary action; only authority controls apply.
  return null;
}

export function useRunControlState(
  competitionId: string,
  actor: Actor,
): UseRunControlStateResult {
  const [state, setState] = useState<RunControlState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [contestComplete, setContestComplete] = useState(false);

  const actorName = actor.actorName ?? "unknown";

  const refresh = useCallback(async () => {
    try {
      // Build a bound request closure from apiRequest + actor (mirroring
      // CompetitionLibrary.refresh()).
      const request: RunControlRequest = (path, method, body) =>
        apiRequest(path, {
          method,
          body,
          actorName,
          clientId: actor.clientId,
        });

      // Always fetch lifecycle first.
      const lifecycle = await api.getLifecycle(request, competitionId);

      // If GroupInProgress, fetch GroupRunPhase and PrepGateHoldView in parallel.
      let phase: GroupRunPhase | null = null;
      let prepGate: PrepGateHoldView | null = null;

      const runningSubState = lifecycle.subState as string | null;
      if (runningSubState === "GroupInProgress") {
        // Bootstrap issue (MVP scope): the lifecycle tells us GroupInProgress but
        // doesn't include round/group numbers needed to fetch GroupRunPhase and
        // PrepGateHoldView. The backend needs to provide current group context in
        // the lifecycle response or a dedicated endpoint. For MVP, phase and
        // prepGate remain null; the view displays lifecycle state only. This
        // resolves once the backend supplies round/group info in GroupInProgress.
        phase = null;
        prepGate = null;
      } else {
        phase = null;
        prepGate = null;
      }

      setState({
        lifecycle,
        phase,
        prepGate,
        blockedStartItems: null,
        blockedRoundAdvanceItems: null,
        contestComplete,
      });
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        throw err;
      }
    } finally {
      setLoading(false);
    }
  }, [competitionId, actorName, actor.clientId, contestComplete]);

  // Poll loop: setInterval(refresh, 2000), call refresh() immediately on mount,
  // clear interval on unmount.
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Action callbacks: each calls the matching api.ts function, then refresh().
  // On COMPETITION_NOT_READY error, store outstanding-items and still refresh.
  // On other ApiError, surface via the hook's error return.

  const onStartProceedings = useCallback(async () => {
    try {
      const request: RunControlRequest = (path, method, body) =>
        apiRequest(path, {
          method,
          body,
          actorName,
          clientId: actor.clientId,
        });
      await api.startProceedings(request, competitionId);
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.response.code === "COMPETITION_NOT_READY") {
          const details = err.response.details as
            | { outstandingItems?: OutstandingItem[] }
            | undefined;
          setState((current) =>
            current
              ? {
                  ...current,
                  blockedStartItems: details?.outstandingItems ?? [],
                }
              : null,
          );
          await refresh();
        } else {
          setError(err);
        }
      } else {
        throw err;
      }
    }
  }, [competitionId, actorName, actor.clientId, refresh]);

  const onStartGroup = useCallback(async () => {
    try {
      const request: RunControlRequest = (path, method, body) =>
        apiRequest(path, {
          method,
          body,
          actorName,
          clientId: actor.clientId,
        });
      const response = await api.startGroup(request, competitionId);
      // startGroup response includes roundNumber and groupFlyingOrder; the view
      // can use these to populate group context for subsequent phase fetches.
      // For MVP, just refresh.
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        throw err;
      }
    }
  }, [competitionId, actorName, actor.clientId, refresh]);

  const onAdvanceRound = useCallback(async () => {
    try {
      const request: RunControlRequest = (path, method, body) =>
        apiRequest(path, {
          method,
          body,
          actorName,
          clientId: actor.clientId,
        });
      const response = await api.advanceRound(request, competitionId);
      // Contest-complete detection: if RoundAdvance is no longer in
      // admissibleActions, we've exhausted all rounds.
      if (
        response.subState === "BetweenGroups" &&
        !response.admissibleActions.includes("RoundAdvance")
      ) {
        setContestComplete(true);
      }
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.response.code === "COMPETITION_NOT_READY") {
          const details = err.response.details as
            | { outstandingItems?: OutstandingItem[] }
            | undefined;
          setState((current) =>
            current
              ? {
                  ...current,
                  blockedRoundAdvanceItems: details?.outstandingItems ?? [],
                }
              : null,
          );
          await refresh();
        } else {
          setError(err);
        }
      } else {
        throw err;
      }
    }
  }, [competitionId, actorName, actor.clientId, refresh]);

  const onPausePrep = useCallback(async () => {
    if (!state?.phase) return;
    try {
      const request: RunControlRequest = (path, method, body) =>
        apiRequest(path, {
          method,
          body,
          actorName,
          clientId: actor.clientId,
        });
      await api.pausePrep(request, competitionId, state.phase.roundNumber, state.phase.groupFlyingOrder);
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        throw err;
      }
    }
  }, [state, competitionId, actorName, actor.clientId, refresh]);

  const onResumePrep = useCallback(async () => {
    if (!state?.phase) return;
    try {
      const request: RunControlRequest = (path, method, body) =>
        apiRequest(path, {
          method,
          body,
          actorName,
          clientId: actor.clientId,
        });
      await api.resumePrep(request, competitionId, state.phase.roundNumber, state.phase.groupFlyingOrder);
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        throw err;
      }
    }
  }, [state, competitionId, actorName, actor.clientId, refresh]);

  const onFastForwardPrep = useCallback(async () => {
    if (!state?.phase) return;
    try {
      const request: RunControlRequest = (path, method, body) =>
        apiRequest(path, {
          method,
          body,
          actorName,
          clientId: actor.clientId,
        });
      await api.fastForwardPrep(request, competitionId, state.phase.roundNumber, state.phase.groupFlyingOrder);
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        throw err;
      }
    }
  }, [state, competitionId, actorName, actor.clientId, refresh]);

  const onAddPrepTime = useCallback(async () => {
    if (!state?.phase) return;
    try {
      const request: RunControlRequest = (path, method, body) =>
        apiRequest(path, {
          method,
          body,
          actorName,
          clientId: actor.clientId,
        });
      await api.addPrepTime(request, competitionId, state.phase.roundNumber, state.phase.groupFlyingOrder);
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        throw err;
      }
    }
  }, [state, competitionId, actorName, actor.clientId, refresh]);

  const onAbort = useCallback(
    async (reason: string) => {
      if (!state?.phase) return;
      try {
        const request: RunControlRequest = (path, method, body) =>
          apiRequest(path, {
            method,
            body,
            actorName,
            clientId: actor.clientId,
          });
        await api.abortGroup(request, competitionId, state.phase.roundNumber, state.phase.groupFlyingOrder, reason);
        await refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err);
        } else {
          throw err;
        }
      }
    },
    [state, competitionId, actorName, actor.clientId, refresh],
  );

  const onReleaseGateDeviceOffline = useCallback(
    async (rosterEntryId: string, deviceId: string) => {
      if (!state?.phase) return;
      try {
        const request: RunControlRequest = (path, method, body) =>
          apiRequest(path, {
            method,
            body,
            actorName,
            clientId: actor.clientId,
          });
        await api.releaseGateDeviceOffline(
          request,
          competitionId,
          state.phase.roundNumber,
          state.phase.groupFlyingOrder,
          rosterEntryId,
          deviceId,
        );
        await refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err);
        } else {
          throw err;
        }
      }
    },
    [state, competitionId, actorName, actor.clientId, refresh],
  );

  const onReleaseGatePilotUnconfirmed = useCallback(
    async (rosterEntryId: string, deviceId: string) => {
      if (!state?.phase) return;
      try {
        const request: RunControlRequest = (path, method, body) =>
          apiRequest(path, {
            method,
            body,
            actorName,
            clientId: actor.clientId,
          });
        await api.releaseGatePilotUnconfirmed(
          request,
          competitionId,
          state.phase.roundNumber,
          state.phase.groupFlyingOrder,
          rosterEntryId,
          deviceId,
        );
        await refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err);
        } else {
          throw err;
        }
      }
    },
    [state, competitionId, actorName, actor.clientId, refresh],
  );

  const onAdvanceRoundAnyway = useCallback(async () => {
    if (!state?.phase) return;
    try {
      const request: RunControlRequest = (path, method, body) =>
        apiRequest(path, {
          method,
          body,
          actorName,
          clientId: actor.clientId,
        });
      const response = await api.advanceRoundAnyway(request, competitionId, state.phase.roundNumber);
      // Contest-complete detection: same logic as onAdvanceRound.
      if (
        response.subState === "BetweenGroups" &&
        !response.admissibleActions.includes("RoundAdvance")
      ) {
        setContestComplete(true);
      }
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        throw err;
      }
    }
  }, [state, competitionId, actorName, actor.clientId, refresh]);

  return {
    state,
    loading,
    error,
    actions: {
      onStartProceedings,
      onStartGroup,
      onAdvanceRound,
      onPausePrep,
      onResumePrep,
      onFastForwardPrep,
      onAddPrepTime,
      onAbort,
      onReleaseGateDeviceOffline,
      onReleaseGatePilotUnconfirmed,
      onAdvanceRoundAnyway,
    },
  };
}
