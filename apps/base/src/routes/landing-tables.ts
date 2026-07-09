import type { FastifyInstance } from "fastify";
import type { Attribution } from "@soarscore/shared";
import type { LandingTableService } from "../landing-tables/service.js";

function attributionFromHeaders(headers: Record<string, unknown>): Attribution {
  const actorName = typeof headers["x-actor-name"] === "string" ? headers["x-actor-name"] : "unknown";
  const originClient =
    typeof headers["x-client-id"] === "string" ? headers["x-client-id"] : "unknown-client";
  return { actorName, originClient, authority: "organiser" };
}

export function registerLandingTableRoutes(
  app: FastifyInstance,
  landingTableService: LandingTableService,
): void {
  app.get("/api/landing-tables", async () => landingTableService.list());

  app.get<{ Params: { id: string } }>("/api/landing-tables/:id", async (request) => {
    return landingTableService.get(request.params.id);
  });

  app.post("/api/landing-tables", async (request, reply) => {
    const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
    const table = landingTableService.create(request.body, attribution);
    reply.code(201);
    return table;
  });

  app.put<{ Params: { id: string } }>("/api/landing-tables/:id", async (request) => {
    const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
    return landingTableService.update(request.params.id, request.body, attribution);
  });

  app.post<{ Params: { id: string } }>(
    "/api/landing-tables/:id/duplicate",
    async (request, reply) => {
      const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
      const table = landingTableService.duplicate(request.params.id, attribution);
      reply.code(201);
      return table;
    },
  );

  app.delete<{ Params: { id: string } }>("/api/landing-tables/:id", async (request, reply) => {
    const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
    landingTableService.delete(request.params.id, attribution);
    reply.code(204);
  });
}
