import type { FastifyInstance } from "fastify";
import type { Attribution } from "@soarscore/shared";
import type { CompetitionTaskConfigService } from "../task-config/service.js";

function attributionFromHeaders(headers: Record<string, unknown>): Attribution {
  const actorName = typeof headers["x-actor-name"] === "string" ? headers["x-actor-name"] : "unknown";
  const originClient =
    typeof headers["x-client-id"] === "string" ? headers["x-client-id"] : "unknown-client";
  return { actorName, originClient, authority: "organiser" };
}

interface CompetitionParams {
  competitionId: string;
}

export function registerTaskConfigRoutes(
  app: FastifyInstance,
  taskConfigService: CompetitionTaskConfigService,
): void {
  app.get<{ Params: CompetitionParams }>(
    "/api/competitions/:competitionId/task-config",
    async (request) => taskConfigService.get(request.params.competitionId),
  );

  app.put<{ Params: CompetitionParams }>(
    "/api/competitions/:competitionId/task-config",
    async (request) => {
      const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
      return taskConfigService.update(request.params.competitionId, request.body, attribution);
    },
  );
}
