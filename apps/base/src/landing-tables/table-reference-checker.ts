import type { CompetitionRef } from "@soarscore/shared";

export interface LandingTableReferenceChecker {
  getReferencingCompetitions(tableId: string): CompetitionRef[];
}

// STORY-001-008 note: the earlier `NoTaskConfigYetChecker` seam here anticipated
// per-competition landing-table *selection*. Under D12/016 landing tables became
// model-owned (each TaskParameterSet owns its table); the per-competition
// task-config (STORY-001-008) creates no per-competition table references, so
// that seam's premise is dead and the checker has been retired.
//
// LEFTOVER-CLEANUP (016): the wider standalone `landing-tables`
// service / projection / routes module is now orphaned too — no route is
// registered and nothing constructs it. It is left in place pending a separate
// confirm-and-remove pass, NOT silently deleted here.
