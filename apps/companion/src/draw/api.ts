import type { DrawEvidenceView, SaveDrawSpecRequest } from "@soarscore/shared";

// The single companion-side seam for the STORY-001-009 draw endpoints — the
// only module that knows these paths. STORY-001-018's draw workflow screen
// shares this seam rather than re-declaring them. `request` is the owning
// view's apiRequest wrapper, so the actor headers (X-Actor-Name / X-Client-Id)
// are stamped by the caller and the base attributes authority server-side (D4).
export type DrawRequest = <T>(path: string, method?: string, body?: unknown) => Promise<T>;

export function getDraw(
  request: DrawRequest,
  competitionId: string,
): Promise<DrawEvidenceView> {
  return request<DrawEvidenceView>(`/api/competitions/${competitionId}/draw`);
}

export function saveDrawSpec(
  request: DrawRequest,
  competitionId: string,
  body: SaveDrawSpecRequest,
): Promise<DrawEvidenceView> {
  return request<DrawEvidenceView>(`/api/competitions/${competitionId}/draw/spec`, "PUT", body);
}

// Generate (or regenerate — the identical call; the projection keeps a single
// candidate, so re-generating supersedes it) a candidate draw. STORY-001-009's
// half of the seam: generate ≠ accept. Callers refresh() afterwards rather
// than trusting the response — the base is the sole source of truth (D8).
export function generateDraw(request: DrawRequest, competitionId: string): Promise<void> {
  return request<void>(`/api/competitions/${competitionId}/draw/generate`, "POST");
}

// The STORY-001-017 decision seam: accept/cancel the awaiting-decision
// candidate by id. The base stamps contest-director authority server-side —
// the client never sends an authority. A stale drawId 409s with
// DRAW_CANDIDATE_NOT_FOUND / DRAW_CANDIDATE_SUPERSEDED for the caller to
// reconcile by re-fetching (last-action-wins, companion-app §2).
// STORY-001-023: the CD's per-warning acknowledgement rides the same accept
// call as `acknowledgedWarningIds` — the base re-validates independently and
// 409s DrawGroupSizeWarningUnacknowledgedError if any gating warning's id is
// missing (drawDecisionRequestSchema already defaults this to [] server-side,
// so the extra key is purely additive on the wire).
export function acceptDraw(
  request: DrawRequest,
  competitionId: string,
  drawId: string,
  acknowledgedWarningIds: string[],
): Promise<DrawEvidenceView> {
  return request<DrawEvidenceView>(`/api/competitions/${competitionId}/draw/accept`, "POST", {
    drawId,
    acknowledgedWarningIds,
  });
}

export function cancelDraw(
  request: DrawRequest,
  competitionId: string,
  drawId: string,
): Promise<DrawEvidenceView> {
  return request<DrawEvidenceView>(`/api/competitions/${competitionId}/draw/cancel`, "POST", {
    drawId,
  });
}
