import type { StartStateProvider } from "../competitions/state-providers.js";
import type { LifecycleProjection } from "./projection.js";

// The real StartStateProvider (STORY-001-025), replacing the NotStartedProvider
// stub as the app.ts default. The interface is competitions-owned; this
// implementation is lifecycle-owned and injected via AppOptions, so a config
// module never imports the lifecycle module (no cycle), mirroring
// ProjectionDrawStateProvider.
//
// Seam honesty: it answers from genuine "past Start" membership — true once
// competition.started is folded and still true while Suspended/Locked — so the
// config-authority boundary flips exactly when proceedings have started.
export class ProjectionStartStateProvider implements StartStateProvider {
  constructor(private readonly projection: LifecycleProjection) {}

  isStarted(competitionId: string): boolean {
    return this.projection.isStarted(competitionId);
  }
}
