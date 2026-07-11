import type { FastifyInstance } from "fastify";
import type { Attribution } from "@soarscore/shared";
import type { DrawService } from "../draw/service.js";

// Every mutating draw route is an Organiser action (Norm 8); attribution is
// assembled from the client headers, matching the task-config idiom.
function attributionFromHeaders(headers: Record<string, unknown>): Attribution {
  const actorName = typeof headers["x-actor-name"] === "string" ? headers["x-actor-name"] : "unknown";
  const originClient =
    typeof headers["x-client-id"] === "string" ? headers["x-client-id"] : "unknown-client";
  return { actorName, originClient, authority: "organiser" };
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
}
