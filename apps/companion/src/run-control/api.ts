import type {
  LifecycleStateResponse,
  GroupMembership,
} from "@soarscore/shared";

// STORY-001-045: companion-app run-control console seam. The single
// companion-side point of integration for the five backend contracts:
// LifecycleStateResponse (STORY-001-024/025), GroupRunPhase (STORY-001-040),
// PrepGateHoldView (STORY-001-044), group-run actions (STORY-001-032/044),
// and round-advance controls (STORY-001-043/032). `request` is the owning
// hook's apiRequest wrapper, so actor headers are stamped by the caller and
// the base attributes authority server-side (D4).
export type RunControlRequest = <T>(path: string, method?: string, body?: unknown) => Promise<T>;

// Entities: Request/Response DTOs for all five contracts.
// These are transcribed verbatim from sibling stories' prompt files.

export interface GroupRunPhase {
  competitionId: string;
  roundNumber: number;
  groupFlyingOrder: number;
  phase: "Preparation" | "WorkingTime" | "Landing";
  remainingSeconds: number;
  prepGateHeld: boolean;
  phaseStartedAt: string;
}

export interface OutstandingDevice {
  rosterEntryId: string;
  pilotName: string;
  deviceId: string;
}

export interface PrepGateHoldView {
  held: boolean;
  outstanding: OutstandingDevice[];
}

export interface GroupStartResponse {
  roundNumber: number;
  taskId: string;
  groupFlyingOrder: number;
  durationShaped: boolean;
  members: GroupMembership[];
}

export interface RunControlActionResponse {
  roundNumber: number;
  groupFlyingOrder: number;
}

// Read operations: LifecycleStateResponse, GroupRunPhase, PrepGateHoldView.

export function getLifecycle(
  request: RunControlRequest,
  competitionId: string,
): Promise<LifecycleStateResponse> {
  return request<LifecycleStateResponse>(`/api/competitions/${competitionId}/lifecycle`);
}

export function getGroupRunPhase(
  request: RunControlRequest,
  competitionId: string,
  roundNumber: number,
  groupFlyingOrder: number,
): Promise<GroupRunPhase> {
  return request<GroupRunPhase>(
    `/api/competitions/${competitionId}/group-run/${roundNumber}/${groupFlyingOrder}/current`,
  );
}

export function getPrepGateHold(
  request: RunControlRequest,
  competitionId: string,
): Promise<PrepGateHoldView> {
  return request<PrepGateHoldView>(`/api/competitions/${competitionId}/group-run/prep-gate`);
}

// Boundary-action mutations: startProceedings, startGroup, advanceRound.

export function startProceedings(
  request: RunControlRequest,
  competitionId: string,
): Promise<LifecycleStateResponse> {
  return request<LifecycleStateResponse>(`/api/competitions/${competitionId}/start`, "POST");
}

export function startGroup(
  request: RunControlRequest,
  competitionId: string,
): Promise<GroupStartResponse> {
  return request<GroupStartResponse>(
    `/api/competitions/${competitionId}/group-run/start`,
    "POST",
  );
}

export function advanceRound(
  request: RunControlRequest,
  competitionId: string,
): Promise<LifecycleStateResponse> {
  return request<LifecycleStateResponse>(
    `/api/competitions/${competitionId}/round-advance`,
    "POST",
  );
}

// CD authority controls: Preparation phase (pause/resume/fast-forward/add-time),
// WorkingTime phase (abort), and gate-release controls.

export function pausePrep(
  request: RunControlRequest,
  competitionId: string,
  roundNumber: number,
  groupFlyingOrder: number,
): Promise<RunControlActionResponse> {
  return request<RunControlActionResponse>(
    `/api/competitions/${competitionId}/group-run/prep/pause`,
    "POST",
    { roundNumber, groupFlyingOrder },
  );
}

export function resumePrep(
  request: RunControlRequest,
  competitionId: string,
  roundNumber: number,
  groupFlyingOrder: number,
): Promise<RunControlActionResponse> {
  return request<RunControlActionResponse>(
    `/api/competitions/${competitionId}/group-run/prep/resume`,
    "POST",
    { roundNumber, groupFlyingOrder },
  );
}

export function fastForwardPrep(
  request: RunControlRequest,
  competitionId: string,
  roundNumber: number,
  groupFlyingOrder: number,
): Promise<RunControlActionResponse> {
  return request<RunControlActionResponse>(
    `/api/competitions/${competitionId}/group-run/prep/fast-forward`,
    "POST",
    { roundNumber, groupFlyingOrder },
  );
}

export function addPrepTime(
  request: RunControlRequest,
  competitionId: string,
  roundNumber: number,
  groupFlyingOrder: number,
): Promise<RunControlActionResponse> {
  return request<RunControlActionResponse>(
    `/api/competitions/${competitionId}/group-run/prep/add-time`,
    "POST",
    { roundNumber, groupFlyingOrder },
  );
}

export function abortGroup(
  request: RunControlRequest,
  competitionId: string,
  roundNumber: number,
  groupFlyingOrder: number,
  reason: string,
): Promise<RunControlActionResponse> {
  return request<RunControlActionResponse>(
    `/api/competitions/${competitionId}/group-run/abort`,
    "POST",
    { roundNumber, groupFlyingOrder, reason },
  );
}

export function releaseGateDeviceOffline(
  request: RunControlRequest,
  competitionId: string,
  roundNumber: number,
  groupFlyingOrder: number,
  rosterEntryId: string,
  deviceId: string,
): Promise<RunControlActionResponse> {
  return request<RunControlActionResponse>(
    `/api/competitions/${competitionId}/group-run/gate/release-device-offline`,
    "POST",
    { roundNumber, groupFlyingOrder, rosterEntryId, deviceId },
  );
}

export function releaseGatePilotUnconfirmed(
  request: RunControlRequest,
  competitionId: string,
  roundNumber: number,
  groupFlyingOrder: number,
  rosterEntryId: string,
  deviceId: string,
): Promise<RunControlActionResponse> {
  return request<RunControlActionResponse>(
    `/api/competitions/${competitionId}/group-run/gate/release-pilot-unconfirmed`,
    "POST",
    { roundNumber, groupFlyingOrder, rosterEntryId, deviceId },
  );
}

// Round-advance override: the "advance anyway" authority action when
// obstacles are present but the CD overrides them.

export function advanceRoundAnyway(
  request: RunControlRequest,
  competitionId: string,
  roundNumber: number,
): Promise<LifecycleStateResponse> {
  return request<LifecycleStateResponse>(
    `/api/competitions/${competitionId}/round-advance/override`,
    "POST",
    { roundNumber },
  );
}
