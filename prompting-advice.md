# Prompting Advice — getting the most out of Claude on Soarscore

Patterns that work well for a requirements-phase project like this one, with
copy-paste example prompts. The overall theme: your area-by-area,
one-role-at-a-time prompting produces good coverage of what you already know;
to surface **unknown unknowns**, add passes that attack the same material from
a different angle.

---

## 1. Keep doing: one focused pass at a time

Working one area, one role, one discipline per session (as the docs already
instruct) keeps altitude consistent and output reviewable. Resist "flesh out
everything" prompts — breadth in a single pass produces shallow, samey
stories.

## 2. Simulation / walkthrough prompts

Narrative walkthroughs find gaps that area-by-area review structurally cannot,
because real failures cut *across* areas.

> Simulate a 20-pilot, two-day F5J contest minute-by-minute using only what
> the requirements docs specify. Include a rain delay, one scorer device
> going offline mid-group, and one disputed score. At every point where the
> docs are silent or ambiguous about what the system does, stop and flag it.

Vary the class, the failure, and the day-shape each time you run it.

## 3. Traceability prompts

Mechanical coverage checks — this is how the score-sign-off and live-results
gaps were found.

> For every rule in docs/requirements/rules/, name the requirement (area /
> sub-area) that enforces it, or flag it as uncovered. Output a table:
> rule → requirement → covered/uncovered/deliberately-waived (cite
> decisions.md for waivers).

Also worth running in reverse: "for every sub-area, cite the rule or user
need it serves — flag orphans."

## 4. Pre-mortem prompts

> Assume the first real contest run on Soarscore ended with the club
> reverting to pen and paper by round 4 and never trusting the system again.
> Write the three most plausible post-mortems, then the requirements that
> would have prevented each.

Good variants: "the CD lost a scoring dispute", "the results were wrong and
nobody noticed until publication".

## 5. Consistency audits after each editing session

Cross-references rot as docs evolve (this is how the dangling
"Area 5 — penalties" reference surfaced).

> Cross-check high-level-requirements.md, users.md, decisions.md and the
> user-story docs for dangling, contradictory or duplicated cross-references
> and role assignments. Flag with proposed fixes; change nothing.

## 6. Commission missing docs as *questions with proposed defaults*

The highest-leverage format when you don't know the answers yourself: it
turns Claude's domain knowledge into a decision checklist instead of
guessed-at prose.

> Draft docs/requirements/scorer-device.md — hardware, firmware, interaction
> and sync requirements for the ESP32 stopwatch device. Where a decision is
> mine to make, write it as a question with your recommended default and the
> trade-off, not as settled prose.

## 7. State constraints once, durably

Decisions given in conversation evaporate at the end of the session. Anything
you find yourself repeating belongs in `docs/requirements/decisions.md` (and,
if it changes how every session should behave, in `CLAUDE.md`). After any
session where you settle something, end with:

> Turn the decisions from this conversation into entries in
> docs/requirements/decisions.md and update any requirement text they change.

## 8. Sweep open questions periodically

Open questions accumulate in each story doc's "Conflicts & questions"
section, in todos.md, and in blindspots-report.md — and rot in five places.

> Sweep every "Conflicts & questions" section, todos.md and
> blindspots-report.md into one consolidated open-decisions list, sorted by
> what blocks the most downstream work. Mark anything already answered by
> decisions.md as resolved in place.

## 9. Specify altitude and output shape explicitly

The docs' quality comes partly from prompts that pinned both. Keep doing it:
say "high-level, implementation-agnostic", name the file the output goes in,
name the format (user stories with acceptance criteria / a table / questions
with defaults), and require a closing "Conflicts & questions for the user"
section so nothing gets silently reconciled.

## 10. Re-run blind-spot passes at milestones

A blind-spot pass is a snapshot, not a one-off. Re-run it when something
structural changes — first discipline fully specified, scorer-device doc
drafted, first line of code:

> Do a fresh blind-spot pass over the full docs tree in light of what has
> changed since blindspots-report.md was written. Update that report:
> mark resolved items resolved, add new items with context and suggested
> fixes.
