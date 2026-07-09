// Deferred-state seams (RD3): this story owns no draw, retirement, or scoring
// state, so each is queried through an injected interface with a no-op stub.
// STORY-001-009 (draw), Area 5.5 (retirement) and the scoring story swap in
// real implementations via AppOptions with zero rework.

// Contract: "exists" means an *accepted* draw (not merely generated) — that is
// what flips free roster editing off. Read-only by design (RD4): draw slots
// key on rosterEntryId, so a replacement inherits its slots with no draw
// write; adding a write method here is a design break.
export interface DrawStateProvider {
  hasAcceptedDraw(competitionId: string): boolean;
}

// STORY-001-009: a real provider will answer from accepted-draw events.
export class NoAcceptedDrawProvider implements DrawStateProvider {
  hasAcceptedDraw(_competitionId: string): boolean {
    return false;
  }
}

// Retired state is owned by Area 5.5 outright — it is never stored on the
// roster entry; views query it at read time.
export interface RetirementStateProvider {
  getRetiredEntryIds(competitionId: string): Set<string>;
}

// Area 5.5: a real provider will answer from CD retirement events.
export class NothingRetiredProvider implements RetirementStateProvider {
  getRetiredEntryIds(_competitionId: string): Set<string> {
    return new Set();
  }
}

// Score-binding rule (pinned here for the scoring story): every captured
// score must record the pilotId of the seat's occupant at capture time
// alongside the rosterEntryId, and results aggregate per *pilot* — the seat
// carries draw slots forward, never results backward or across occupants.
// This provider exists so a flown seat can never be replaced: points must
// not transfer with the seat (that path is CD retirement + re-draw, Area 5.5).
export interface EntryScoresProvider {
  hasCapturedScores(competitionId: string, rosterEntryId: string): boolean;
}

// STORY (scoring): a real provider will answer from captured score events.
export class NoEntryScoresYetProvider implements EntryScoresProvider {
  hasCapturedScores(_competitionId: string, _rosterEntryId: string): boolean {
    return false;
  }
}
