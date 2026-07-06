# Soarscore — Requirements Structure (User-Story Backbone)

## Purpose

An **index and plan**, not a spec. It groups the domain's functionality into
requirement **areas** (epics) and **sub-areas** (feature groups) so future work
can flesh each one into user stories and acceptance criteria, one focused pass
at a time.

These are **high-level, implementation-agnostic** requirements: they describe
*what a glider-competition scoring system must do*, independent of any existing
codebase or UI.

This document scopes an **MVP** — the minimum needed to run a basic competition.
Capabilities not required for a basic contest are collected under
[Future Enhancements](#future-enhancements) so the core stays small; pull them
back in as the MVP matures.

**Roles** referenced throughout: **Organiser**, **Contest Director**, **Scorer**,
**Announcer / Timekeeper**, **Pilot**. See [users.md](users.md) for each role's
needs and tasks. (Non-flying officials such as Team Manager and Jury are deferred
beyond the MVP.)

---

## Area 1 — Master Data Management

Reusable reference data that exists independently of any single competition and
is shared across all of them.

| Sub-area | Description |
|---|---|
| 1.1 Pilots | Maintain reusable pilot records (name required; registration IDs, club, contact optional). |
| 1.2 Landing Bonus Tables | Define reusable distance→points tables, selectable per competition. |
| 1.3 Contest Templates | Maintain reusable, pre-configured competition templates (draw/scoring/task settings) to speed up contest creation. Templates are discipline-specific; specific disciplines are deferred to per-discipline requirements. Consumed by [3.1 Create Competition](#area-3--competition-setup--configuration). |

---

## Area 2 — Competition Lifecycle

Managing whole competitions as objects.

| Sub-area | Description |
|---|---|
| 2.1 Create / Open / Delete | Basic lifecycle actions over competitions. |
| 2.2 Lock | Freeze a competition against further changes while keeping reports available. |

---

## Area 3 — Competition Setup & Configuration

Everything that defines how a specific competition scores and runs.

| Sub-area | Description |
|---|---|
| 3.1 Create Competition | Capture identity (name, venue, date); optionally seed from a template; support fly-off competitions. |
| 3.2 Discipline Selection | Choose the competition discipline, which determines available tasks and rules. |
| 3.3 Entry Options | Toggle features that shape the roster and results: teams, start numbers, pilot classes. |
| 3.4 Roster Entry | Build the competition roster from master pilots; edit per-entry attributes (frequency, team, omit-from-team-score); replace entrants after the draw. |
| 3.5 Draw Options | Configure fairness constraints for the draw: team separation, frequency spacing, helper assignment, lane allocation. |
| 3.6 Scoring Options | Configure result computation: group-score basis, rounding/precision, and discard (drop-worst) rules. |
| 3.7 Task Scoring Rules | Configure per-task parameters generically — target times (incl. per-round overrides), timing precision, points-per-second, landing-bonus table, penalty/deduction types, timekeeper count. *Discipline-specific tasks and special rules are deferred to per-discipline requirements.* |

---

## Area 4 — Draw & Rounds Generation

Producing fair round-by-round flight groups, then validating and adjusting them.

| Sub-area | Description |
|---|---|
| 4.1 Draw Specification | Set draw mode, groups-per-round, and consecutive-flight constraints, within bounds implied by roster/frequency/task. |
| 4.2 Generate Draw | Produce the flight groups for a chosen number of rounds, retaining the fairest of multiple attempts. |
| 4.3 Validate Draw | Report matchup distribution and a fairness metric; allow re-draw. |
| 4.4 Adjust Lanes | Review and manually reassign lane allocations after the draw. |
| 4.5 Progressive/Seeded Draw | Support draws where later rounds are seeded from prior-round scores; handle pilot retirement/reinstatement. |

---

## Area 5 — Scoring

Capturing flight results and all mid-competition adjustments and validation.

Score capture is **device-based and concurrent**: one Scorer per competitor, each
on their own device, recording that pilot's metrics live into the shared contest
management system (1 device → 1 Scorer → 1 competitor). Several Scorers therefore
capture in parallel within a group. Pilots do **not** score themselves (conflict
of interest). See [users.md](users.md).

| Sub-area | Description |
|---|---|
| 5.0 Device Assignment | The Scorer selects, from the group's pilot list on the device, the competitor they are scoring so entries attribute correctly; the device shows the selected pilot for pre-group confirmation (Scorer's responsibility, pilot cross-checks); supports re-selecting the pilot between consecutive groups without swapping devices. **Pre-group confirmation guard:** the device blocks score entry for a group until its pilot has been deliberately (re-)confirmed for that group, so a stale selection carried over from the previous group cannot silently capture scores. |
| 5.1 Score Entry | Each Scorer captures the adjacent competitor's flight result live, with immediate confirmation against the right competitor; supports many Scorers capturing concurrently within a group. |
| 5.2 Task Scoring Screens | Capture the inputs each task requires (times, landings, laps, heights, motor runs, penalties). *Discipline-specific layouts deferred to per-discipline requirements.* |
| 5.3 Re-Flights & Group Management | Move pilots between groups, re-fly, create, or split groups, with clash checks. |
| 5.4 Score by Pilot | Review/enter a single pilot's scores across all rounds. |
| 5.5 Pilot Retirement | Retire a pilot and re-draw remaining rounds to exclude them; reinstate if needed. |
| 5.6 Score Validation | Flag outlier/missing scores against configurable limits, per pilot or overall. |

---

## Area 6 — Display, Timer & Audio (field aids)

On-field running of flight groups.

| Sub-area | Description |
|---|---|
| 6.1 Timer | Countdown/working-time timer for the current flight group. |
| 6.2 Audio | Spoken/audible callouts and announcements tied to the timer. |
| 6.3 Field Display | On-screen display of the current group and flying order. |

> ⚠️ **Stub** — sub-areas are inferred; confirm against the reference
> `Display` material before writing stories.

---

## Area 7 — Reports

Turning competition data into printable output at any stage of the event.

| Sub-area | Description |
|---|---|
| 7.1 Results Reports | Overall, positional, team, round-by-round, landing, and ranked results, with scope filters and round-range selection. |
| 7.2 Custom Reports | Branded/customisable report layouts, including combined preliminary + fly-off results. |
| 7.3 Draw Reports | Draw details in multiple layouts and sort orders; scoring sheets. |
| 7.4 Score Cards & Records | Printable per-pilot score cards and records. |

---

## Future Enhancements

Deferred beyond the MVP. Captured here so they aren't lost; promote into the
areas above when scoped.

**Master data**
- Models & Devices — pilot aircraft / onboard-device records.
- Roles — flying/non-flying personnel roles, role-based entry eligibility.

**Internationalisation** *(MVP is English-only)*
- Country codes reference list.
- Localization / multiple languages.

**Electronic & remote scoring**
- *(In MVP)* Concurrent multi-device capture by Scorers (one device per Scorer,
  one Scorer per competitor) is core MVP — see [Area 5](#area-5--scoring) — not a
  future enhancement.
- Remote / off-site scoring and sync scenarios beyond the on-site
  one-Scorer-per-competitor model.
- Machine-readable / hardware-assisted score capture (e.g. automated timing).
- *Pilots scoring their own flights is **out of scope** — a conflict of interest.*

**Multi-competition**
- Merge — consolidate rosters into shared flight groups, or append one competition into another.
- Competition series — aggregate multiple competitions into an overall series result.

**Data portability**
- Competition export / import.
- Roster import from an external file.
- External score interface (import/export via a data contract).

**Reports & distribution**
- Badges (identity and per-round matrix badges).
- Output channels (PDF/CSV export, online publishing).
- Email distribution of reports and links.

**System & cross-cutting**
- Data integrity & backup (backup/restore/safeguard).
- Multi-discipline entry (one pilot across multiple disciplines).
- Standards & compliance (governing-body rules, standard code lists).
- Help & onboarding (in-context help, tutorials).

---

## Notes for future work

- **Display/Timer/Audio (Area 6)** is unconfirmed — verify before writing stories.
- **Task scoring (3.7 / 5.2)** is intentionally generic; the bulk of detail lives
  in the deferred **per-discipline** requirements — flesh those out one
  discipline at a time.
