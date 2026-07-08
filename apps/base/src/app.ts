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
import { registerPilotRoutes } from "./routes/pilots.js";
import { registerHealthRoute } from "./routes/health.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface AppOptions {
  dbPath: string;
  serveStatic?: boolean;
  // Test seam: STORY-001-005 will supply a real checker; production always
  // uses NoRostersYetChecker until rosters exist.
  referenceChecker?: RosterReferenceChecker;
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

  registerHealthRoute(app);
  registerPilotRoutes(app, pilotService);

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
