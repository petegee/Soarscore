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

export type LifecycleAction = "Delete" | "Suspend" | "Resume" | "Lock" | "RoundAdvance";

// The composite state: a sub-state is present only within its owning composite
// (Setup ⇒ setupSubState; Running ⇒ runningSubState). Suspended/Locked/Deleted
// carry no sub-state.
export interface LifecycleState {
  state: LifecycleStateName;
  setupSubState?: SetupSubState;
  runningSubState?: RunningSubState;
}

// Read DTO returned by GET /api/competitions/:id/lifecycle: the flattened state,
// its sub-state (null when the state has none), and what may be done now.
export interface LifecycleStateResponse {
  state: LifecycleStateName;
  subState: string | null;
  admissibleActions: LifecycleAction[];
}
