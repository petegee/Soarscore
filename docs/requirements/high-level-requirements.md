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

For a one-screen picture of how these areas and roles fit together — a Base
Station running the competition management software, N Scorer Devices capturing
live, and each user attached by role — see the
[logical high-level architecture](../architecture/logical-architecture.md);
for what the physical boxes are — the headless Base Station, the device
fleet, the wired board and speakers, the companion-app laptop, and optional
pilot phones — see the
[physical architecture](../architecture/physical-architecture.md).

**System constraints.** Cross-cutting decisions that frame every area — the
club-level trust model (no auth, no sign-off), dedicated ESP32 stopwatch-style
Scorer devices, offline-first operation with device buffer-and-sync, the
pen-and-paper failure fallback, the immutable event log, and the scale bounds
(≤ 20 pilots, ≤ 8 rounds/day, 1–2 days) — are recorded in
[decisions.md](decisions.md). The Scorer device's hardware, firmware,
interaction and sync requirements live in
[scorer-device.md](scorer-device.md); the companion app — the operator
client of the headless Base Station — is specified in
[companion-app.md](companion-app.md).

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
| 2.2 Lock | Freeze a competition against further changes while keeping reports available. **Preceded by the Contest Director's end-of-contest validation pass** ([decisions.md D3](decisions.md#d3--failure-policy-pen-and-paper-reconcile-at-the-base)): review flagged anomalies ([5.6](#area-5--scoring)), enter missing scores and override known-incorrect ones via manual entry ([5.8](#area-5--scoring)), then lock. **Contest ended early (minimum-rounds validity):** a contest may be locked at any round count, but if the completed rounds fall **short of the class rules' minimum for a valid contest** (per the [per-class rule docs](rules/) — 4 rounds for F3J/F5J/F5L, 5 for F3K, 1 round + 1 task for F3B; **F5K defines no minimum** — there, finalising short is the Contest Director's judgement), it is finalised as a **no-contest**: locked with **no official results** produced, the captured data and event log retained. Where the minimum **is** met, final reports state the rounds flown, and drop-worst applies only past its class threshold ([general-rules §5](rules/00-general-rules.md#5-final-classification-common)). |
| 2.3 Suspend / Resume | Suspend a competition at end of day and resume the next day — two-day events are routine ([decisions.md D7](decisions.md#d7--scale-bounds-and-multi-day-operation)). Contest state (completed rounds, scores, draw position, round-in-progress status) carries over intact. **Suspend is allowed at any group boundary, including mid-round** (some groups flown, scores incomplete) — the system warns when suspending mid-round but does not block it; on resume the round simply continues. Scorer self-correction is **group-bounded** ([decisions.md D11](decisions.md#d11--the-devices-scope-is-the-current-group)), so suspension (always at a group boundary) never truncates it; changes to already-flown groups remain available on resume as base-side score administration ([5.3](#area-5--scoring)/[5.4](#area-5--scoring)). |

---

## Area 3 — Competition Setup & Configuration

Everything that defines how a specific competition scores and runs.

**Mid-contest configuration changes.** Once the first round has started, any
change to configuration that affects scoring or running (3.5–3.8) requires
**Contest Director authority** and is recorded in the event log
([decisions.md D4](decisions.md#d4--immutable-event-log)). Before applying a
change, the system **states which rounds' scores would recompute** as a
consequence. By default a change applies **from the next round onward**;
recomputing already-flown rounds requires the Director's **explicit opt-in** —
never a silent recompute. A change that alters what the devices capture
(fields, precision, target times, penalty flags) **re-issues the task
descriptor to the fleet**; each device applies the new descriptor at its
**next group entry, never mid-group**
([decisions.md D11](decisions.md#d11--the-devices-scope-is-the-current-group);
[scorer-device.md §1](scorer-device.md#1-capture-model--what-a-scorer-records)).
(Roster changes after the draw are handled by
[3.4](#area-3--competition-setup--configuration) /
[5.5](#area-5--scoring), not by this rule.)

| Sub-area | Description |
|---|---|
| 3.1 Create Competition | Capture identity (name, venue, date) and discipline (3.2); optionally seed from a template (which supplies the discipline). |
| 3.2 Discipline Selection | Choose the competition discipline at creation, which determines available tasks and rules; changing it after scores are captured is blocked (3.2 guard). |
| 3.3 Entry Options | Toggle features that shape the roster and results: pilot numbers, pilot classes. |
| 3.4 Roster Entry | Build the competition roster from master pilots; edit per-entry attributes (e.g. pilot number, class); replace entrants after the draw. |
| 3.5 Draw Options | Configure fairness constraints for the draw: lane allocation. (The FAI helper/official separation is consciously waived at club level — the Scorer **is** the helper — so there is no helper-assignment constraint; [decisions.md D1](decisions.md#d1--trust-model-small-known-trusted-group).) |
| 3.6 Scoring Options | Configure result computation: group-score basis, rounding/precision, and discard (drop-worst) rules. **Rule-derived guardrail (applies to all rule-fixed 3.6–3.8 parameters):** wherever the class rules fix a value — drop-worst thresholds, the class's mandated landing-bonus table, points-per-second (e.g. F5L = 2 pt/s), rule-bounded landing-window durations — the class rule is the **default**, and any deviation requires **explicit confirmation with a warning**; the system never silently accepts a value that contradicts the [rule docs](rules/). |
| 3.7 Task Scoring Rules | Configure per-task parameters generically — target times (incl. per-round overrides), timing precision, points-per-second, landing-bonus table, penalty/deduction types, and **per-event rule constants** the class rules leave to the event — e.g. **F5K's Nominal Launch Height** (60/70 m, CD-announced by wind, [f5k.md](rules/f5k.md)). All rule-fixed values fall under the [3.6 guardrail](#area-3--competition-setup--configuration): class-rule default, deviation warns. *Discipline-specific tasks and special rules are deferred to per-discipline requirements.* (The FAI two-timekeeper practice is consciously waived — one Scorer's device time is official; [decisions.md D1](decisions.md#d1--trust-model-small-known-trusted-group).) |
| 3.8 Field-Aid & Timing Options | Configure the on-field running of groups: **preparation-time** duration and **landing-window** duration (both per-competition; preparation must respect any class minimum — e.g. F5K prep ≥ 5 min), plus which optional in-working-time reminder callouts are enabled. Working-time durations come from the per-task rules ([3.7](#area-3--competition-setup--configuration)). Whether a task runs the automated phased sequence or is **manual-run** derives from the task type, not from configuration ([decisions.md D10](decisions.md#d10--operator-driven-progression-automation-runs-only-inside-a-group)). Consumed by [Area 6](#area-6--display-timer--audio-field-aids). |

---

## Area 4 — Draw & Rounds Generation

Producing fair round-by-round flight groups, then validating and adjusting them.

| Sub-area | Description |
|---|---|
| 4.1 Draw Specification | Set draw mode, the number of rounds, groups-per-round, and an **optional** consecutive-flight constraint (avoiding back-to-back groups across a round boundary — **off by default**, as club practice does not normally avoid it). **Multi-task classes draw each task's groups independently** ([decisions.md D13](decisions.md#d13--multi-task-classes-draw-each-task-independently)): F3B's Duration, Distance and Speed tasks each get their own group composition within a round, each governed by its **own** rule-fixed minimum (F3B: 5/3/8 by task; single-task classes — F3J/F5J 6, F3K 5 — draw one composition for the round, per the [rule docs](rules/)), not one composition bound to the largest minimum among a class's tasks. Groups-per-round is also bounded above by a roster-derived **maximum** of at most half the roster, i.e. **at least two groups per qualifying round**, because the non-flying pilots score the flying group ([decisions.md D1](decisions.md#d1--trust-model-small-known-trusted-group)) — relaxed by an explicit override when spare non-flying scorers are present. **A roster too small to meet a task's rule-fixed minimum does not block the draw:** per [decisions.md D14](decisions.md#d14--rule-fixed-group-size-minima-are-advisory-warn-and-require-override), the system generates the closest compliant grouping for that task, warns naming the task and the rule clause it falls short of, and requires the Contest Director's explicit acknowledgement before the draw can be accepted — mirroring the existing lone-pilot/F3B-annulment warn-and-approve pattern ([5.3](#area-5--scoring)). Only the roster-derived two-groups-per-round floor is a hard bound, rejected outright with the bound explained. |
| 4.2 Generate Draw | Produce the flight groups for a chosen number of rounds — per task, for multi-task classes ([D13](decisions.md#d13--multi-task-classes-draw-each-task-independently)) — retaining the fairest of multiple attempts, with fairness evidence reported per task where a class draws more than one. Where the roster allows, **avoid producing a group with only one scoring pilot** (see the [5.3](#area-5--scoring) lone-pilot safeguard). |
| 4.3 Validate Draw | Report matchup distribution and a fairness metric; allow re-draw. |
| 4.4 Adjust Lanes | Review and manually reassign lane allocations after the draw. |

---

## Area 5 — Scoring

Capturing flight results and all mid-competition adjustments and validation.

Score capture is **device-based and concurrent**: one Scorer per competitor, each
on their own device, recording that pilot's metrics live into the shared contest
management system (1 device → 1 Scorer → 1 competitor). Several Scorers therefore
capture in parallel within a group. Pilots do **not** score themselves (conflict
of interest). See [users.md](users.md). Each device also **mirrors the group's
live field-aid state** — round, group, current phase (prep / working / landing)
and countdown — driven from the Base Station's shared clock ([Area 6](#area-6--display-timer--audio-field-aids)).

**Round completeness & the Scorer correction window.** A round is **complete**
only when every group in it has all its scores captured; the **next round cannot
start until the current round is complete**, so no capture is stranded.
**Scorer self-correction is group-bounded**
([decisions.md D11](decisions.md#d11--the-devices-scope-is-the-current-group)):
a Scorer may correct a value they captured on the device only while its group
is still current — **up to the start of the next group** — after which any
change to a flown group's data is mid-contest score administration
([5.3](#area-5--scoring)/[5.4](#area-5--scoring)) via the companion app, or
the Contest Director's end-of-contest validation ([5.8](#area-5--scoring)).
Operating the advance — confirming completeness and starting the next round —
belongs to the **Announcer / Timekeeper**
([6.4](#area-6--display-timer--audio-field-aids)); see
[users.md §4](users.md#4-announcer--timekeeper-field-aid-operator).

| Sub-area | Description |
|---|---|
| 5.0 Device Assignment | The Scorer selects, from the group's pilot list on the device, the competitor they are scoring so entries attribute correctly; the device shows the selected pilot for pre-group confirmation (Scorer's responsibility, pilot cross-checks); supports re-selecting the pilot between consecutive groups without swapping devices. **Pre-group confirmation guard:** the device blocks score entry for a group until its pilot has been deliberately (re-)confirmed for that group, so a stale selection carried over from the previous group cannot silently capture scores. **Prep-gate link:** this per-group confirmation also gates the group's start — the preparation countdown pauses at one minute remaining until **every pilot in the group has exactly one confirming device** (the gate's unit is the **pilot**, not the device — [6.5](#area-6--display-timer--audio-field-aids)); a Scorer may instead mark their pilot **cannot make the group**, yielding a **no-score** ([5.7](#area-5--scoring)) so the group can proceed. **Exclusive claim:** confirming **claims** the pilot for that device — the base **rejects a second device's confirmation of an already-claimed pilot**, so one pilot can never have two concurrent capture devices while another silently goes Scorer-less; re-selecting away frees the claim, and the base's **group view** — computed by the Base Station, displayed on a companion client ([companion-app.md §3.2](companion-app.md#32-run-control--contest-director-65)) — shows which device holds which pilot. |
| 5.1 Score Entry | Each Scorer captures the adjacent competitor's flight result live, with immediate confirmation against the right competitor; supports many Scorers capturing concurrently within a group. |
| 5.2 Task Scoring Screens | Capture the inputs each task requires (times, landings, laps, heights, motor runs, penalties). *Discipline-specific layouts deferred to per-discipline requirements.* |
| 5.3 Re-Flights & Group Management | Move pilots between groups, re-fly, create, or split groups, with clash checks. **Re-flight results are distinct working-time results:** where the rules score the **better of two flights** (fillers and non-entitled members of a re-flown group; the entitled competitor scores the re-flight itself even if worse — [general-rules §7](rules/00-general-rules.md#7-re-flights-common-pattern)), the same pilot legitimately holds two results for the round; each is stored as its own working-time result and the better-of is applied by the scoring rules — this is **never** treated as a sync conflict ([scorer-device.md §5](scorer-device.md#5-sync-and-conflict-policy-a2)), which is reserved for two captures of the **same** flight. A **granted-but-unflown re-flight** is an outstanding item against round completeness ([6.4](#area-6--display-timer--audio-field-aids)). A **pilot-readiness group move** reassigns a pilot to another group **without regenerating the draw** — it does not invoke the [Area 4](#area-4--draw--rounds-generation) anti-repeat matrix and leaves all other pilots' groupings untouched (contrast [5.5 Pilot Retirement](#area-5--scoring), which *does* re-draw remaining rounds). **Lone-pilot safeguard:** no group may score with a single competitor — if one would, and the draw could not avoid it ([4.2](#area-4--draw--rounds-generation)), insert a **randomly-chosen dummy** from the other pilots for the lone pilot to be normalised against, so they are not auto-awarded the group winner's 1000 ([general-rules §3](rules/00-general-rules.md#3-group-score-normalisation)); the dummy's flight **does not count** toward that pilot's own score. Where a class rule dictates a different outcome — e.g. **F3B annuls a one-valid-result group** ([f3b.md](rules/f3b.md)) — the dummy is **not** applied automatically: the system **warns and requires the Contest Director's explicit approval, scoped to that one contest**, before proceeding. **The F3B annulment condition is checked at group-score time, not only at draw time:** it also fires in a full group where every competitor but one ends with an invalid/zero result (e.g. all land out) — the system must not hand the lone valid pilot 1000 but flag the group as **annulled per F3B**, whose consequence is a **re-flight of the group** using the same re-flight mechanics above, surfaced through the same CD-warning path as the lone-pilot case. |
| 5.4 Score by Pilot | Review/enter a single pilot's scores across all rounds. |
| 5.5 Pilot Retirement | Retire a pilot and re-draw remaining rounds to exclude them; reinstate if needed. |
| 5.6 Score Validation | Flag outlier/missing scores against configurable limits, per pilot or overall. |
| 5.7 No-Score Resolution | Handle a competitor who did **not fly** their group — a Scorer marked *cannot make the group* ([5.0](#area-5--scoring)), or the [Contest Director released the prep gate for an **unconfirmed pilot**](#area-6--display-timer--audio-field-aids) ([6.5](#area-6--display-timer--audio-field-aids); the **device-offline** release form applies no no-score). A **no-score** is distinct from a **zero**: it means *did not fly*, not *flew and scored zero*. The pilot is expected to still fly the round via a [pilot-readiness group move](#area-5--scoring) ([5.3](#area-5--scoring)) into a later group; a no-score **auto-converts to a zero at round end** only if no groups remain in the round for them to fly. An unresolved no-score is an outstanding item against **round completeness** — the round cannot advance ([6.4](#area-6--display-timer--audio-field-aids)) while a no-scored pilot could still be moved into a remaining group. |
| 5.8 Manual Entry & Paper Fallback | Bulk score entry into the Base Station, per group and round, for any task type — operated through the companion app ([companion-app.md §3.5](companion-app.md#35-manual-entry-and-the-paper-fallback--any-operator-58-d3)); the base is headless. This is the entry path when the field reverts to **pen and paper** after a device or system failure ([decisions.md D3](decisions.md#d3--failure-policy-pen-and-paper-reconcile-at-the-base)), and the mechanism for the Contest Director's end-of-contest corrections that gate Lock ([2.2](#area-2--competition-lifecycle)). Blank scoring sheets are printable **in advance** of any round ([7.3](#area-7--reports)) so the paper fallback is always ready. |
| 5.9 Penalties | The **Contest Director** imposes point penalties (up to disqualification) against a pilot and the round in which the infringement occurred. Penalties are **cumulative**, deducted from the **final aggregate** (not from a group score), **retained even when their round is dropped** by the class's drop-worst rule, and a total that would go negative is recorded as **zero** with the penalties still standing ([general-rules §6](rules/00-general-rules.md#6-penalties-common)). Every imposition or revocation is recorded in the event log ([decisions.md D4](decisions.md#d4--immutable-event-log)). Distinct from the **task-integral deductions** a Scorer captures as part of the flight ([5.2](#area-5--scoring)); class-specific penalty amounts live in the per-class rule docs. |

---

## Area 6 — Display, Timer & Audio (field aids)

On-field running of flight groups. The field always has a **large, bright
timer/display board** visible to everyone and a **loudspeaker set**, both
connected to and driven by the Base Station. The MVP assumes a **single flight
line** — one board, one speaker set, one group flying at a time.

Progression is **operator-driven at every boundary**: the Announcer/Timekeeper
starts each group, and nothing crosses a group or round boundary on its own
([decisions.md D10](decisions.md#d10--operator-driven-progression-automation-runs-only-inside-a-group)).
Once started, a group whose task fits runs an **automatic phased sequence**:
announce the round and group → announce the group's pilots → **preparation
time** → **working time** → **landing window**. Tasks whose shape does not fit
the sequence (e.g. F3B Distance/Speed, F3K all-up) are **manual-run** — the
group is marked current and devices capture normally, with no automated clock
([D10](decisions.md#d10--operator-driven-progression-automation-runs-only-inside-a-group)).
The Base Station drives the board, the speakers, and the Scorer devices
([Area 5](#area-5--scoring)) from **one shared clock** so they cannot drift
apart.

| Sub-area | Description |
|---|---|
| 6.1 Timer & Phases | Drive the group's phased countdown — **preparation**, **working time**, **landing window** — from one shared clock. Preparation and landing-window durations are per-competition ([3.8](#area-3--competition-setup--configuration)); working time is per-task ([3.7](#area-3--competition-setup--configuration)) and may differ round to round. Phases advance **automatically**: prep flows into working time, working time into the landing window. The system does **not** stop the Scorer devices' flight timing at end of working time — the Scorer times through to the model's first ground contact, past the **horn** if need be ([6.2](#area-6--display-timer--audio-field-aids); [decisions.md D5](decisions.md#d5--end-of-working-time-does-not-stop-the-device-stopwatch)/[D9](decisions.md#d9--per-flight-timestamps-on-the-base-clock)). Each flight's start/stop is **stamped on the shared clock** ([D9](decisions.md#d9--per-flight-timestamps-on-the-base-clock)), so the class rules' cap on countable flight time ([general-rules §2](rules/00-general-rules.md#2-data-the-timer--helper-collects)) is applied by the Base Station, which **derives any overfly and its magnitude from the timestamps** and lists derived overflies for the Contest Director's validation pass ([2.2](#area-2--competition-lifecycle)). |
| 6.2 Audio | Spoken/audible callouts on the shared clock: announce **round and group**, then the group's **pilots** (flying order, name and pilot number) so each pilot knows if they are in this group; announce the start of **preparation**; during **working time** announce remaining time **each minute on the minute**, then **every second from −30 s to zero**, then a **loud horn** at end of working time; announce the **landing window** at its start and the **all-down** at its end. Optional additional in-working-time reminders are configurable ([3.8](#area-3--competition-setup--configuration)). Pilot names are voiced by **text-to-speech, English only** in the MVP. |
| 6.3 Field Display Board | Big, glanceable, daylight-readable board showing the **current round and group**, the **current phase** (prep / working / landing) and the **remaining time** of that phase. (Pilot names / flying order are announced by audio, not shown on the board.) |
| 6.4 Round Progression | Advance the contest to the next round/group — the same operator start-action at a round boundary ([decisions.md D10](decisions.md#d10--operator-driven-progression-automation-runs-only-inside-a-group)). **Gated by score completeness:** the next round cannot be started until every group in the previous round has all its scores captured (see [Area 5](#area-5--scoring)); an unresolved [no-score](#area-5--scoring) ([5.7](#area-5--scoring)) is likewise an outstanding item that blocks the advance, as is a **granted-but-unflown re-flight** ([5.3](#area-5--scoring) — its placement is "at the end of the ongoing round", so advancing would strand the entitlement). A blocked advance **lists its outstanding items**; only the **Contest Director's explicit, attributed "advance anyway" override** proceeds regardless — outstanding missing scores become flagged anomalies for the validation pass ([2.2](#area-2--competition-lifecycle)), unresolved no-scores convert to zero per [5.7](#area-5--scoring), and an unflown re-flight entitlement **lapses** (the original result stands, flagged for the validation pass). Operated by the Announcer/Timekeeper. |
| 6.5 Group Run Control | Start, hold and adjust a running group. **Every group start is a deliberate operator action — groups never start themselves** ([decisions.md D10](decisions.md#d10--operator-driven-progression-automation-runs-only-inside-a-group)); the **Contest Director** may **pause/resume** the preparation phase (but **not** working time or the landing window). During preparation the Director may **fast-forward** (−1 minute per invocation, never below one minute remaining) or **add time** (+1 minute per invocation). **Prep confirmation gate:** the preparation countdown pauses at one minute remaining until **every pilot in the group has exactly one confirming device** — the gate's unit is the pilot, and a confirmation is an exclusive claim ([5.0](#area-5--scoring)). The Director may override the gate in **two distinct forms**: **"release gate — device offline"** — the Scorer's device cannot deliver its confirmation ([decisions.md D6](decisions.md#d6--offline-first-buffer-and-sync-publish-when-connected)); **no no-score** is applied and the buffered confirmation reconciles on sync — and **"release gate — pilot unconfirmed"** — the pilot genuinely isn't confirmed, and takes a **no-score** ([5.7](#area-5--scoring)). To keep the two distinguishable at a glance, every device shows a **sync-state indicator** and the base's group view — displayed on a companion client ([companion-app.md §3.2](companion-app.md#32-run-control--contest-director-65)) — shows each device's state ([scorer-device.md §4](scorer-device.md#4-prep-gate-vs-an-offline-device-a1)). Working time and the landing window cannot be paused, but the Director may **abort the whole group** (e.g. a range hold) and **restart it from preparation**, annulling any times/metrics accumulated for that group. |

---

## Area 7 — Reports

Turning competition data into printable output at any stage of the event.

| Sub-area | Description |
|---|---|
| 7.1 Results Reports | Overall, positional, round-by-round, landing, and ranked results, with scope filters and round-range selection. **Mid-contest standings, offline:** cumulative standings and each completed round's results are viewable on any connected **companion-app client** (e.g. the master laptop, or a second client on the clubhouse table — multiple clients may connect, [physical architecture §5](../architecture/physical-architecture.md#5-master-laptop--detachable-companion-app)) at any time between rounds — this is the MVP's way of displaying each round's results as the contest proceeds (`C.16.1 g`, [general-rules §5](rules/00-general-rules.md#5-final-classification-common)) without internet ([decisions.md D6](decisions.md#d6--offline-first-buffer-and-sync-publish-when-connected)); printing after a round remains available via the round-range reports. **Pilots' phones (MVP-optional):** the Base Station serves a **read-only draw/standings web page over local Wi-Fi** — no native app, strictly read-only, and a contest is fully runnable without it *(owner-decided 2026-07-08; see the [physical architecture §6](../architecture/physical-architecture.md#6-pilot-phones--optional-read-only-web-page))*. A push-notification pilot companion app stays a [Future Enhancement](#future-enhancements). |
| 7.2 Custom Reports | Branded/customisable report layouts. |
| 7.3 Draw Reports | Draw details in multiple layouts and sort orders; **blank scoring sheets, printable in advance of any round** — they double as the pen-and-paper fallback kit ([5.8](#area-5--scoring), [decisions.md D3](decisions.md#d3--failure-policy-pen-and-paper-reconcile-at-the-base)). |
| 7.4 Score Cards & Records | Printable per-pilot score cards and records. |

---

## Future Enhancements

Deferred beyond the MVP. Captured here so they aren't lost; promote into the
areas above when scoped.

**Master data**
- Models & Devices — pilot aircraft / onboard-device records.
- Roles — flying/non-flying personnel roles, role-based entry eligibility.

**Attribution & identity** *(MVP: no auth — [decisions.md D1](decisions.md#d1--trust-model-small-known-trusted-group)/[D4](decisions.md#d4--immutable-event-log);
operator **name-pick** on companion clients is **in MVP** per D4)*
- **Scorer identity capture** on the hand-held devices (initials or device
  pairing) to populate the event log's actor-identity field, which devices
  default to "unknown".
- **Authentication** of operators (login, OIDC) — verifying, not just
  recording, who acts. Note OIDC requires a reachable identity provider,
  which conflicts with offline-first ([decisions.md D6](decisions.md#d6--offline-first-buffer-and-sync-publish-when-connected))
  unless one runs locally on the base.

**Teams** *(MVP is individual-only)*
- Team entry and the `omit-from-team-score` per-entry attribute.
- Team separation as a draw fairness constraint.
- Team classification and team-oriented reporting (with the deferred
  [Team Manager](users.md#deferred-beyond-the-mvp) role).

**Frequency management** *(MVP assumes all competitors on 2.4 GHz spread-spectrum)*
- Per-entry frequency allocation (single or multiple frequencies per pilot).
- Frequency-aware draw grouping and spacing — including the
  "frequency-follows-frequency" grouping used by F3B/F3J/F3K.

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
  First concrete case: the local F3B scene's **existing custom wireless
  lap-count / speed-time system** (its own Raspberry-Pi base station) —
  ultimately the Base Station ingests those metrics per pilot from it; in
  the MVP its readouts are **manually cross-entered on the hand-held
  devices** ([physical architecture §9](../architecture/physical-architecture.md#9-adjacent-system--the-local-f3b-lapspeed-timing-rig)).
- *Pilots scoring their own flights is **out of scope** — a conflict of interest.*

**Fly-offs & progressive draws** *(MVP is qualifying rounds only)*
- Fly-off competitions — a final flown as a single group of the top qualifiers,
  linked to their qualifier (was part of 3.1).
- Progressive / seeded draws — draws where later rounds (e.g. a fly-off re-draw)
  are seeded from prior-round scores rather than the anti-repeat matrix (was 4.5).
- Combined preliminary + fly-off reporting (was part of 7.2).

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
- Live-scoring public web page — real-time contest progress when internet is
  available (the system itself stays offline-first,
  [decisions.md D6](decisions.md#d6--offline-first-buffer-and-sync-publish-when-connected)).
- Email distribution of reports and links.

**System & cross-cutting**
- Data integrity & backup (backup/restore/safeguard).
- Multi-discipline entry (one pilot across multiple disciplines).
- Standards & compliance (governing-body rules, standard code lists).
- Help & onboarding (in-context help, tutorials).

---

## Notes for future work

- **Display/Timer/Audio (Area 6)** is **confirmed and in MVP scope** — field board
  + loudspeakers, an automatic in-group phased sequence (prep → working →
  landing) for duration-shaped tasks, **operator-driven group/round boundaries**
  ([decisions.md D10](decisions.md#d10--operator-driven-progression-automation-runs-only-inside-a-group)),
  and Contest-Director run control. The earlier "unconfirmed
  stub" status is resolved.
- **Task scoring (3.7 / 5.2)** is intentionally generic; the bulk of detail lives
  in the deferred **per-discipline** requirements — flesh those out one
  discipline at a time.
