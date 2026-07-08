import type { FastifyInstance } from "fastify";
import type { Attribution } from "@soarscore/shared";
import type { PilotService } from "../pilots/service.js";

function attributionFromHeaders(headers: Record<string, unknown>): Attribution {
  const actorName = typeof headers["x-actor-name"] === "string" ? headers["x-actor-name"] : "unknown";
  const originClient =
    typeof headers["x-client-id"] === "string" ? headers["x-client-id"] : "unknown-client";
  return { actorName, originClient, authority: "organiser" };
}

export function registerPilotRoutes(app: FastifyInstance, pilotService: PilotService): void {
  app.get("/api/pilots", async () => pilotService.list());

  app.get<{ Params: { id: string } }>("/api/pilots/:id", async (request) => {
    return pilotService.get(request.params.id);
  });

  app.post("/api/pilots", async (request, reply) => {
    const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
    const pilot = pilotService.create(request.body, attribution);
    reply.code(201);
    return pilot;
  });

  app.put<{ Params: { id: string } }>("/api/pilots/:id", async (request) => {
    const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
    return pilotService.update(request.params.id, request.body, attribution);
  });

  app.delete<{ Params: { id: string } }>("/api/pilots/:id", async (request, reply) => {
    const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
    pilotService.delete(request.params.id, attribution);
    reply.code(204);
  });
}
