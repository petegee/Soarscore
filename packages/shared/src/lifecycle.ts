// Competition lifecycle vocabulary (STORY-001-024). A single authoritative
// lifecycle state per competition, derived purely from the immutable event log,
// plus the class-agnostic action set whose legality one guard decides. These
// enums are shared by base (derivation + guard) and companion (read display).
//
// Class-agnostic law (CLAUDE.md): none of this vocabulary references any
// competition class (F3B/F3J/…) — the core interprets the state machine
// generically and never branches on discipline.
//
// Additive-only (NFR-2): these string unions grow by appending new members;
// existing members are never renamed or reshaped, so an append-only event log
// and every client stay forward-compatible.

export type LifecycleStateName =
  | "Setup"
  | "Running"
  | "Suspended"
  | "Locked"
  | "Deleted";

export type SetupSubState =
  | "Draft"
  | "RosterComplete"
  | "DrawSpecified"
  | "DrawGenerated"
  | "DrawAccepted";

export type RunningSubState = "BetweenGroups" | "GroupInProgress";

export type LifecycleAction =
  | "Delete"
  | "Suspend"
  | "Resume"
  | "Lock"
  | "RoundAdvance"
  | "Start";

// The two recorded outcomes a Lock resolves the terminal Locked state into
// (STORY-001-026): OfficialResults when the flown count meets the class minimum
// (or the class fixes no minimum); NoContest when it falls short — locked, no
// official results, all captured data and the full event log retained. A flat
// additive string union (NFR-2), never a class; no discipline appears in the
// vocabulary (CLAUDE.md class-model law).
export type FinalisationOutcome = "OfficialResults" | "NoContest";

// The composite state: a sub-state is present only within its owning composite
// (Setup ⇒ setupSubState; Running ⇒ runningSubState). Suspended/Locked/Deleted
// carry no sub-state.
export interface LifecycleState {
  state: LifecycleStateName;
  setupSubState?: SetupSubState;
  runningSubState?: RunningSubState;
}

// A single unmet Start prerequisite (STORY-001-025, AC2/AC3): a stable machine
// code the companion switches on for localisation, plus a human-readable
// operator-facing message. A flat DTO — never a class hierarchy. Additive-only
// (NFR-2): the code union grows by appending members.
export type OutstandingItemCode =
  | "ROSTER_INCOMPLETE"
  | "DRAW_NOT_ACCEPTED"
  | "SCORE_MISSING"
  | "NO_SCORE_UNRESOLVED"
  | "REFLIGHT_UNFLOWN";

export interface OutstandingItem {
  code: string;
  message: string;
}

// Read DTO returned by GET /api/competitions/:id/lifecycle: the flattened state,
// its sub-state (null when the state has none), and what may be done now.
export interface LifecycleStateResponse {
  state: LifecycleStateName;
  subState: string | null;
  admissibleActions: LifecycleAction[];
}
