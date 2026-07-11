import type { FastifyInstance } from "fastify";
import type { Attribution } from "@soarscore/shared";
import type { TemplateService } from "../templates/service.js";

function attributionFromHeaders(headers: Record<string, unknown>): Attribution {
  const actorName = typeof headers["x-actor-name"] === "string" ? headers["x-actor-name"] : "unknown";
  const originClient =
    typeof headers["x-client-id"] === "string" ? headers["x-client-id"] : "unknown-client";
  return { actorName, originClient, authority: "organiser" };
}

export function registerTemplateRoutes(
  app: FastifyInstance,
  templateService: TemplateService,
): void {
  app.get("/api/templates", async () => templateService.list());

  app.get<{ Params: { id: string } }>("/api/templates/:id", async (request) => {
    return templateService.get(request.params.id);
  });

  app.post("/api/templates", async (request, reply) => {
    const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
    const template = templateService.create(request.body, attribution);
    reply.code(201);
    return template;
  });

  app.put<{ Params: { id: string } }>("/api/templates/:id", async (request) => {
    const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
    return templateService.update(request.params.id, request.body, attribution);
  });

  app.delete<{ Params: { id: string } }>("/api/templates/:id", async (request, reply) => {
    const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
    templateService.delete(request.params.id, attribution);
    reply.code(204);
  });

  // Capture verb (AC1) lives on the competition URL because it starts from a
  // competition; registered here because the template service owns it.
  app.post<{ Params: { id: string } }>(
    "/api/competitions/:id/save-as-template",
    async (request, reply) => {
      const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
      const template = templateService.createFromCompetition(
        request.params.id,
        request.body,
        attribution,
      );
      reply.code(201);
      return template;
    },
  );

  app.post<{ Params: { id: string } }>("/api/templates/:id/seed", async (request, reply) => {
    const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
    const competition = templateService.seedCompetition(
      request.params.id,
      request.body,
      attribution,
    );
    reply.code(201);
    return competition;
  });
}
