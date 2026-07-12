import type { FastifyInstance } from "fastify";
import { drawDecisionRequestSchema, type Attribution, type DrawDecisionRequest } from "@soarscore/shared";
import type { DrawService } from "../draw/service.js";
import { ValidationError } from "../draw/errors.js";

// Structural validation of the decision body (Norm 2): the parseOrThrow →
// ValidationError idiom, so a missing/blank drawId maps to 400 like every
// other structural failure.
function parseDecision(body: unknown): DrawDecisionRequest {
  const result = drawDecisionRequestSchema.safeParse(body ?? {});
  if (!result.success) {
    throw new ValidationError("Validation failed", result.error.flatten());
  }
  return result.data;
}

// Spec/generate are Organiser actions; attribution is assembled from the
// client headers, matching the task-config idiom.
function attributionFromHeaders(headers: Record<string, unknown>): Attribution {
  const actorName = typeof headers["x-actor-name"] === "string" ? headers["x-actor-name"] : "unknown";
  const originClient =
    typeof headers["x-client-id"] === "string" ? headers["x-client-id"] : "unknown-client";
  return { actorName, originClient, authority: "organiser" };
}

// Accept/cancel are Area 4.3 Contest Director actions (STORY-001-017): the
// decision is recorded with contest-director authority — recorded, not
// enforced (D1). A deliberate, story-scoped divergence from the app-wide
// organiser default; do not fold into the helper above.
function cdAttributionFromHeaders(headers: Record<string, unknown>): Attribution {
  const actorName = typeof headers["x-actor-name"] === "string" ? headers["x-actor-name"] : "unknown";
  const originClient =
    typeof headers["x-client-id"] === "string" ? headers["x-client-id"] : "unknown-client";
  return { actorName, originClient, authority: "contest-director" };
}

interface CompetitionParams {
  competitionId: string;
}

export function registerDrawRoutes(app: FastifyInstance, drawService: DrawService): void {
  // Evidence read-model: spec + current candidate + soft warnings (4.3 consumer).
  app.get<{ Params: CompetitionParams }>(
    "/api/competitions/:competitionId/draw",
    async (request) => drawService.getEvidence(request.params.competitionId),
  );

  // Save/replace the validated draw specification (AC1 rejects, AC2 warns).
  app.put<{ Params: CompetitionParams }>(
    "/api/competitions/:competitionId/draw/spec",
    async (request) => {
      const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
      return drawService.saveSpec(request.params.competitionId, request.body, attribution);
    },
  );

  // Generate a candidate draw (generate ≠ accept). AC6 fails without persisting.
  app.post<{ Params: CompetitionParams }>(
    "/api/competitions/:competitionId/draw/generate",
    async (request) => {
      const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
      return drawService.generate(request.params.competitionId, attribution);
    },
  );

  // Accept the awaiting-decision candidate as the authoritative draw (017 AC1).
  app.post<{ Params: CompetitionParams }>(
    "/api/competitions/:competitionId/draw/accept",
    async (request) => {
      const attribution = cdAttributionFromHeaders(request.headers as Record<string, unknown>);
      const { drawId } = parseDecision(request.body);
      return drawService.accept(request.params.competitionId, drawId, attribution);
    },
  );

  // Cancel (discard) the awaiting-decision candidate (017 AC4).
  app.post<{ Params: CompetitionParams }>(
    "/api/competitions/:competitionId/draw/cancel",
    async (request) => {
      const attribution = cdAttributionFromHeaders(request.headers as Record<string, unknown>);
      const { drawId } = parseDecision(request.body);
      return drawService.cancel(request.params.competitionId, drawId, attribution);
    },
  );
}
