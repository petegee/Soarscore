import type { FastifyInstance } from "fastify";
import type { Attribution } from "@soarscore/shared";
import type { RosterService } from "../roster/service.js";

function attributionFromHeaders(headers: Record<string, unknown>): Attribution {
  const actorName = typeof headers["x-actor-name"] === "string" ? headers["x-actor-name"] : "unknown";
  const originClient =
    typeof headers["x-client-id"] === "string" ? headers["x-client-id"] : "unknown-client";
  return { actorName, originClient, authority: "organiser" };
}

interface CompetitionParams {
  competitionId: string;
}

interface EntryParams extends CompetitionParams {
  entryId: string;
}

export function registerRosterRoutes(app: FastifyInstance, rosterService: RosterService): void {
  app.get<{ Params: CompetitionParams }>(
    "/api/competitions/:competitionId/roster",
    async (request) => rosterService.list(request.params.competitionId),
  );

  app.post<{ Params: CompetitionParams }>(
    "/api/competitions/:competitionId/roster",
    async (request, reply) => {
      const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
      const entry = rosterService.add(request.params.competitionId, request.body, attribution);
      reply.code(201);
      return entry;
    },
  );

  app.put<{ Params: EntryParams }>(
    "/api/competitions/:competitionId/roster/:entryId",
    async (request) => {
      const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
      return rosterService.update(
        request.params.competitionId,
        request.params.entryId,
        request.body,
        attribution,
      );
    },
  );

  app.delete<{ Params: EntryParams }>(
    "/api/competitions/:competitionId/roster/:entryId",
    async (request, reply) => {
      const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
      rosterService.remove(request.params.competitionId, request.params.entryId, attribution);
      reply.code(204);
    },
  );

  app.post<{ Params: EntryParams }>(
    "/api/competitions/:competitionId/roster/:entryId/replace",
    async (request) => {
      const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
      return rosterService.replace(
        request.params.competitionId,
        request.params.entryId,
        request.body,
        attribution,
      );
    },
  );
}
