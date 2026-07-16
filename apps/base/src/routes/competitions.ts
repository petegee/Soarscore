import type { FastifyInstance } from "fastify";
import type { Attribution } from "@soarscore/shared";
import type { CompetitionService } from "../competitions/service.js";

function attributionFromHeaders(headers: Record<string, unknown>): Attribution {
  const actorName = typeof headers["x-actor-name"] === "string" ? headers["x-actor-name"] : "unknown";
  const originClient =
    typeof headers["x-client-id"] === "string" ? headers["x-client-id"] : "unknown-client";
  return { actorName, originClient, authority: "organiser" };
}

// Start Proceedings is a Contest-Director action (STORY-001-025): recorded with
// contest-director authority — recorded, not enforced (D1). Mirrors the draw
// route's cdAttributionFromHeaders idiom; deliberately not folded into the
// app-wide organiser default above.
function cdAttributionFromHeaders(headers: Record<string, unknown>): Attribution {
  const actorName = typeof headers["x-actor-name"] === "string" ? headers["x-actor-name"] : "unknown";
  const originClient =
    typeof headers["x-client-id"] === "string" ? headers["x-client-id"] : "unknown-client";
  return { actorName, originClient, authority: "contest-director" };
}

// Round Advance is an Announcer/Timekeeper action (STORY-001-043): recorded with
// announcer-timekeeper authority — recorded, not enforced (D1). Mirrors the
// cdAttributionFromHeaders idiom; a fresh authority string introduced by this story.
function atAttributionFromHeaders(headers: Record<string, unknown>): Attribution {
  const actorName = typeof headers["x-actor-name"] === "string" ? headers["x-actor-name"] : "unknown";
  const originClient =
    typeof headers["x-client-id"] === "string" ? headers["x-client-id"] : "unknown-client";
  return { actorName, originClient, authority: "announcer-timekeeper" };
}

export function registerCompetitionRoutes(
  app: FastifyInstance,
  competitionService: CompetitionService,
): void {
  app.get("/api/competitions", async () => competitionService.list());

  app.get<{ Params: { id: string } }>("/api/competitions/:id", async (request) => {
    return competitionService.get(request.params.id);
  });

  // STORY-001-024: the single authoritative lifecycle state + admissible
  // actions. A Deleted competition returns 200 with state "Deleted"; only a
  // never-existed id 404s.
  app.get<{ Params: { id: string } }>("/api/competitions/:id/lifecycle", async (request) => {
    return competitionService.getLifecycleState(request.params.id);
  });

  // STORY-001-025: the single deliberate CD action opening a competition for
  // running. 200 with the new LifecycleStateResponse on success; 409
  // COMPETITION_NOT_READY (with details.outstandingItems) when not ready; 409
  // TRANSITION_NOT_ALLOWED when not startable; 404 for a never-existed id.
  app.post<{ Params: { id: string } }>("/api/competitions/:id/start", async (request) => {
    const attribution = cdAttributionFromHeaders(request.headers as Record<string, unknown>);
    return competitionService.start(request.params.id, attribution);
  });

  // STORY-001-026: the single deliberate CD action sealing a running competition
  // into the terminal Locked state, resolving OfficialResults vs NoContest. 200
  // with the Locked LifecycleStateResponse on success; 409 TRANSITION_NOT_ALLOWED
  // when not Running/BetweenGroups (incl. double-lock); 404 for a never-existed id.
  app.post<{ Params: { id: string } }>("/api/competitions/:id/lock", async (request) => {
    const attribution = cdAttributionFromHeaders(request.headers as Record<string, unknown>);
    return competitionService.lock(request.params.id, attribution);
  });

  // STORY-001-043: the single deliberate Announcer/Timekeeper action advancing
  // the contest past the previous round's completeness gate. 200 with the new
  // LifecycleStateResponse on success; 409 COMPETITION_NOT_READY (with
  // details.outstandingItems) when the previous round is incomplete; 409
  // TRANSITION_NOT_ALLOWED when not Running/BetweenGroups; 404 for a
  // never-existed id.
  app.post<{ Params: { id: string } }>("/api/competitions/:id/round-advance", async (request) => {
    const attribution = atAttributionFromHeaders(request.headers as Record<string, unknown>);
    return competitionService.advanceRound(request.params.id, attribution);
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
