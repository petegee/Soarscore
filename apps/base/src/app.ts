import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import type { ErrorResponse } from "@soarscore/shared";
import { EventStore } from "./eventstore/event-store.js";
import { PilotLibraryProjection } from "./pilots/projection.js";
import type { RosterReferenceChecker } from "./pilots/roster-reference-checker.js";
import { PilotService } from "./pilots/service.js";
import { seedPreviewPilots } from "./pilots/seed-preview-pilots.js";
import { DomainError, NotFoundError, ReferencedPilotError, ValidationError } from "./pilots/errors.js";
import { ClassModelProjection } from "./class-models/projection.js";
import { ClassModelService } from "./class-models/service.js";
import { ProjectionClassModelReferenceChecker } from "./class-models/class-model-reference-checker.js";
import {
  ClassModelNotFoundError,
  ReferencedClassModelError,
  StockModelReadonlyError,
} from "./class-models/errors.js";
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
  CompetitionClassLockedError,
  CompetitionLockedError,
  CompetitionNotFoundError,
} from "./competitions/errors.js";
import { TemplateProjection } from "./templates/projection.js";
import { TemplateService } from "./templates/service.js";
import { TemplateNotFoundError } from "./templates/errors.js";
import { RosterProjection } from "./roster/projection.js";
import {
  NoEntryScoresYetProvider,
  NothingRetiredProvider,
  type DrawStateProvider,
  type EntryScoresProvider,
  type RetirementStateProvider,
} from "./roster/state-providers.js";
import { RosterService } from "./roster/service.js";
import { ProjectionRosterReferenceChecker } from "./roster/roster-reference-checker.js";
import {
  DuplicateRosterEntryError,
  RosterEntryHasFlownError,
  RosterEntryNotFoundError,
  RosterEntryRetiredError,
  RosterRemoveRequiresReplacementError,
  RosterReplaceNeedsConfirmationError,
} from "./roster/errors.js";
import { CompetitionTaskConfigProjection } from "./task-config/projection.js";
import { CompetitionTaskConfigService } from "./task-config/service.js";
import {
  CompetitionTaskConfigNotFoundError,
  NlhNotApplicableError,
  PerRoundOverrideNotAllowedError,
  TaskNotFoundError,
} from "./task-config/errors.js";
import { registerPilotRoutes } from "./routes/pilots.js";
import { registerRosterRoutes } from "./routes/roster.js";
import { registerClassModelRoutes } from "./routes/class-models.js";
import { registerCompetitionRoutes } from "./routes/competitions.js";
import { registerTemplateRoutes } from "./routes/templates.js";
import { registerTaskConfigRoutes } from "./routes/task-config.js";
import { DrawProjection } from "./draw/projection.js";
import { DrawService } from "./draw/service.js";
import {
  DrawCandidateNotFoundError,
  DrawCandidateSupersededError,
  DrawGenerationFailedError,
  DrawGroupSizeWarningUnacknowledgedError,
  DrawSpecNotFoundError,
  GroupSizeOutOfBoundsError,
} from "./draw/errors.js";
import { ProjectionDrawStateProvider } from "./draw/draw-state-provider.js";
import { registerDrawRoutes } from "./routes/draw.js";
import { registerHealthRoute } from "./routes/health.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface AppOptions {
  dbPath: string;
  serveStatic?: boolean;
  // Override seam (tests): production now defaults to the roster-backed
  // ProjectionRosterReferenceChecker (STORY-001-005 / RD1).
  referenceChecker?: RosterReferenceChecker;
  // Test seam: the CD-lock story will supply a real provider; production always
  // uses AlwaysUnlockedProvider until lock/unlock exists.
  lockStateProvider?: LockStateProvider;
  // Test seam: the scoring story will supply a real provider; production always
  // uses NoScoresYetProvider until captured scores exist.
  capturedScoresProvider?: CapturedScoresProvider;
  // Override seam (tests can still inject NoAcceptedDrawProvider): production
  // now defaults to the acceptance-backed ProjectionDrawStateProvider
  // (STORY-001-017), which activates the STORY-001-005 remove/replace gates
  // once a draw is accepted.
  drawStateProvider?: DrawStateProvider;
  // Test seam: Area 5.5 will supply a real provider; production always uses
  // NothingRetiredProvider until CD retirement exists.
  retirementStateProvider?: RetirementStateProvider;
  // Test seam: the scoring story will supply a real provider; production
  // always uses NoEntryScoresYetProvider until captured scores exist.
  entryScoresProvider?: EntryScoresProvider;
}

export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: true });

  const eventStore = new EventStore(options.dbPath, (record) => {
    app.log.info(
      { seq: record.seq, type: record.type, scope: record.scope, actor: record.attribution.actorName },
      "event appended",
    );
  });
  // Projections first: the pilot service's default reference checker answers
  // from roster + competition state (RD1).
  const projection = new PilotLibraryProjection();
  projection.rebuild(eventStore.readAll());
  const classModelProjection = new ClassModelProjection();
  classModelProjection.rebuild(eventStore.readAll());
  const competitionProjection = new CompetitionProjection();
  competitionProjection.rebuild(eventStore.readAll());
  const rosterProjection = new RosterProjection();
  rosterProjection.rebuild(eventStore.readAll());
  const templateProjection = new TemplateProjection();
  templateProjection.rebuild(eventStore.readAll());
  // Task-config overlay projection: rebuilt from the log on init (audit/replay
  // parity) and filed under scope = competitionId (STORY-001-008).
  const taskConfigProjection = new CompetitionTaskConfigProjection();
  taskConfigProjection.rebuild(eventStore.readAll());
  // Draw projection: a pure loader of the materialised outcome (STORY-001-009 /
  // D4) — rebuilt from the log on init, filed under scope = competitionId.
  const drawProjection = new DrawProjection();
  drawProjection.rebuild(eventStore.readAll());

  const pilotService = new PilotService(
    eventStore,
    projection,
    options.referenceChecker ??
      new ProjectionRosterReferenceChecker(rosterProjection, competitionProjection),
  );

  // Preview-only convenience: gives a freshly-deployed preview environment
  // (ephemeral SQLite, no persistent disk — see Dockerfile) some pilots to
  // demo against without manual entry. Never runs on services where the flag
  // is unset (production), and is a no-op once any pilot already exists.
  if (process.env.SOARSCORE_SEED_PREVIEW_PILOTS === "true") {
    seedPreviewPilots(pilotService);
  }

  // Class models: an in-use model cannot be deleted (AC9), answered from real
  // competition state. Seed the six stock models once the projection has
  // rebuilt from the log — idempotent, so restarts add no duplicates (AC1).
  const classModelService = new ClassModelService(
    eventStore,
    classModelProjection,
    new ProjectionClassModelReferenceChecker(competitionProjection),
  );
  classModelService.seedStockModels();

  const competitionService = new CompetitionService(
    eventStore,
    competitionProjection,
    classModelProjection,
    options.lockStateProvider ?? new AlwaysUnlockedProvider(),
    options.capturedScoresProvider ?? new NoScoresYetProvider(),
  );

  // After CompetitionService: the seed path delegates competition creation to
  // it (single writer of competition state).
  const templateService = new TemplateService(
    eventStore,
    templateProjection,
    competitionProjection,
    classModelProjection,
    competitionService,
  );

  const rosterService = new RosterService(
    eventStore,
    rosterProjection,
    competitionProjection,
    projection,
    // Real provider (STORY-001-017): answers from the draw projection's
    // *accepted* state — never mere candidate existence. Lives on the draw
    // side and is injected here so the roster module never imports the draw
    // module (no cycle). NoAcceptedDrawProvider remains the tests' seam.
    options.drawStateProvider ?? new ProjectionDrawStateProvider(drawProjection),
    options.retirementStateProvider ?? new NothingRetiredProvider(),
    options.entryScoresProvider ?? new NoEntryScoresYetProvider(),
  );

  // Task-config reads defaults from the class model and overlays per-event
  // target-time overrides + the F5K NLH value (STORY-001-008).
  const taskConfigService = new CompetitionTaskConfigService(
    eventStore,
    taskConfigProjection,
    competitionProjection,
    classModelProjection,
  );

  // Draw: specify a fair-draw policy, generate the fairest candidate over N
  // rounds, surface fairness evidence (STORY-001-009), and record the CD's
  // accept/cancel decision (STORY-001-017). Generate ≠ accept; the
  // drawStateProvider default is now the real ProjectionDrawStateProvider
  // (017 supersedes 009 Decision #3's NoAcceptedDrawProvider default).
  const drawService = new DrawService(
    eventStore,
    drawProjection,
    competitionProjection,
    classModelProjection,
    rosterProjection,
  );

  registerHealthRoute(app);
  registerPilotRoutes(app, pilotService);
  registerClassModelRoutes(app, classModelService);
  registerCompetitionRoutes(app, competitionService);
  registerTemplateRoutes(app, templateService);
  registerRosterRoutes(app, rosterService);
  registerTaskConfigRoutes(app, taskConfigService);
  registerDrawRoutes(app, drawService);

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
    if (error instanceof ClassModelNotFoundError) {
      reply.code(404).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof StockModelReadonlyError) {
      reply.code(409).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof ReferencedClassModelError) {
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
    if (error instanceof CompetitionClassLockedError) {
      reply.code(409).send({
        code: error.code,
        message: error.message,
        details: { reason: error.reason },
      } satisfies ErrorResponse);
      return;
    }
    if (error instanceof TemplateNotFoundError) {
      reply.code(404).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof RosterEntryNotFoundError) {
      reply.code(404).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof DuplicateRosterEntryError) {
      reply.code(409).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof RosterEntryRetiredError) {
      reply.code(409).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof RosterRemoveRequiresReplacementError) {
      reply.code(409).send({
        code: error.code,
        message: error.message,
        details: { reason: error.reason },
      } satisfies ErrorResponse);
      return;
    }
    if (error instanceof RosterReplaceNeedsConfirmationError) {
      reply.code(409).send({
        code: error.code,
        message: error.message,
        details: { reason: error.reason },
      } satisfies ErrorResponse);
      return;
    }
    if (error instanceof RosterEntryHasFlownError) {
      reply.code(409).send({
        code: error.code,
        message: error.message,
        details: { reason: error.reason },
      } satisfies ErrorResponse);
      return;
    }
    if (error instanceof CompetitionTaskConfigNotFoundError || error instanceof TaskNotFoundError) {
      reply.code(404).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (
      error instanceof PerRoundOverrideNotAllowedError ||
      error instanceof NlhNotApplicableError
    ) {
      reply.code(409).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof DrawSpecNotFoundError) {
      reply.code(404).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof GroupSizeOutOfBoundsError) {
      reply.code(409).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof DrawGenerationFailedError) {
      reply.code(422).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof DrawCandidateNotFoundError) {
      reply.code(409).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof DrawCandidateSupersededError) {
      reply.code(409).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof DrawGroupSizeWarningUnacknowledgedError) {
      reply.code(409).send({ code: error.code, message: error.message } satisfies ErrorResponse);
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
