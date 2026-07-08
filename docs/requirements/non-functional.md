# Soarscore — Non-Functional Requirements

Cross-cutting qualities the design must have, as distinct from what any one
area does. Graduated from the root `todos.md` scratch list on **2026-07-08**
so recorded decisions (notably [D4](decisions.md#d4--immutable-event-log))
rest on a proper requirements doc. Further NFRs land here.

Qualities already captured as decisions are not repeated — offline-first is
[D6](decisions.md#d6--offline-first-buffer-and-sync-publish-when-connected),
auditability is [D4](decisions.md#d4--immutable-event-log), scale bounds are
[D7](decisions.md#d7--scale-bounds-and-multi-day-operation).

---

## NFR-1 — One centralised, flexible task model

The specifics and variations of each competition type — especially the
scores/metrics recorded — must be encoded **in one central place**. Some
classes are multi-task; tasks variously require laps, time, time + landing
points, time + launch height + landing points, launch counts, target-time
calls, and so on ([rules/](rules/)). That single encoding must drive:

- **what is displayed** (device capture flow, companion-app screens),
- **what values are recorded** (fields, precision, multi-flight shape),
- **how they are validated** (caps, windows, per-class limits), and
- **how they are scored** (the system-side arithmetic).

There must be exactly one place that knows a task's shape; nothing else may
hard-code per-class behaviour.

**Already realised in part:** the **task descriptor** is this model's
device-facing projection — descriptor-driven capture, no hard-coded
per-class screens ([scorer-device.md §1](scorer-device.md#1-capture-model--what-a-scorer-records),
Appendix A), configured generically through
[Area 3](high-level-requirements.md#area-3--competition-setup--configuration)
(3.6/3.7). The derived per-class deduction classification
([scorer-device.md Appendix B](scorer-device.md#appendix-b--per-class-deductionpenalty-classification-derived-2026-07-08))
bounds the enumeration the model must express.

**Interaction with D4:** the domain model must be designed **together with
the immutable event log** — events are the mutations of this model, and
current state must be derivable from them
([D4](decisions.md#d4--immutable-event-log)).

## NFR-2 — Additive-only extensibility for new competition types

Adding a **new competition type must not require changing existing code** —
extension is additive only: a new task/class definition (NFR-1's encoding),
not edits to what already runs. Existing classes' behaviour, stored data and
results must be unaffected by the addition.

This is what makes the deferred per-discipline work
([high-level-requirements.md](high-level-requirements.md), notes for future
work) and GliderScore's 14-class breadth (`feature-parity.md`) reachable
from a 6-class MVP without rework — and it is the acceptance test for
NFR-1: if a new class forces a code change outside its own definition, the
task model was not flexible enough.

---

**Traceability:** originated as the two Non-Functional items in the root
`todos.md`; referenced by [D4](decisions.md#d4--immutable-event-log) and by
the descriptor contract open items in
[scorer-device.md](scorer-device.md#open-items).
