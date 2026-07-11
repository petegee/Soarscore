import type { FastifyInstance } from "fastify";
import type { Attribution } from "@soarscore/shared";
import type { CompetitionService } from "../competitions/service.js";

function attributionFromHeaders(headers: Record<string, unknown>): Attribution {
  const actorName = typeof headers["x-actor-name"] === "string" ? headers["x-actor-name"] : "unknown";
  const originClient =
    typeof headers["x-client-id"] === "string" ? headers["x-client-id"] : "unknown-client";
  return { actorName, originClient, authority: "organiser" };
}

export function registerCompetitionRoutes(
  app: FastifyInstance,
  competitionService: CompetitionService,
): void {
  app.get("/api/competitions", async () => competitionService.list());

  app.get<{ Params: { id: string } }>("/api/competitions/:id", async (request) => {
    return competitionService.get(request.params.id);
  });

  app.post("/api/competitions", async (request, reply) => {
    const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
    const competition = competitionService.create(request.body, attribution);
    reply.code(201);
    return competition;
  });

  app.put<{ Params: { id: string } }>("/api/competitions/:id", async (request) => {
    const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
    return competitionService.update(request.params.id, request.body, attribution);
  });

  app.delete<{ Params: { id: string } }>("/api/competitions/:id", async (request, reply) => {
    const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
    // AC5's consequence-naming acknowledgment is a required body flag, enforced
    // on the base so a mis-built client cannot bypass it. Defaults to false.
    const body = (request.body ?? {}) as { confirmDestroysResults?: unknown };
    const confirmDestroysResults = body.confirmDestroysResults === true;
    competitionService.delete(request.params.id, { confirmDestroysResults }, attribution);
    reply.code(204);
  });
}
