import { describe, expect, it } from "vitest";
import type { LifecycleAction, LifecycleState } from "@soarscore/shared";
import { LifecycleGuard } from "../src/lifecycle/guard.js";
import { TransitionNotAllowedError } from "../src/lifecycle/errors.js";

const guard = new LifecycleGuard();

const setup: LifecycleState = { state: "Setup", setupSubState: "DrawAccepted" };
const betweenGroups: LifecycleState = { state: "Running", runningSubState: "BetweenGroups" };
const groupInProgress: LifecycleState = { state: "Running", runningSubState: "GroupInProgress" };
const suspended: LifecycleState = { state: "Suspended" };
const locked: LifecycleState = { state: "Locked" };
const deleted: LifecycleState = { state: "Deleted" };

describe("LifecycleGuard — the single legality table", () => {
  it("Delete is admissible only from Setup (AC4)", () => {
    expect(guard.isAdmissible(setup, "Delete")).toBe(true);
    for (const state of [betweenGroups, groupInProgress, suspended, locked, deleted]) {
      expect(guard.isAdmissible(state, "Delete")).toBe(false);
    }
  });

  it("Suspend / Lock / RoundAdvance are admissible only from Running/BetweenGroups (AC5)", () => {
    for (const action of ["Suspend", "Lock", "RoundAdvance"] as LifecycleAction[]) {
      expect(guard.isAdmissible(betweenGroups, action)).toBe(true);
      expect(guard.isAdmissible(groupInProgress, action)).toBe(false);
      expect(guard.isAdmissible(setup, action)).toBe(false);
      expect(guard.isAdmissible(suspended, action)).toBe(false);
    }
  });

  it("Resume is admissible only from Suspended (AC6)", () => {
    expect(guard.isAdmissible(suspended, "Resume")).toBe(true);
    expect(guard.isAdmissible(betweenGroups, "Resume")).toBe(false);
    expect(guard.isAdmissible(setup, "Resume")).toBe(false);
  });

  it("Locked and Deleted are terminal — nothing is admissible", () => {
    for (const state of [locked, deleted]) {
      expect(guard.admissibleActions(state)).toEqual([]);
    }
  });

  it("assertAdmissible throws TransitionNotAllowedError carrying state + action, else returns silently", () => {
    expect(() => guard.assertAdmissible(setup, "Delete")).not.toThrow();
    try {
      guard.assertAdmissible(betweenGroups, "Delete");
      throw new Error("expected TransitionNotAllowedError");
    } catch (error) {
      expect(error).toBeInstanceOf(TransitionNotAllowedError);
      const e = error as TransitionNotAllowedError;
      expect(e.code).toBe("TRANSITION_NOT_ALLOWED");
      expect(e.currentState).toBe("Running");
      expect(e.attemptedAction).toBe("Delete");
    }
  });

  it("admissibleActions reports the current 'what may be done now' set", () => {
    expect(guard.admissibleActions(setup)).toEqual(["Delete"]);
    expect(guard.admissibleActions(betweenGroups).sort()).toEqual(["Lock", "RoundAdvance", "Suspend"]);
    expect(guard.admissibleActions(groupInProgress)).toEqual([]);
    expect(guard.admissibleActions(suspended)).toEqual(["Resume"]);
  });
});
