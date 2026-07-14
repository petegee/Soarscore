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
//   Start        ⇐ Setup / DrawAccepted (STORY-001-025)
//   Locked, Deleted are terminal — nothing is admissible from them.

const ALL_ACTIONS: LifecycleAction[] = [
  "Delete",
  "Suspend",
  "Resume",
  "Lock",
  "RoundAdvance",
  "Start",
];

// Human-readable rejection reasons — operator-facing, revealing no internal
// implementation detail (Norm 4).
const REJECTION_REASON: Record<LifecycleAction, string> = {
  Delete: "A competition can be deleted only during Setup",
  Suspend: "A competition can be suspended only while running between groups",
  Resume: "A competition can be resumed only while suspended",
  Lock: "A competition can be locked only while running between groups",
  RoundAdvance: "A round can be advanced only while running between groups",
  Start: "Proceedings can be started only when the roster is complete and the draw accepted",
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
      // STORY-001-025 (AC1/AC7): Start is admissible only from a Setup
      // competition whose readiness ladder has reached DrawAccepted (roster
      // complete AND draw accepted). Every other state — Running / Suspended /
      // Locked / Deleted, or a Setup below DrawAccepted — is inadmissible here,
      // so a double-start and a start from a terminal state fall out of the
      // table for free. The readiness *list* is computed service-side; the
      // guard stays a pure boolean with no class read (class-model law).
      case "Start":
        return state.state === "Setup" && state.setupSubState === "DrawAccepted";
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
