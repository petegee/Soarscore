import type { LifecycleAction, LifecycleState } from "@soarscore/shared";
import { TransitionNotAllowedError } from "./errors.js";

// The single source of transition legality (STORY-001-024). One generic
// interpreter over a static table keyed on (state [+ sub-state], action) — no
// per-action bespoke code, and, load-bearing (CLAUDE.md class-model law), no
// branch on any competition class and no read of the Contest Class Model. Adding
// or changing a class never touches this file.
//
// Table (the only place legality lives):
//   Delete       ⇐ Setup (any sub-state)
//   Suspend      ⇐ Running / BetweenGroups
//   Lock         ⇐ Running / BetweenGroups
//   RoundAdvance ⇐ Running / BetweenGroups
//   Resume       ⇐ Suspended
//   Locked, Deleted are terminal — nothing is admissible from them.

const ALL_ACTIONS: LifecycleAction[] = ["Delete", "Suspend", "Resume", "Lock", "RoundAdvance"];

// Human-readable rejection reasons — operator-facing, revealing no internal
// implementation detail (Norm 4).
const REJECTION_REASON: Record<LifecycleAction, string> = {
  Delete: "A competition can be deleted only during Setup",
  Suspend: "A competition can be suspended only while running between groups",
  Resume: "A competition can be resumed only while suspended",
  Lock: "A competition can be locked only while running between groups",
  RoundAdvance: "A round can be advanced only while running between groups",
};

export class LifecycleGuard {
  // Pure table lookup — exactly one state admits each action.
  isAdmissible(state: LifecycleState, action: LifecycleAction): boolean {
    switch (action) {
      case "Delete":
        return state.state === "Setup";
      case "Suspend":
      case "Lock":
      case "RoundAdvance":
        return state.state === "Running" && state.runningSubState === "BetweenGroups";
      case "Resume":
        return state.state === "Suspended";
      default:
        return false;
    }
  }

  // Throws TransitionNotAllowedError (a DomainError) when the action is illegal
  // from the given state; returns silently otherwise. Never returns an ad-hoc
  // boolean/null for an illegal action (Norm 3).
  assertAdmissible(state: LifecycleState, action: LifecycleAction): void {
    if (this.isAdmissible(state, action)) return;
    throw new TransitionNotAllowedError(REJECTION_REASON[action], state.state, action);
  }

  // The read-side "what may be done now" set, for the lifecycle DTO.
  admissibleActions(state: LifecycleState): LifecycleAction[] {
    return ALL_ACTIONS.filter((action) => this.isAdmissible(state, action));
  }
}
