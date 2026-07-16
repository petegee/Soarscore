// STORY-001-032: run-control authority routes. Eight Fastify routes, each
// parsing the request body with a dedicated Zod schema, deriving Attribution
// via cdAttributionFromHeaders, and delegating to GroupRunControlService.
// STORY-001-044: group start control and manual run tasks (AC1–5, D3, D8, D10).
// Adds one write route (start group) and one read route (prep-gate hold view).

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Attribution } from "@soarscore/shared";
import type { GroupRunControlService } from "../group-run/service.js";
import type { GroupStartService } from "../group-run/start-service.js";
import type { PrepGateHoldProvider } from "../group-run/prep-gate-view.js";
import { ValidationError } from "../group-run/errors.js";

// Reuse the CD-attribution helper from draw routes.
function cdAttributionFromHeaders(headers: Record<string, unknown>): Attribution {
  const actorName = typeof headers["x-actor-name"] === "string" ? headers["x-actor-name"] : "unknown";
  const originClient =
    typeof headers["x-client-id"] === "string" ? headers["x-client-id"] : "unknown-client";
  return { actorName, originClient, authority: "contest-director" };
}

// STORY-001-044 uses default (non-CD) Announcer/Timekeeper attribution for the
// group start action (Decision #4). Reuse the organiser attribution pattern
// exactly as draw routes do for spec/generate.
function attributionFromHeaders(headers: Record<string, unknown>): Attribution {
  const actorName = typeof headers["x-actor-name"] === "string" ? headers["x-actor-name"] : "unknown";
  const originClient =
    typeof headers["x-client-id"] === "string" ? headers["x-client-id"] : "unknown-client";
  return { actorName, originClient, authority: "organiser" };
}

// Structural validation: parse with Zod and throw ValidationError on failure,
// matching the draw routes' parseDecision idiom.
function parseOrThrow<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    throw new ValidationError("Validation failed", result.error.flatten());
  }
  return result.data;
}

// Request schemas for each action.
const prepPauseRequestSchema = z.object({
  roundNumber: z.number().int().positive(),
  groupFlyingOrder: z.number().int().positive(),
});

const prepResumeRequestSchema = z.object({
  roundNumber: z.number().int().positive(),
  groupFlyingOrder: z.number().int().positive(),
});

const prepFastForwardRequestSchema = z.object({
  roundNumber: z.number().int().positive(),
  groupFlyingOrder: z.number().int().positive(),
});

const prepAddTimeRequestSchema = z.object({
  roundNumber: z.number().int().positive(),
  groupFlyingOrder: z.number().int().positive(),
});

const abortRequestSchema = z.object({
  roundNumber: z.number().int().positive(),
  groupFlyingOrder: z.number().int().positive(),
  reason: z.string().min(1, "A reason is required").max(500),
});

const gateReleaseRequestSchema = z.object({
  roundNumber: z.number().int().positive(),
  groupFlyingOrder: z.number().int().positive(),
  rosterEntryId: z.string().min(1, "A roster entry id is required"),
  deviceId: z.string().min(1, "A device id is required"),
});

const roundAdvanceOverrideRequestSchema = z.object({
  roundNumber: z.number().int().positive(),
});

interface CompetitionParams {
  competitionId: string;
}

type PrepPauseRequest = z.infer<typeof prepPauseRequestSchema>;
type PrepResumeRequest = z.infer<typeof prepResumeRequestSchema>;
type PrepFastForwardRequest = z.infer<typeof prepFastForwardRequestSchema>;
type PrepAddTimeRequest = z.infer<typeof prepAddTimeRequestSchema>;
type AbortRequest = z.infer<typeof abortRequestSchema>;
type GateReleaseRequest = z.infer<typeof gateReleaseRequestSchema>;
type RoundAdvanceOverrideRequest = z.infer<typeof roundAdvanceOverrideRequestSchema>;

export function registerGroupRunRoutes(
  app: FastifyInstance,
  groupRunControlService: GroupRunControlService,
): void {
  // Pause preparation.
  app.post<{ Params: CompetitionParams; Body: PrepPauseRequest }>(
    "/api/competitions/:competitionId/group-run/prep/pause",
    async (request) => {
      const attribution = cdAttributionFromHeaders(request.headers as Record<string, unknown>);
      const body = parseOrThrow(prepPauseRequestSchema, request.body);
      return groupRunControlService.pausePrep(
        request.params.competitionId,
        body.roundNumber,
        body.groupFlyingOrder,
        attribution,
      );
    },
  );

  // Resume preparation.
  app.post<{ Params: CompetitionParams; Body: PrepResumeRequest }>(
    "/api/competitions/:competitionId/group-run/prep/resume",
    async (request) => {
      const attribution = cdAttributionFromHeaders(request.headers as Record<string, unknown>);
      const body = parseOrThrow(prepResumeRequestSchema, request.body);
      return groupRunControlService.resumePrep(
        request.params.competitionId,
        body.roundNumber,
        body.groupFlyingOrder,
        attribution,
      );
    },
  );

  // Fast-forward preparation (remove 60 seconds).
  app.post<{ Params: CompetitionParams; Body: PrepFastForwardRequest }>(
    "/api/competitions/:competitionId/group-run/prep/fast-forward",
    async (request) => {
      const attribution = cdAttributionFromHeaders(request.headers as Record<string, unknown>);
      const body = parseOrThrow(prepFastForwardRequestSchema, request.body);
      return groupRunControlService.fastForwardPrep(
        request.params.competitionId,
        body.roundNumber,
        body.groupFlyingOrder,
        attribution,
      );
    },
  );

  // Add preparation time (add 60 seconds).
  app.post<{ Params: CompetitionParams; Body: PrepAddTimeRequest }>(
    "/api/competitions/:competitionId/group-run/prep/add-time",
    async (request) => {
      const attribution = cdAttributionFromHeaders(request.headers as Record<string, unknown>);
      const body = parseOrThrow(prepAddTimeRequestSchema, request.body);
      return groupRunControlService.addPrepTime(
        request.params.competitionId,
        body.roundNumber,
        body.groupFlyingOrder,
        attribution,
      );
    },
  );

  // Abort the group (restart + annul captured results).
  app.post<{ Params: CompetitionParams; Body: AbortRequest }>(
    "/api/competitions/:competitionId/group-run/abort",
    async (request) => {
      const attribution = cdAttributionFromHeaders(request.headers as Record<string, unknown>);
      const body = parseOrThrow(abortRequestSchema, request.body);
      return groupRunControlService.abort(
        request.params.competitionId,
        body.roundNumber,
        body.groupFlyingOrder,
        body.reason,
        attribution,
      );
    },
  );

  // Release prep-gate device (offline).
  app.post<{ Params: CompetitionParams; Body: GateReleaseRequest }>(
    "/api/competitions/:competitionId/group-run/gate/release-device-offline",
    async (request) => {
      const attribution = cdAttributionFromHeaders(request.headers as Record<string, unknown>);
      const body = parseOrThrow(gateReleaseRequestSchema, request.body);
      return groupRunControlService.releaseGateDeviceOffline(
        request.params.competitionId,
        body.roundNumber,
        body.groupFlyingOrder,
        body.rosterEntryId,
        body.deviceId,
        attribution,
      );
    },
  );

  // Release prep-gate device (pilot unconfirmed).
  app.post<{ Params: CompetitionParams; Body: GateReleaseRequest }>(
    "/api/competitions/:competitionId/group-run/gate/release-pilot-unconfirmed",
    async (request) => {
      const attribution = cdAttributionFromHeaders(request.headers as Record<string, unknown>);
      const body = parseOrThrow(gateReleaseRequestSchema, request.body);
      return groupRunControlService.releaseGatePilotUnconfirmed(
        request.params.competitionId,
        body.roundNumber,
        body.groupFlyingOrder,
        body.rosterEntryId,
        body.deviceId,
        attribution,
      );
    },
  );

  // Override round advance (CD decision to proceed despite outstanding items).
  app.post<{ Params: CompetitionParams; Body: RoundAdvanceOverrideRequest }>(
    "/api/competitions/:competitionId/round-advance/override",
    async (request) => {
      const attribution = cdAttributionFromHeaders(request.headers as Record<string, unknown>);
      const body = parseOrThrow(roundAdvanceOverrideRequestSchema, request.body);
      return groupRunControlService.overrideRoundAdvance(
        request.params.competitionId,
        body.roundNumber,
        attribution,
      );
    },
  );
}

// STORY-001-044: group start control and manual run tasks. This story's one
// write route (start group) and read route (prep-gate hold view). Wired
// alongside STORY-001-032's routes above and STORY-001-040's read route below.
export function registerGroupStartRoutes(
  app: FastifyInstance,
  groupStartService: GroupStartService,
  prepGateHoldProvider: PrepGateHoldProvider,
): void {
  interface CompetitionParams {
    competitionId: string;
  }

  // POST /api/competitions/:competitionId/group-run/start
  // Start the next unopened group in flying order (AC1–3). Operator-attributed
  // with default Announcer/Timekeeper authority (Decision #4). No request body
  // (Decision #3); the next group is always system-derived. Returns
  // GroupStartResponse on success, 409 NO_GROUP_READY_TO_START if all groups
  // in the current round have opened, or 409 TRANSITION_NOT_ALLOWED if not in
  // Running/BetweenGroups.
  app.post<{ Params: CompetitionParams }>(
    "/api/competitions/:competitionId/group-run/start",
    async (request) => {
      const attribution = attributionFromHeaders(request.headers as Record<string, unknown>);
      return groupStartService.startGroup(request.params.competitionId, attribution);
    },
  );

  // GET /api/competitions/:competitionId/group-run/prep-gate
  // Read-only prep-gate hold state. Shows whether a gate is held and which
  // devices are blocking (AC5). Always returns 200 with PrepGateHoldView —
  // {held: false, outstanding: []} is a valid, meaningful response when no
  // group is open or no gate is held. No write capability exposed.
  app.get<{ Params: CompetitionParams }>(
    "/api/competitions/:competitionId/group-run/prep-gate",
    async (request) => {
      return prepGateHoldProvider.currentHold(request.params.competitionId);
    },
  );
}

// STORY-001-040: group-run read routes. Expose the current GroupRunPhase for
// board/audio/device polling (the transport those three consumer stories build on).
export function registerGroupRunReadRoutes(
  app: FastifyInstance,
  groupRunProjection: any, // Type would be GroupRunProjection, avoid import to prevent cycles
): void {
  interface GroupRunParams {
    competitionId: string;
    roundNumber: string;
    groupFlyingOrder: string;
  }

  // GET /api/competitions/:competitionId/group-run/:roundNumber/:groupFlyingOrder/current
  // Returns the current GroupRunPhase (always one of the three fixed phase values) on
  // success, or 404 if that key has no currently-open run.
  app.get<{ Params: GroupRunParams }>(
    "/api/competitions/:competitionId/group-run/:roundNumber/:groupFlyingOrder/current",
    async (request) => {
      const competitionId = request.params.competitionId;
      const roundNumber = parseInt(request.params.roundNumber, 10);
      const groupFlyingOrder = parseInt(request.params.groupFlyingOrder, 10);

      if (isNaN(roundNumber) || isNaN(groupFlyingOrder)) {
        throw new Error("Invalid round number or group flying order");
      }

      const { GroupRunNotFoundError } = await import("../group-run/errors.js");
      const phase = groupRunProjection.currentPhase(competitionId, roundNumber, groupFlyingOrder);
      if (!phase) {
        throw new GroupRunNotFoundError(
          `No active run for competition=${competitionId}, round=${roundNumber}, group=${groupFlyingOrder}`,
        );
      }

      return phase;
    },
  );
}
