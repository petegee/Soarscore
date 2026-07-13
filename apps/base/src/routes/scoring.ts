import type { FastifyInstance } from "fastify";
import type { Attribution } from "@soarscore/shared";
import type { ScoringService } from "../scoring/service.js";

// Every route here is an Organiser/system action (this story's capture entry
// point is manual entry after the pen-and-paper failure policy, D6 — not the
// Scorer device-capture flow, a separate later story) — never CD-attributed.
function attributionFromHeaders(headers: Record<string, unknown>): Attribution {
  const actorName = typeof headers["x-actor-name"] === "string" ? headers["x-actor-name"] : "unknown";
  const originClient =
    typeof headers["x-client-id"] === "string" ? headers["x-client-id"] : "unknown-client";
  return { actorName, originClient, authority: "organiser" };
}

interface CompetitionParams {
  competitionId: string;
}

interface GroupScoreParams extends CompetitionParams {
  roundNumber: string;
  taskId: string;
  groupFlyingOrder: string;
}

export function registerScoringRoutes(app: FastifyInstance, scoringService: ScoringService): void {
  // Record one raw result for one pilot's seat in one round/task (AC5's
  // foundation) — the smallest possible write, denormalising pilotId at
  // capture time.
  app.post<{ Params: CompetitionParams }>(
    "/api/competitions/:competitionId/scoring/results",
    async (request) => {
      const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
      return scoringService.captureResult(request.params.competitionId, request.body, attribution);
    },
  );

  // The pure, on-demand recompute (AC5–AC7): which-score-counts, lone-pilot
  // dummy insertion, and F3B's class-fixed annulment. Never a stored fact —
  // always current, always replayable (D4).
  app.get<{ Params: GroupScoreParams }>(
    "/api/competitions/:competitionId/scoring/groups/:roundNumber/:taskId/:groupFlyingOrder",
    async (request) => {
      const { competitionId, roundNumber, taskId, groupFlyingOrder } = request.params;
      return scoringService.getGroupScore(
        competitionId,
        Number(roundNumber),
        taskId,
        Number(groupFlyingOrder),
      );
    },
  );
}
