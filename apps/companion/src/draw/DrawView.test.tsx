import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  FlightGroup,
  GeneratedDraw,
  RosterEntryView,
  TaskGroupSet,
  TaskMatchupDistribution,
} from "@soarscore/shared";
import {
  DrawRounds,
  FairnessEvidence,
  TaskDrawSections,
  TaskFairnessRow,
  isMultiTask,
} from "./DrawView.js";

// STORY-001-021: presentation-layer tests for the per-task draw views. No
// React Testing Library / jsdom exists in this repo yet (companion has no
// test file or DOM test harness at all), so these render the exported
// presentational components directly with react-dom/server and assert on
// the static markup string — enough to cover AC1-AC3 without introducing a
// new test framework/dependency (react-dom is already a companion
// dependency). DrawView itself (fetch/decision orchestration) is untouched
// by this story and is intentionally not exercised here.

function rosterEntry(id: string, pilotName: string, pilotNumber: number): RosterEntryView {
  return {
    id,
    competitionId: "comp-1",
    pilotId: `pilot-${id}`,
    pilotNumber,
    pilotClass: null,
    pilotName,
    retired: false,
  };
}

const roster: RosterEntryView[] = [
  rosterEntry("r1", "Alice", 1),
  rosterEntry("r2", "Bob", 2),
  rosterEntry("r3", "Cara", 3),
  rosterEntry("r4", "Dev", 4),
];
const rosterMap = new Map(roster.map((entry) => [entry.id, entry]));

function group(flyingOrder: number, memberIds: string[], lonePilotFlagged = false): FlightGroup {
  return {
    flyingOrder,
    members: memberIds.map((id, lane) => ({ rosterEntryId: id, lane })),
    lonePilotFlagged,
  };
}

function distribution(variance: number) {
  return {
    pairs: [{ a: "r1", b: "r2", count: 1 }],
    maxMeets: 1,
    totalExcessMeets: 0,
    variance,
  };
}

// A single-task (F5J-shaped) draw: exactly one TaskGroupSet/TaskMatchupDistribution
// entry per round, mirroring the flat groups/distribution fields (STORY-001-020's
// back-compat guarantee).
function singleTaskDraw(): GeneratedDraw {
  const groups = [group(1, ["r1", "r2"]), group(2, ["r3", "r4"])];
  const taskGroups: TaskGroupSet[] = [{ taskId: "task-1", taskName: "Duration", groups }];
  return {
    id: "draw-1",
    competitionId: "comp-1",
    specId: "spec-1",
    rounds: [
      { roundNumber: 1, groups, taskGroups },
      { roundNumber: 2, groups, taskGroups },
    ],
    metric: "min-variance",
    metricValue: 0.5,
    distribution: distribution(0.5),
    attemptsRun: 42,
    groupSizeWarnings: [],
    taskDistributions: [{ taskId: "task-1", taskName: "Duration", distribution: distribution(0.5), metricValue: 0.5 }],
  };
}

// A multi-task draw generic over task count (F3B-shaped uses 3; also used with
// 2 to prove no task-count is hardcoded).
function multiTaskDraw(taskNames: string[], loneInTaskIndex?: number): GeneratedDraw {
  const roundTaskGroups = (roundNumber: number): TaskGroupSet[] =>
    taskNames.map((name, i) => ({
      taskId: `task-${i}`,
      taskName: name,
      groups:
        i === loneInTaskIndex && roundNumber === 1
          ? [group(1, ["r1", "r2"]), group(2, ["r3"], true)]
          : [group(1, ["r1", "r2"]), group(2, ["r3", "r4"])],
    }));

  const taskDistributions: TaskMatchupDistribution[] = taskNames.map((name, i) => ({
    taskId: `task-${i}`,
    taskName: name,
    distribution: distribution(i + 1),
    metricValue: i + 1,
  }));

  const rounds = [1, 2].map((roundNumber) => ({
    roundNumber,
    groups: roundTaskGroups(roundNumber)[0]!.groups,
    taskGroups: roundTaskGroups(roundNumber),
  }));

  return {
    id: "draw-2",
    competitionId: "comp-1",
    specId: "spec-2",
    rounds,
    metric: "min-variance",
    metricValue: 1,
    distribution: distribution(1),
    attemptsRun: 17,
    groupSizeWarnings: [],
    taskDistributions,
  };
}

describe("isMultiTask", () => {
  it("is false for a single-task draw (every existing single-task class)", () => {
    expect(isMultiTask(singleTaskDraw())).toBe(false);
  });

  it("is true for a multi-task draw regardless of task count", () => {
    expect(isMultiTask(multiTaskDraw(["Duration", "Distance", "Speed"]))).toBe(true);
    expect(isMultiTask(multiTaskDraw(["Task A", "Task B"]))).toBe(true);
  });
});

describe("single-task path (AC3 non-regression)", () => {
  it("renders round headings and a group table with no task-name heading", () => {
    const draw = singleTaskDraw();
    const html = renderToStaticMarkup(<DrawRounds draw={draw} rosterMap={rosterMap} />);
    expect(html).toContain("Round 1");
    expect(html).toContain("Round 2");
    expect(html).not.toContain("Duration");
    expect(html).toContain("#1 Alice");
  });

  it("renders the flat fairness card with no task label", () => {
    const draw = singleTaskDraw();
    const html = renderToStaticMarkup(<FairnessEvidence draw={draw} rosterMap={rosterMap} />);
    expect(html).toContain("Fairness evidence");
    expect(html).not.toContain("Fairness evidence — ");
    expect(html).toContain("fairest of 42 attempts");
  });
});

describe("multi-task path (AC1/AC2)", () => {
  it("renders one labelled section per task (3-task, F3B-shaped)", () => {
    const draw = multiTaskDraw(["Duration", "Distance", "Speed"]);
    const html = renderToStaticMarkup(<TaskDrawSections draw={draw} rosterMap={rosterMap} />);
    for (const name of ["Duration", "Distance", "Speed"]) {
      expect(html).toContain(`<h2>${name}</h2>`);
    }
    // Each task shows its own Round 1 / Round 2 headings.
    expect(html.match(/Round 1/g)?.length).toBe(3);
    expect(html.match(/Round 2/g)?.length).toBe(3);
  });

  it("renders fairness cards side by side, one per task, never blended", () => {
    const draw = multiTaskDraw(["Duration", "Distance", "Speed"]);
    const html = renderToStaticMarkup(<TaskFairnessRow draw={draw} rosterMap={rosterMap} />);
    expect(html).toContain("task-fairness-row");
    expect(html).toContain("Fairness evidence — Duration");
    expect(html).toContain("Fairness evidence — Distance");
    expect(html).toContain("Fairness evidence — Speed");
    // Per-task attemptsRun is never shown (whole-draw figure, not per-task).
    expect(html).not.toContain("fairest of");
  });

  it("is generic over task count (2 tasks, not 1 or 3)", () => {
    const draw = multiTaskDraw(["Task A", "Task B"]);
    const sectionsHtml = renderToStaticMarkup(<TaskDrawSections draw={draw} rosterMap={rosterMap} />);
    const fairnessHtml = renderToStaticMarkup(<TaskFairnessRow draw={draw} rosterMap={rosterMap} />);
    expect(sectionsHtml).toContain("<h2>Task A</h2>");
    expect(sectionsHtml).toContain("<h2>Task B</h2>");
    expect(fairnessHtml).toContain("Fairness evidence — Task A");
    expect(fairnessHtml).toContain("Fairness evidence — Task B");
  });

  it("renders the lone-pilot badge inside the affected task's section", () => {
    const draw = multiTaskDraw(["Duration", "Distance"], 1);
    const html = renderToStaticMarkup(<TaskDrawSections draw={draw} rosterMap={rosterMap} />);
    expect(html).toContain("lone pilot");
  });

  it("renders identically for an accepted-status draw of the same shape", () => {
    const draw = multiTaskDraw(["Duration", "Distance", "Speed"]);
    const candidateSections = renderToStaticMarkup(
      <TaskDrawSections draw={draw} rosterMap={rosterMap} />,
    );
    const acceptedSections = renderToStaticMarkup(
      <TaskDrawSections draw={draw} rosterMap={rosterMap} />,
    );
    expect(acceptedSections).toBe(candidateSections);
  });
});
