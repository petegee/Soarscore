import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import type { ErrorResponse } from "@soarscore/shared";
import { EventStore, type EventRecord } from "./eventstore/event-store.js";
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
  NoScoresYetProvider,
  NothingOutstandingNoScoreProvider,
  NothingOutstandingReflightProvider,
  ProjectionFinalisationProgressProvider,
  ProjectionLockStateProvider,
  type CapturedScoresProvider,
  type FinalisationProgressProvider,
  type LockStateProvider,
  type NoScoreOutstandingProvider,
  type ReflightOutstandingProvider,
  type StartStateProvider,
} from "./competitions/state-providers.js";
import {
  ProjectionScoreCompletenessProvider,
  type ScoreCompletenessProvider,
} from "./scoring/completeness-provider.js";
import { CompetitionService } from "./competitions/service.js";
import {
  CompetitionDeleteNeedsConfirmationError,
  CompetitionClassLockedError,
  CompetitionLockedError,
  CompetitionNotFoundError,
  CompetitionNotReadyError,
} from "./competitions/errors.js";
import { TemplateProjection } from "./templates/projection.js";
import { TemplateService } from "./templates/service.js";
import { TemplateNotFoundError } from "./templates/errors.js";
import { RosterProjection } from "./roster/projection.js";
import {
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
  DrawNotAcceptedError,
  DrawSpecNotFoundError,
  GroupMoveClashError,
  GroupMoveTargetNotFoundError,
  GroupSizeOutOfBoundsError,
  GroupSplitInvalidError,
  ReflightEntitlementNotFoundError,
} from "./draw/errors.js";
import { ProjectionDrawStateProvider } from "./draw/draw-state-provider.js";
import { DrawServiceGroupCompositionProvider } from "./draw/group-composition-provider.js";
import { registerDrawRoutes } from "./routes/draw.js";
import { ScoringProjection } from "./scoring/projection.js";
import { ScoringService } from "./scoring/service.js";
import {
  AnnulmentOverridePendingError,
  CaptureTargetNotFoundError,
  LonePilotAlreadyResolvedError,
} from "./scoring/errors.js";
import { ProjectionEntryScoresProvider } from "./scoring/entry-scores-provider.js";
import { registerScoringRoutes } from "./routes/scoring.js";
import { registerGroupRunRoutes, registerGroupStartRoutes, registerGroupRunReadRoutes } from "./routes/group-run.js";
import { GroupStartService } from "./group-run/start-service.js";
import { GroupCompletionReactor } from "./group-run/completion-reactor.js";
import { PrepGateHoldViewService, StubGroupRunPhaseProvider } from "./group-run/prep-gate-view.js";
import { registerHealthRoute } from "./routes/health.js";
import { LifecycleProjection } from "./lifecycle/projection.js";
import { LifecycleGuard } from "./lifecycle/guard.js";
import { ProjectionStartStateProvider } from "./lifecycle/start-state-provider.js";
import { TransitionNotAllowedError } from "./lifecycle/errors.js";
import { GroupRunControlService } from "./group-run/service.js";
import { GroupRunProjection } from "./group-run/projection.js";
import { GroupRunScheduler } from "./group-run/scheduler.js";
import {
  ProjectionGroupRunPhaseProvider,
  TaskConfigDurationSource,
  UnconfiguredFieldAidSettingsProvider,
  TemporaryAllDurationShapedProvider,
} from "./group-run/state-providers.js";
import {
  GroupNotInPreparationError,
  PrepAtFloorError,
  PrepGateNotHeldError,
  GroupNotInWorkingTimeError,
  RoundAdvanceNotBlockedError,
  GroupNotFoundError,
  FieldAidSettingsNotConfiguredError,
  NoDurationShapedTaskConfiguredError,
  GroupRunNotFoundError,
  NoGroupReadyToStartError,
} from "./group-run/errors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface AppOptions {
  dbPath: string;
  serveStatic?: boolean;
  // Override seam (tests): production now defaults to the roster-backed
  // ProjectionRosterReferenceChecker (STORY-001-005 / RD1).
  referenceChecker?: RosterReferenceChecker;
  // Override seam (tests can inject AlwaysUnlockedProvider): production now
  // defaults to the lifecycle-backed ProjectionLockStateProvider (STORY-001-026),
  // which activates every freeze gate once a competition is genuinely Locked.
  lockStateProvider?: LockStateProvider;
  // Override seam (tests inject a fixed-count stub to drive each finalisation
  // outcome): production defaults to ProjectionFinalisationProgressProvider,
  // reading the completed-round count from the lifecycle projection (STORY-001-026).
  finalisationProgressProvider?: FinalisationProgressProvider;
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
  // Override seam (tests can inject NotStartedProvider): production defaults to
  // the lifecycle-backed ProjectionStartStateProvider (STORY-001-025), which
  // flips the task-config authority attribution once proceedings have started.
  startStateProvider?: StartStateProvider;
  // Override seam (STORY-001-043): production defaults to
  // NothingOutstandingNoScoreProvider (no-op stub); STORY-001-031 supplies the
  // real implementation reading genuinely-resolvable no-scores. Tests can inject
  // for isolation.
  noScoreOutstandingProvider?: NoScoreOutstandingProvider;
  // Override seam (STORY-001-043): production defaults to
  // NothingOutstandingReflightProvider (no-op stub); STORY-001-028 supplies the
  // real implementation reading approved-but-unflown re-flights. Tests can
  // inject for isolation.
  reflightOutstandingProvider?: ReflightOutstandingProvider;
  // Override seam (STORY-001-043): production defaults to
  // ProjectionScoreCompletenessProvider (reads ScoringProjection); tests can
  // inject AllSeatsCompleteProvider for skipping the gate, or a custom stub.
  scoreCompletenessProvider?: ScoreCompletenessProvider;
}

export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: true });

  // The lifecycle projection is cross-cutting (it folds competition.*, roster.*,
  // draw.* and lifecycle.* facts from several services), so — unlike the
  // per-service projections that each apply their own appends — it is fed the
  // whole append stream through this hook. Assigned once constructed below; the
  // hook only fires during append, which never happens before then.
  let onEvent: ((record: EventRecord) => void) | undefined;
  const eventStore = new EventStore(options.dbPath, (record) => {
    app.log.info(
      { seq: record.seq, type: record.type, scope: record.scope, actor: record.attribution.actorName },
      "event appended",
    );
    onEvent?.(record);
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
  // Scoring projection (STORY-001-011): captured results + lone-pilot/
  // annulment resolutions, also a pure loader, filed under
  // scope = competitionId. Constructed after DrawProjection — scoring reads
  // through the draw-composition interface, so draw must exist first
  // (matching the existing ordering discipline).
  const scoringProjection = new ScoringProjection();
  scoringProjection.rebuild(eventStore.readAll());
  // Group-run projection (STORY-001-040): phase-transition events for the
  // timer engine, also a pure loader, filed under scope = competitionId.
  // Constructed after scoring, before lifecycle (it has no dependencies,
  // but we construct it early for organizational clarity).
  const groupRunProjection = new GroupRunProjection();
  groupRunProjection.rebuild(eventStore.readAll());
  // Lifecycle projection (STORY-001-024): the single authoritative lifecycle
  // state per competition, derived from the log. Constructed after roster and
  // draw (it reads both, read-only, via injection — never their services, so no
  // cycle) and rebuilt from the log on init. Fed every subsequent append via the
  // event-store hook so getState stays current mid-session.
  const lifecycleProjection = new LifecycleProjection(rosterProjection, drawProjection);
  lifecycleProjection.rebuild(eventStore.readAll());
  onEvent = (record) => lifecycleProjection.apply(record);
  // The generic, class-agnostic transition-legality guard — a single stateless
  // interpreter of (state, action) shared by the delete path here and, in later
  // stories, by the owning suspend/resume/lock/round-advance services.
  const lifecycleGuard = new LifecycleGuard();
  // The class-agnostic past-Start predicate seam (STORY-001-025): production
  // reads real "started" membership from the lifecycle projection; tests may
  // inject NotStartedProvider. Config modules consult it, never importing the
  // lifecycle module (mirrors the draw/lock provider seams).
  const startStateProvider =
    options.startStateProvider ?? new ProjectionStartStateProvider(lifecycleProjection);

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

  // Group-composition provider (STORY-001-011): decouples scoring from draw
  // module. Created early here because CompetitionService (STORY-001-043) needs
  // it for the round-advance completeness scan. Wired in both services below.
  const groupCompositionProvider = new DrawServiceGroupCompositionProvider(drawProjection);

  const competitionService = new CompetitionService(
    eventStore,
    competitionProjection,
    classModelProjection,
    // Real provider (STORY-001-026): answers the locked predicate from the
    // authoritative lifecycle state, activating the update/delete/scoring freeze
    // gates once a competition is genuinely Locked. AlwaysUnlockedProvider
    // remains the tests' seam.
    options.lockStateProvider ?? new ProjectionLockStateProvider(lifecycleProjection),
    options.capturedScoresProvider ?? new NoScoresYetProvider(),
    lifecycleProjection,
    lifecycleGuard,
    // Real provider (STORY-001-026): reads the completed-round count folded from
    // competition.roundAdvanced (0 until the round story emits it). Tests inject a
    // fixed-count stub to drive each finalisation outcome.
    options.finalisationProgressProvider ??
      new ProjectionFinalisationProgressProvider(lifecycleProjection),
    // STORY-001-043: the no-score-outstanding consumption seam. Production
    // defaults to NothingOutstandingNoScoreProvider (no-op stub). STORY-001-031
    // swaps in the real implementation reading genuinely-resolvable no-scores.
    options.noScoreOutstandingProvider ?? new NothingOutstandingNoScoreProvider(),
    // STORY-001-043: the re-flight-outstanding consumption seam. Production
    // defaults to NothingOutstandingReflightProvider (no-op stub). STORY-001-028
    // swaps in the real implementation reading approved-but-unflown re-flights.
    options.reflightOutstandingProvider ?? new NothingOutstandingReflightProvider(),
    // STORY-001-043: the score-completeness seam. Production defaults to
    // ProjectionScoreCompletenessProvider (reads ScoringProjection). Tests can
    // inject AllSeatsCompleteProvider to skip the gate, or a custom stub.
    options.scoreCompletenessProvider ??
      new ProjectionScoreCompletenessProvider(scoringProjection),
    // STORY-001-043: the roster projection for resolving rosterEntryId →
    // pilotName in outstanding-item messages. Reusing the existing projection
    // already rebuilt from the event log.
    rosterProjection,
    // STORY-001-043: the group-composition provider for scanning effective
    // groups per round/task. Reusing the same provider instance wired into
    // ScoringService below for consistency.
    groupCompositionProvider,
    // STORY-001-043: the pilot library projection for resolving pilotId →
    // pilotName when building outstanding-item messages. Reusing the existing
    // projection already rebuilt from the event log.
    projection,
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
    // Real provider (STORY-001-011): answers from the scoring projection's
    // genuinely captured results — never mere draw membership. Lives on the
    // scoring side and is injected here so the roster module never imports
    // the scoring module (no cycle). NoEntryScoresYetProvider remains the
    // tests' seam.
    options.entryScoresProvider ?? new ProjectionEntryScoresProvider(scoringProjection),
  );

  // Task-config reads defaults from the class model and overlays per-event
  // target-time overrides + the F5K NLH value (STORY-001-008).
  const taskConfigService = new CompetitionTaskConfigService(
    eventStore,
    taskConfigProjection,
    competitionProjection,
    classModelProjection,
    startStateProvider,
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

  // Scoring (STORY-001-011): capture one raw result per pilot per round/task,
  // and recompute an official group score on demand (which-score-counts,
  // lone-pilot dummy insertion, F3B annulment). Depends on the draw module
  // only through the GroupCompositionProvider interface it owns — the
  // concrete draw-side implementation is wired in here, so neither module
  // imports the other (no cycle, Safeguard 9).
  // Note: groupCompositionProvider was created earlier for CompetitionService.
  const scoringService = new ScoringService(
    eventStore,
    scoringProjection,
    classModelProjection,
    competitionProjection,
    groupCompositionProvider,
    rosterProjection,
  );

  // Group-run scheduler (STORY-001-040): the phase-transition engine that
  // drives duration-shaped groups through Preparation → WorkingTime → Landing.
  // STORY-001-044 triggers it via onGroupStarted when it appends group.opened.
  const durationSource = new TaskConfigDurationSource(
    taskConfigService,
    new UnconfiguredFieldAidSettingsProvider(),
  );
  const taskShapeProvider = new TemporaryAllDurationShapedProvider();
  const groupRunScheduler = new GroupRunScheduler(
    eventStore,
    groupRunProjection,
    durationSource,
    taskShapeProvider,
  );
  groupRunScheduler.start(1000); // Tick every 1 second

  // Real GroupRunPhaseProvider (STORY-001-040): satisfies the seam
  // STORY-001-032 already stubbed with this interface.
  const groupRunPhaseProvider = new ProjectionGroupRunPhaseProvider(groupRunProjection);

  // Run-control (STORY-001-032): Contest Director actions on a live group
  // (pause/resume/fast-forward/add-time/abort/gate-release/override). Now
  // wired with the real GroupRunPhaseProvider from STORY-001-040.
  const groupRunControlService = new GroupRunControlService(
    eventStore,
    groupRunPhaseProvider,
    // Stub no-score intake: no-op (STORY-001-031 will implement for real)
    {
      createNoScore: async () => {},
    },
    // Stub outstanding items provider: returns empty (STORY-001-043 will implement)
    {
      getOutstandingItems: async () => [],
    },
    scoringProjection,
  );

  // Group start (STORY-001-044): the single deliberate operator action that
  // starts every group. Manages group.opened emission and hands off to either
  // STORY-001-040's phase engine (duration-shaped) or its own reactive
  // completion listener (manual-run).
  const completionReactor = new GroupCompletionReactor(
    eventStore,
    lifecycleProjection,
    groupCompositionProvider,
    classModelProjection,
    options.scoreCompletenessProvider ??
      new ProjectionScoreCompletenessProvider(scoringProjection),
    options.noScoreOutstandingProvider ?? new NothingOutstandingNoScoreProvider(),
    options.reflightOutstandingProvider ?? new NothingOutstandingReflightProvider(),
  );

  const groupStartService = new GroupStartService(
    eventStore,
    groupCompositionProvider,
    classModelProjection,
    competitionProjection,
    lifecycleProjection,
    options.finalisationProgressProvider ??
      new ProjectionFinalisationProgressProvider(lifecycleProjection),
    lifecycleGuard,
    groupRunScheduler, // STORY-001-040's scheduler hook (real or stub)
    completionReactor,
  );

  // Prep-gate hold view (STORY-001-044): read-only gate state display.
  // Stub until STORY-001-034 lands with real device-confirmation mechanics.
  const prepGateHoldProvider = new PrepGateHoldViewService(
    lifecycleProjection,
    new StubGroupRunPhaseProvider(),
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
  registerScoringRoutes(app, scoringService);
  registerGroupRunRoutes(app, groupRunControlService);
  registerGroupStartRoutes(app, groupStartService, prepGateHoldProvider);
  registerGroupRunReadRoutes(app, groupRunProjection);

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
    if (error instanceof CompetitionNotReadyError) {
      reply.code(409).send({
        code: error.code,
        message: error.message,
        details: { outstandingItems: error.outstandingItems },
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
    // STORY-001-040: group-run phase-transition engine errors. Inserted after
    // task-config block and before draw block (Safeguard 8 compliance).
    if (error instanceof FieldAidSettingsNotConfiguredError) {
      reply.code(409).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof NoDurationShapedTaskConfiguredError) {
      reply.code(409).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof GroupRunNotFoundError) {
      reply.code(404).send({ code: error.code, message: error.message } satisfies ErrorResponse);
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
    if (error instanceof DrawNotAcceptedError) {
      reply.code(409).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof GroupMoveTargetNotFoundError || error instanceof ReflightEntitlementNotFoundError) {
      reply.code(404).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof GroupMoveClashError || error instanceof GroupSplitInvalidError) {
      reply.code(409).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof CaptureTargetNotFoundError) {
      reply.code(404).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof LonePilotAlreadyResolvedError || error instanceof AnnulmentOverridePendingError) {
      reply.code(409).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    // STORY-001-032: run-control domain errors. Inserted after scoring block,
    // before generic lifecycle fallback (Safeguard 8 compliance).
    if (error instanceof GroupNotInPreparationError) {
      reply.code(409).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof PrepAtFloorError) {
      reply.code(409).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof PrepGateNotHeldError) {
      reply.code(409).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof GroupNotInWorkingTimeError) {
      reply.code(409).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof RoundAdvanceNotBlockedError) {
      reply.code(409).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof GroupNotFoundError) {
      reply.code(404).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    // STORY-001-044: group start control and manual run tasks. Inserted after
    // STORY-001-032's run-control block and before generic lifecycle fallback
    // (Safeguard 8 compliance).
    if (error instanceof NoGroupReadyToStartError) {
      reply.code(409).send({ code: error.code, message: error.message } satisfies ErrorResponse);
      return;
    }
    if (error instanceof TransitionNotAllowedError) {
      reply.code(409).send({
        code: error.code,
        message: error.message,
        details: { currentState: error.currentState, attemptedAction: error.attemptedAction },
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
    groupRunScheduler.stop();
    eventStore.close();
  });

  return app;
}
