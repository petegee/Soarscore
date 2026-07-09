import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import type { ErrorResponse } from "@soarscore/shared";
import { EventStore } from "./eventstore/event-store.js";
import { PilotLibraryProjection } from "./pilots/projection.js";
import { NoRostersYetChecker, type RosterReferenceChecker } from "./pilots/roster-reference-checker.js";
import { PilotService } from "./pilots/service.js";
import { DomainError, NotFoundError, ReferencedPilotError, ValidationError } from "./pilots/errors.js";
import { LandingTableProjection } from "./landing-tables/projection.js";
import {
  NoTaskConfigYetChecker,
  type LandingTableReferenceChecker,
} from "./landing-tables/table-reference-checker.js";
import { LandingTableService } from "./landing-tables/service.js";
import { LandingTableNotFoundError, ReferencedLandingTableError } from "./landing-tables/errors.js";
import { CompetitionProjection } from "./competitions/projection.js";
import {
  AlwaysUnlockedProvider,
  NoScoresYetProvider,
  type CapturedScoresProvider,
  type LockStateProvider,
} from "./competitions/state-providers.js";
import { CompetitionService } from "./competitions/service.js";
import {
  CompetitionDeleteNeedsConfirmationError,
  CompetitionLockedError,
  CompetitionNotFoundError,
} from "./competitions/errors.js";
import { registerPilotRoutes } from "./routes/pilots.js";
import { registerLandingTableRoutes } from "./routes/landing-tables.js";
import { registerCompetitionRoutes } from "./routes/competitions.js";
import { registerHealthRoute } from "./routes/health.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface AppOptions {
  dbPath: string;
  serveStatic?: boolean;
  // Test seam: STORY-001-005 will supply a real checker; production always
  // uses NoRostersYetChecker until rosters exist.
  referenceChecker?: RosterReferenceChecker;
  // Test seam: STORY-001-008 will supply a real checker; production always
  // uses NoTaskConfigYetChecker until task scoring config exists.
  landingTableReferenceChecker?: LandingTableReferenceChecker;
  // Test seam: the CD-lock story will supply a real provider; production always
  // uses AlwaysUnlockedProvider until lock/unlock exists.
  lockStateProvider?: LockStateProvider;
  // Test seam: the scoring story will supply a real provider; production always
  // uses NoScoresYetProvider until captured scores exist.
  capturedScoresProvider?: CapturedScoresProvider;
}

export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: true });

  const eventStore = new EventStore(options.dbPath, (record) => {
    app.log.info(
      { seq: record.seq, type: record.type, scope: record.scope, actor: record.attribution.actorName },
      "event appended",
    );
  });
  const projection = new PilotLibraryProjection();
  projection.rebuild(eventStore.readAll());
  const pilotService = new PilotService(
    eventStore,
    projection,
    options.referenceChecker ?? new NoRostersYetChecker(),
  );

  const landingTableProjection = new LandingTableProjection();
  landingTableProjection.rebuild(eventStore.readAll());
  const landingTableService = new LandingTableService(
    eventStore,
    landingTableProjection,
    options.landingTableReferenceChecker ?? new NoTaskConfigYetChecker(),
  );

  const competitionProjection = new CompetitionProjection();
  competitionProjection.rebuild(eventStore.readAll());
  const competitionService = new CompetitionService(
    eventStore,
    competitionProjection,
    options.lockStateProvider ?? new AlwaysUnlockedProvider(),
    options.capturedScoresProvider ?? new NoScoresYetProvider(),
  );

  registerHealthRoute(app);
  registerPilotRoutes(app, pilotService);
  registerLandingTableRoutes(app, landingTableService);
  registerCompetitionRoutes(app, competitionService);

  if (options.serveStatic) {
    app.register(fastifyStatic, {
      root: path.resolve(__dirname, "../../companion/dist"),
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.raw.url?.startsWith("/api")) {
        reply.code(404).send({ code: "NOT_FOUND", message: "Not found" } satisfies ErrorResponse);
        return;
      }
      reply.sendFile("index.html");
    });
  }

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ValidationError) {
      reply.code(400).send({
        code: error.code,
        message: error.message,
        details: error.details,
      } satisfies ErrorResponse);
      return;
    }
    if (error instanceof NotFoundError) {
      reply.code(404).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof ReferencedPilotError) {
      reply.code(409).send({
        code: error.code,
        message: error.message,
        details: { competitions: error.competitions },
      } satisfies ErrorResponse);
      return;
    }
    if (error instanceof LandingTableNotFoundError) {
      reply.code(404).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof ReferencedLandingTableError) {
      reply.code(409).send({
        code: error.code,
        message: error.message,
        details: { competitions: error.competitions },
      } satisfies ErrorResponse);
      return;
    }
    if (error instanceof CompetitionNotFoundError) {
      reply.code(404).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof CompetitionLockedError) {
      reply.code(409).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof CompetitionDeleteNeedsConfirmationError) {
      reply.code(409).send({
        code: error.code,
        message: error.message,
        details: { reason: error.reason },
      } satisfies ErrorResponse);
      return;
    }
    if (error instanceof DomainError) {
      reply.code(500).send({ code: "INTERNAL", message: "Internal error" } satisfies ErrorResponse);
      return;
    }

    app.log.error(error);
    reply.code(500).send({ code: "INTERNAL", message: "Internal error" } satisfies ErrorResponse);
  });

  app.addHook("onClose", async () => {
    eventStore.close();
  });

  return app;
}
