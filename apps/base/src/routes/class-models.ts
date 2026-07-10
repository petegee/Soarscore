import type { FastifyInstance } from "fastify";
import type { Attribution } from "@soarscore/shared";
import type { ClassModelService } from "../class-models/service.js";

function attributionFromHeaders(headers: Record<string, unknown>): Attribution {
  const actorName = typeof headers["x-actor-name"] === "string" ? headers["x-actor-name"] : "unknown";
  const originClient =
    typeof headers["x-client-id"] === "string" ? headers["x-client-id"] : "unknown-client";
  return { actorName, originClient, authority: "organiser" };
}

// No POST /api/class-models: models are only ever seeded (on init) or cloned.
export function registerClassModelRoutes(
  app: FastifyInstance,
  classModelService: ClassModelService,
): void {
  app.get("/api/class-models", async () => classModelService.list());

  app.get<{ Params: { id: string } }>("/api/class-models/:id", async (request) => {
    return classModelService.getWithDeviations(request.params.id);
  });

  app.post<{ Params: { id: string } }>(
    "/api/class-models/:id/clone",
    async (request, reply) => {
      const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
      const model = classModelService.clone(request.params.id, request.body, attribution);
      reply.code(201);
      return model;
    },
  );

  app.put<{ Params: { id: string } }>("/api/class-models/:id", async (request) => {
    const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
    return classModelService.update(request.params.id, request.body, attribution);
  });

  app.delete<{ Params: { id: string } }>("/api/class-models/:id", async (request, reply) => {
    const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
    classModelService.delete(request.params.id, attribution);
    reply.code(204);
  });
}
