# Soarscore — User Stories: Contest Director

The **Contest Director** is the **officiating authority**: where the
[Organiser](01-organiser.md) sets the contest up and does the administrative
mechanics, the Director decides how it proceeds and makes the rulings that
**change results** — accepting or re-drawing the draw, imposing penalties,
authorising re-flights and group changes, retiring and reinstating pilots,
locking the competition, and publishing the official result. Often the same
person as the Organiser in practice, but a distinct role with the highest
privilege.

**Scope.** MVP only. These stories flesh out the Director's areas from
[`users.md §2`](../requirements/users.md#2-contest-director):

- **Area 2.2** — lock the competition against further changes
- **Area 3 (mid-contest changes)** — authorise configuration changes after the
  contest has started, with stated recompute consequences
- **Area 4.3** — validate the draw's fairness and accept or re-draw
- **Area 5.3 (authority slice)** — approve re-flights and group changes; move a
  pilot between groups for readiness; approve the per-contest lone-pilot dummy
  override where a class rule would annul instead
- **Area 5.9** — impose penalties, with correct recompute
- **Area 5.5** — retire and reinstate pilots, re-drawing remaining rounds
- **Area 5.7** — resolve a no-scored (did-not-fly) pilot: move to a later group,
  retire, or let it auto-zero at round end
- **Area 6.5** — run-control authority over a running group (prep
  pause/fast-forward/add-time, prep-gate override, abort/restart)
- **Area 7** — publish official results

**Role boundary.** These are **decision / authority / lock / publish** stories.
The **administrative mechanics** — building the draw, entering corrections,
moving the pilot data, executing the dummy insertion — are the
[Organiser's](01-organiser.md); where the two roles meet, the story below covers
only the **authority half** and notes the handoff. Live capture (5.0/5.1/5.2) is
the [Scorer's](../requirements/users.md#3-scorer); field aids (Area 6) are
*operated* by the
[Announcer/Timekeeper](../requirements/users.md#4-announcer--timekeeper-field-aid-operator),
and the Director holds only the run-control **authority** slice
([6.5](#65--run-control-authority-over-a-running-group)) — prep pause/fast-forward,
gate override, abort.

Stories are **high-level and implementation-agnostic** — they describe *what*
authority the Director exercises and *what must recompute*, not any screen,
framework or store. Rule-bound stories stay consistent with
[`docs/requirements/rules/`](../requirements/rules/), which is authoritative and
read-only. Open questions and possible conflicts are collected in
[Conflicts & questions for the user](#conflicts--questions-for-the-user).

---

## Area 2 — Competition Lifecycle

### 2.2 — Lock the competition against further changes

**As the** Contest Director, **I want** to lock the competition once I am
satisfied the results are final, **so that** no further change can alter the
outcome while reports remain available for anyone to read.

**Acceptance criteria**
- [ ] Given a competition I have judged complete, when I lock it, then it is
  frozen against further changes — no score correction, penalty, re-flight,
  group change, retirement or re-draw can be applied while it is locked.
- [ ] Given a locked competition, when any user (Organiser or Scorer) attempts a
  mutating action, then the action is prevented and they are told the
  competition is locked ([users.md §1](../requirements/users.md#1-organiser)
  respects this state; the Organiser's [2.1] delete is likewise blocked).
- [ ] Given a locked competition, when I or any user request **reports**, then
  all results and draw reports remain fully available (lock freezes change, not
  read — [2.2](../requirements/high-level-requirements.md#area-2--competition-lifecycle)).
- [ ] Given a locked competition, when its state is shown, then it is clearly
  marked as locked so no one mistakes it for still-editable.
- [ ] Given a locked competition in which I find an error, when I **unlock** it,
  then it returns to an editable state so a correction can be made — this is the
  **Director's authority only**; no other role can unlock, and lock stays one-way
  for everyone else.
- [ ] Given I unlock (and later re-lock) a competition, when the action is
  applied, then it is **attributable** to me so a post-lock correction stays
  defensible, and any already-published result must be **re-published** after the
  correction (see [7](#7--publish-official-results)).
- [ ] Given the contest **ends early** (e.g. weather kills day two), when I lock
  it with fewer completed rounds than the **class rules' minimum for a valid
  contest** (per the [per-class rule docs](../requirements/rules/) — e.g. 4 for
  F3J/F5J, 5 for F3K), then it is finalised as a **no-contest**: locked, **no
  official results** produced, and the captured data and event log retained.
- [ ] Given the contest ends early but the class minimum **is** met, when I lock
  it, then locking is legal at that round count, the final reports **state the
  rounds flown**, and drop-worst applies **only if the class threshold is
  passed** ([general-rules §5](../requirements/rules/00-general-rules.md#5-final-classification-common)).

**Traces to:** area 2.2 · users.md §2 Contest Director
**Notes:** Lock is the Director's authority, **not** the Organiser's — the
Organiser stories only *respect* the locked state. Unlock is **Director-only**
and attributable; a correction made after unlocking forces a re-lock and a
re-publish. **Publishing (7) requires a lock first**, so the official result is
always a frozen snapshot — see [7](#7--publish-official-results).

---

## Area 3 — Competition Setup (authority slice)

### 3 (mid-contest) — Authorise a mid-contest configuration change

**As the** Contest Director, **I want** any configuration change after the first
round has started (e.g. a wrong target time discovered in round 3) to require my
authority, with its recompute consequences stated before it applies, **so that**
already-flown rounds are never silently rescored.

**Acceptance criteria**
- [ ] Given the first round has started, when anyone attempts a change to
  configuration that affects scoring or running (draw options, scoring options,
  task rules, field-aid timings —
  [3.5–3.8](../requirements/high-level-requirements.md#area-3--competition-setup--configuration)),
  then it does **not take effect without my authorisation**.
- [ ] Given a proposed change, when I review it, then the system **states which
  rounds' scores would recompute** as a consequence — before anything is
  applied.
- [ ] Given my authorisation, when the change applies, then it applies **from
  the next round onward by default**; recomputing **already-flown rounds**
  happens only on my **explicit opt-in**, never silently.
- [ ] Given I opt in to recomputing flown rounds, when scores recompute, then
  the affected groups re-normalise and round/final scores update consistently
  (as for any recompute — [00-general-rules §3–5](../requirements/rules/00-general-rules.md)).
- [ ] Given any mid-contest change (and my authorisation or refusal), when it is
  processed, then it is recorded in the **event log**
  ([decisions.md D4](../requirements/decisions.md#d4--immutable-event-log)) and
  attributable, so the result stays defensible.
- [ ] Given a proposed change that would **contravene a class rule**, when I
  review it, then I am warned (the rule docs are authoritative — the same
  guardrail as [Organiser 3.6](01-organiser.md#36--configure-scoring-options)).

**Traces to:** area 3 (mid-contest changes) · users.md §2 Contest Director
**Notes:** Before the first round starts, configuration is the **Organiser's**
free-hand setup ([Area 3](01-organiser.md#area-3--competition-setup--configuration));
this story begins where flying begins. Roster changes after the draw are
handled by [3.4](01-organiser.md#34--build-and-edit-the-roster) /
[5.5](#55--retire-and-reinstate-pilots-re-drawing-remaining-rounds), not here.
Distinct from **manual score override** ([5.8](../requirements/high-level-requirements.md#area-5--scoring)),
which corrects a captured value rather than the rules it was scored under.

---

## Area 4 — Draw & Rounds Generation

### 4.3 — Validate the draw's fairness and accept or re-draw

**As the** Contest Director, **I want** to review the generated draw's fairness
and either accept it or send it back to be re-drawn, **so that** the field flies
a draw I can defend if a competitor challenges it.

**Acceptance criteria**
- [ ] Given a draw the Organiser has generated ([4.2](01-organiser.md#42--generate-the-draw)),
  when I review it, then I see its **matchup distribution and fairness metric**
  so I can judge whether any two pilots meet more often than the draw allows
  ([00-general-rules §1](../requirements/rules/00-general-rules.md)).
- [ ] Given a draw I judge fair, when I **accept** it, then it becomes the draw
  the contest flies and downstream steps (lane adjustment, scoring) may proceed.
- [ ] Given a draw I judge unfair or otherwise unacceptable, when I **reject**
  it, then I can require a **re-draw** and the previously generated draw does not
  stand.
- [ ] Given scoring has **not** yet begun, when I reject and require a re-draw,
  then a fresh draw is produced for me to validate again — the accept/re-draw
  loop repeats until I accept.
- [ ] Given I have accepted a draw, when scoring begins against it, then the
  accepted draw is the authoritative flying order and is not silently replaced.

**Traces to:** area 4.3 · users.md §2 Contest Director
**Notes:** **Handoff:** *generating* the draw and *presenting* its fairness
evidence is the [Organiser's](01-organiser.md#42--generate-the-draw); the
**accept / re-draw decision is the Director's** — this story. **Manual lane
adjustment ([4.4](01-organiser.md#44--adjust-lane-allocations))** is the
Organiser's and must not alter the anti-repeat matrix, so it is not a re-draw.
Team-separation and frequency-follows-frequency constraints are **out of MVP
scope** (all 2.4 GHz, individual-only).

---

## Area 5 — Scoring (authority slice)

> The Director's slice of Area 5 is **authority**: authorising re-flights and
> group changes, approving the lone-pilot dummy override where a class would
> annul, imposing penalties, and retiring/reinstating pilots. The
> **administrative mechanics** (moving the pilot data, executing the dummy
> insertion, capturing the re-flight result) are the
> [Organiser's](01-organiser.md#53--manage-groups-and-prepare-re-flights);
> **live capture** (5.0/5.1/5.2) is the
> [Scorer's](../requirements/users.md#3-scorer). Every recompute below must be
> **correct and consistent** — that is the point of the Director's authority.

### 5.3 — Approve re-flights and group changes

**As the** Contest Director, **I want** to authorise re-flights, group creations,
splits and moves that the Organiser prepares, **so that** the running order can
adapt to real-world disruption only under my authority, with results recomputing
correctly.

**Acceptance criteria**
- [ ] Given the Organiser has prepared a re-flight or group change
  ([5.3](01-organiser.md#53--manage-groups-and-prepare-re-flights)) with its
  clash checks run, when I **approve** it, then it takes effect; when I
  **decline** it, then the running order is unchanged.
- [ ] Given a re-flight I have approved, when its new result is captured, then
  scoring **recomputes consistently** for the affected group and round — the
  group re-normalises to its best raw result = 1000
  ([00-general-rules §3](../requirements/rules/00-general-rules.md)) and the
  affected pilots' round and final scores update.
- [ ] Given the re-flight was flown in a new group of re-flyers or with the
  original group at the end of the round, when scores compute, then the pilot(s)
  **allocated the re-flight** take the re-flight result as their official score
  **even if worse**, while every other pilot in that group takes the **better
  of** their original flight and the re-flight
  ([00-general-rules §7](../requirements/rules/00-general-rules.md#7-re-flights-common-pattern));
  a filler is not granted a further re-flight if the re-flight itself is
  hindered.
- [ ] Given a proposed change that a clash check has flagged as violating a draw
  constraint, when I review it, then I see the reason before deciding, and I do
  not approve an invalid change unknowingly.
- [ ] Given any approval I make, when it is applied, then it is
  **attributable/auditable** (that the Director authorised it) so the result
  stays defensible.

**Traces to:** area 5.3 · users.md §2 Contest Director
**Notes:** **Handoff:** the Organiser *prepares and executes* the mechanics; the
Director *authorises*. Distinct from a **pilot-readiness group move** (next
story, no re-draw) and from **retirement (5.5)**, which *does* re-draw remaining
rounds.

### 5.3 — Move a pilot between groups for readiness (no re-draw)

**As the** Contest Director, **I want** to reassign a pilot from one group to
another because they are not ready to fly their drawn group, **so that** the
event keeps moving without regenerating the draw or disturbing everyone else's
groupings.

**Acceptance criteria**
- [ ] Given a pilot who cannot fly their drawn group, when I move them to another
  group in the same round, then the move **does not regenerate the draw** — it
  does not invoke the [Area 4](01-organiser.md#41--specify-the-draw) anti-repeat
  matrix and leaves all other pilots' groupings untouched
  ([5.3](../requirements/high-level-requirements.md#area-5--scoring)).
- [ ] Given the move, when it is applied, then only the moved pilot's group
  membership changes; already-scored groups and rounds are preserved and
  recompute only where that pilot's normalisation is affected.
- [ ] Given a move that would leave a group with a **single scoring pilot**, when
  I apply it, then the **lone-pilot safeguard** applies (see the dummy-override
  story) rather than the pilot being auto-awarded 1000.
- [ ] Given a move that clashes (e.g. the pilot already flew, or the target group
  is closed), when I attempt it, then it is flagged and prevented.

**Traces to:** area 5.3 · users.md §2 Contest Director
**Notes:** A readiness move is explicitly **not** a re-draw — contrast
[5.5 retirement](#55--retire-and-reinstate-pilots-re-drawing-remaining-rounds),
which re-draws the remaining rounds. Keep this distinction observable so results
recompute the right way for each.

### 5.3 — Approve the lone-pilot dummy override where a class annuls

**As the** Contest Director, **I want** to approve — scoped to this one contest —
inserting a dummy for a lone-pilot group in a class whose rule would otherwise
**annul** the group, **so that** the safeguard against an unearned 1000 is
applied deliberately and only where I permit, without contravening the class
rule.

**Acceptance criteria**
- [ ] Given a group resolves to a **single scoring pilot** and the draw could not
  avoid it ([4.2](01-organiser.md#42--generate-the-draw)), when the class uses
  the general lone-pilot safeguard, then a **randomly-chosen dummy** from the
  other pilots is inserted for the lone pilot to be normalised against so they
  are **not auto-awarded 1000**
  ([00-general-rules §3](../requirements/rules/00-general-rules.md)) — this
  requires **no** Director approval and the dummy's flight **does not count**
  toward that pilot's own score.
- [ ] Given a class whose rule dictates a **different outcome** — e.g. **F3B
  annuls a one-valid-result group** ([f3b.md](../requirements/rules/f3b.md)) —
  when a lone-pilot group arises, then the dummy is **not** applied
  automatically; the system **warns** and blocks until I decide.
- [ ] Given such a warning, when I give **explicit approval scoped to this one
  contest**, then the dummy override is applied for that group; when I do not,
  then the class's annulment stands.
- [ ] Given my approval (or refusal), when it is recorded, then it is
  **attributable** to me and scoped to this contest only, so it is not silently
  reused elsewhere.

**Traces to:** area 5.3 · users.md §2 Contest Director
**Notes:** **Handoff:** the Organiser *executes* the dummy insertion; the
**override where a class would annul is the Director's to approve**
([5.3](../requirements/high-level-requirements.md#area-5--scoring)). This must
never be applied against a class rule without my explicit, contest-scoped
approval — the rule docs are authoritative.

### 5.9 — Impose penalties with correct recompute

**As the** Contest Director, **I want** to impose point penalties (up to
disqualification) for infringements, dangerous flying, cheating or unsporting
behaviour, **so that** rule-breaking is reflected in the result exactly as the
rules require.

**Acceptance criteria**
- [ ] Given an infringement, when I impose a point penalty, then it is recorded
  **against the round in which it occurred** and is **cumulative** across the
  contest ([00-general-rules §6](../requirements/rules/00-general-rules.md)).
- [ ] Given one or more penalties, when the final result computes, then they are
  **deducted from the final aggregate**, not from a single normalised group score
  ([00-general-rules §5](../requirements/rules/00-general-rules.md)).
- [ ] Given a penalty in a round that is later **dropped** by the class's
  drop-worst rule, when the final result computes, then the **penalty is
  retained** even though its round is discarded
  ([00-general-rules §5](../requirements/rules/00-general-rules.md)) — e.g. F5J
  drops the lowest round beyond 4, F3K beyond 6, F5K beyond 7, F5L beyond 5, F3B
  discards the lowest partial per task beyond 5, and **F3J drops the lowest
  round beyond 7** (per the per-class docs).
- [ ] Given penalties that would take a competitor's total **below zero**, when
  the result computes, then the total is recorded as **zero** and the penalties
  still stand ([00-general-rules §6](../requirements/rules/00-general-rules.md)).
- [ ] Given a **disqualification**, when I apply it, then it is reflected in the
  final classification per the rule, distinct from an ordinary point deduction.
- [ ] Given any penalty I impose or revoke, when it is applied, then it is
  **attributable** to me and results recompute immediately and consistently.

**Traces to:** area 5.9 · users.md §2 Contest Director
**Notes:** Penalties are the **Director's** ruling, distinct from the Organiser
correcting a captured task metric
([5.4](01-organiser.md#54--review-and-correct-scores-by-pilot)). It is also
distinct from the **task-integral deductions** a
[Scorer](03-scorer.md#523--record-task-integral-deductions-the-flight-incurs)
records at the line (land-outs, the model contacting a person, working-time
overruns, a zero'd flight): those are part of scoring the flight, whereas the
**discretionary disciplinary penalties** in this story — unsporting behaviour,
cheating, dangerous flying, up to disqualification — are the Director's alone and
are never entered on a Scorer device. The penalty-survives-the-drop behaviour is
the central recompute invariant here and must be testable. Class-specific penalty
*amounts* live in the per-class rule docs and are authoritative.

### 5.5 — Retire and reinstate pilots, re-drawing remaining rounds

**As the** Contest Director, **I want** to retire a pilot (and reinstate them if
needed), re-drawing the remaining rounds to exclude or re-include them, **so
that** the draw stays fair for the rounds still to fly while everything already
scored is preserved.

**Acceptance criteria**
- [ ] Given a pilot who must stop competing, when I **retire** them, then the
  **remaining, unflown rounds are re-drawn to exclude them**
  ([5.5](../requirements/high-level-requirements.md#area-5--scoring)) while
  **already-scored rounds are preserved unchanged**.
- [ ] Given retirement re-draws remaining rounds, when the re-draw runs, then it
  honours the same fairness/anti-repeat intent as the original draw
  ([00-general-rules §1](../requirements/rules/00-general-rules.md)) for the
  pilots who remain.
- [ ] Given a retired pilot, when results compute, then their **scored rounds
  still count in their aggregate** and any **penalties they incurred are
  retained** ([00-general-rules §5–6](../requirements/rules/00-general-rules.md)),
  and any group they had already been normalised within is unaffected.
- [ ] Given a retired pilot, when I **reinstate** them, then the remaining
  unflown rounds are re-drawn again to re-include them, still preserving all
  scored rounds.
- [ ] Given a reinstated pilot, when results compute, then rounds that were
  **flown while they were retired** (and re-drawn to exclude them) are **not
  eligible as a drop-worst round** for them and are **excluded from their
  aggregate** — they had no opportunity to fly those rounds, so the class
  drop-worst count applies only to rounds they could fly (per-class docs).
- [ ] Given retirement removes a pilot such that a remaining group would fall to
  a **single scoring pilot**, when the rounds are re-drawn, then the re-draw
  **avoids** the single-pilot group where it can, and where it cannot the
  lone-pilot safeguard applies.

**Traces to:** area 5.5 · users.md §2 Contest Director
**Notes:** Retirement **does** re-draw remaining rounds — the key contrast with a
**pilot-readiness move** (which does not). On reinstatement, rounds flown *while
the pilot was retired* are **excluded from their aggregate and not eligible as a
drop-worst round** (they had no chance to fly them). The Organiser's roster view
**reflects** the retired state and does not silently re-add a retired pilot
([3.4](01-organiser.md#34--build-and-edit-the-roster)).

### 5.7 — Resolve a no-scored (did-not-fly) pilot

**As the** Contest Director, **I want** a pilot who did **not fly** their group (a
**no-score**) to still get a fair chance to fly the round, **so that** "did not
fly" does not silently become a zero while groups remain.

**Acceptance criteria**
- [ ] Given a pilot holds a **no-score** for the round — a Scorer marked *cannot
  make the group* ([5.0](03-scorer.md#504--pre-group-confirmation-guard-blocks-entry-until-re-confirmed)),
  or I overrode the prep gate ([6.5](#65--run-control-authority-over-a-running-group))
  — when groups remain in the round, then I can **move them into a later group**
  via a [pilot-readiness move](#53--move-a-pilot-between-groups-for-readiness-no-re-draw)
  (no re-draw) so they fly the round.
- [ ] Given a no-scored pilot I judge cannot continue, when appropriate, then I may
  **retire** them ([5.5](#55--retire-and-reinstate-pilots-re-drawing-remaining-rounds)).
- [ ] Given a no-score that is **not** resolved and **no groups remain** in the
  round for that pilot, when the round ends, then it **auto-converts to a zero**
  ([5.7](../requirements/high-level-requirements.md#area-5--scoring)) — a
  *flew-and-scored-zero* is different from *did-not-fly*, and only this
  end-of-round conversion crosses that line.
- [ ] Given the distinction matters for results, when a no-score stands
  unresolved, then the **round cannot be advanced**
  ([6.4](04-announcer-timekeeper.md#64--advance-to-the-next-round-only-when-scoring-is-complete))
  while the pilot could still be moved into a remaining group.

**Traces to:** area 5.7 · users.md §2 Contest Director
**Notes:** A **no-score** (did not fly) is distinct from a **zero** (flew, scored
zero). Resolution reuses the Director's existing tools — the readiness move (5.3)
and retirement (5.5); the only automatic step is the **end-of-round conversion to
zero** when no groups remain. Marking *cannot make the group* is the
[Scorer's](03-scorer.md) device action; the CD's authority creates a no-score only
via the **"pilot unconfirmed"** form of the
[prep-gate release](#65--run-control-authority-over-a-running-group) — the
**"device offline"** form applies no no-score.

---

## Area 6 — Field Run Control (authority slice)

> The Director's slice of Area 6 is **authority over a running group** — holding,
> shortening or extending preparation, overriding the prep confirmation gate, and
> aborting a group. The **operational running** of the clock, callouts and board is
> the [Announcer/Timekeeper's](04-announcer-timekeeper.md); at a small contest one
> person may hold both. Working time and the landing window run to their configured
> durations and are **not** the Director's to pause or shorten.

### 6.5 — Run-control authority over a running group

**As the** Contest Director, **I want** authority over how a running group is held
and adjusted — pausing or fast-forwarding preparation, overriding the prep
confirmation gate, and aborting a group — **so that** I can keep the event moving
and resolve real-world holds without contravening the fixed working-time and
landing-window durations.

**Acceptance criteria**
- [ ] Given a group in **preparation** (or the inter-group gap before it), when I
  **pause** it, then the countdown holds until I **resume** — and I **cannot**
  pause **working time or the landing window**, which run to their configured
  durations ([6.1](04-announcer-timekeeper.md#area-61--timer--phases)).
- [ ] Given a group in preparation where everyone is ready, when I
  **fast-forward**, then each invocation removes **one minute**, but the countdown
  can **never drop below one minute remaining**.
- [ ] Given a competitor is not ready, when I **add time**, then each invocation
  adds **one minute** to the preparation countdown.
- [ ] Given the prep **confirmation gate** has paused the countdown at one minute
  because not every Scorer has confirmed their pilot
  ([5.0.4](03-scorer.md#504--pre-group-confirmation-guard-blocks-entry-until-re-confirmed)),
  when the blocking device is shown as **offline** (its sync-state indicator on
  the Base Station group view) and I release the gate as **"device offline"**,
  then the group proceeds with **no no-score** — the device's buffered
  confirmation reconciles when it syncs
  ([scorer-device.md §4](../requirements/scorer-device.md#4-prep-gate-vs-an-offline-device-a1)).
- [ ] Given the gate is held because a pilot genuinely is **not confirmed**
  (device online, no confirmation), when I release the gate as **"pilot
  unconfirmed"**, then the group proceeds and that pilot takes a **no-score**
  ([5.7](#57--resolve-a-no-scored-did-not-fly-pilot)).
- [ ] Given either release form, when I choose it, then the two are **distinct
  actions** — the system never converts a comms fault into a no-score on its
  own, and my choice is recorded (which form, which pilots/devices).
- [ ] Given a range hold or other disruption mid-working-time, when I **abort the
  group**, then it **restarts from preparation** and any times/metrics already
  captured for that group are **annulled**.
- [ ] Given any of these actions, when applied, then they are **attributable** to
  me; the operational start/hold of the clock itself is the
  [Announcer/Timekeeper's](04-announcer-timekeeper.md), while these authority
  actions are mine.

**Traces to:** area 6.5 · users.md §2 Contest Director ·
[00-general-rules §1–2](../requirements/rules/00-general-rules.md)
**Notes:** Fast-forward and add-time act on **preparation only**; the abort is the
one control that reaches into a running working time, and it **discards** the
group's data rather than editing it. The prep gate's other release paths (all
Scorers confirm, or a Scorer marks *cannot make the group*) are not the Director's
— only the **override** is.

---

## Area 7 — Reports

### 7 — Publish official results

**As the** Contest Director, **I want** to publish the official, final results,
**so that** pilots and the public read an authoritative outcome I stand behind.

**Acceptance criteria**
- [ ] Given results I judge final, when I attempt to publish, then the
  competition must be **locked ([2.2](#22--lock-the-competition-against-further-changes))
  first** — publishing an unlocked competition is not allowed, so the official
  result is always a frozen snapshot.
- [ ] Given a locked competition, when I **publish** it, then the result is marked
  as the **official** result, distinct from the in-progress reports the Organiser
  produces at any stage ([7.1](01-organiser.md#71--produce-results-reports)).
- [ ] Given published results, when they are presented, then they are in **final
  classification order, winner first**, with **drop-worst applied** and
  **penalties retained** per the rules
  ([00-general-rules §5](../requirements/rules/00-general-rules.md)).
- [ ] Given a published result that I later **correct** (unlock → correct →
  re-lock, per [2.2](#22--lock-the-competition-against-further-changes)), when the
  correction is made, then the earlier published result is superseded and I must
  **re-publish** so the official result matches the corrected, re-locked
  computation.
- [ ] Given the contest is still proceeding, when a round completes, then its
  results are available to read as the contest proceeds
  ([00-general-rules §5](../requirements/rules/00-general-rules.md)); publishing
  the **official** result is my distinct, final act.
- [ ] Given I publish, when a pilot reads the result, then it matches the locked
  computation — the published output cannot disagree with the results the system
  computed.

**Traces to:** area 7 · users.md §2 Contest Director
**Notes:** **Handoff:** the Organiser *produces* reports
([7.1/7.3/7.2/7.4](01-organiser.md#71--produce-results-reports)); **publishing
the official result is the Director's authority**. Publish **requires a lock**,
and a post-lock correction forces a **re-publish**
([2.2](#22--lock-the-competition-against-further-changes)). Output channels
(PDF/CSV/online), email distribution and badges are **Future Enhancements** —
publishing here means declaring the authoritative result, not a specific
distribution mechanism.

---

## Coverage self-check

Every Contest Director task in
[`users.md §2`](../requirements/users.md#2-contest-director) is covered:

- Authorise mid-contest configuration changes (Area 3) → **3 (mid-contest)**
- Validate the draw's fairness and accept or re-draw (4.3) → **4.3**
- Impose penalties for infringements (5.9) → **5.9**
- Approve re-flights and group changes (5.3) → **5.3 (approve re-flights)**
- Move a pilot between groups for readiness — no re-draw (5.3) → **5.3
  (readiness move)**
- Approve the per-contest lone-pilot dummy override where a class annuls (5.3) →
  **5.3 (dummy override)**
- Retire and reinstate pilots (5.5) → **5.5**
- Resolve a no-scored (did-not-fly) pilot (5.7) → **5.7**
- Run-control authority over a running group (6.5) → **6.5**
- Lock the competition (2.2) → **2.2**
- Publish official results (7) → **7 (publish)**

Every story is a **decision / authority / lock / publish** story; the
administrative mechanics (draw generation 4.1/4.2, lane adjustment 4.4, score
correction 5.4, validation 5.6, dummy-insertion execution, report production)
are noted as **Organiser handoffs**. Recompute behaviour — penalty-survives-drop,
re-flight re-normalisation, retirement re-draw preserving scored rounds — is
observable in acceptance criteria. No story depends on a Future-Enhancement
capability (teams, jury/protest, series, fly-offs). Every story cites its area.

---

## Conflicts & questions for the user

Items 1–3 were raised in the first draft and have since been **resolved with the
user**; the resolutions are reflected in the stories above. Item 4 needs no
change and is flagged for per-discipline work.

1. **Lock reversibility (2.2) — resolved, applied.**
   [2.2](../requirements/high-level-requirements.md#area-2--competition-lifecycle)
   defined lock but said nothing about **un-locking**. Resolution: the **Director
   (only) may unlock** to make a late correction, with the unlock/re-lock recorded
   as attributable; lock stays one-way for all other roles. Story
   [2.2](#22--lock-the-competition-against-further-changes) is written to this.

2. **Lock vs publish ordering (2.2 / 7) — resolved, applied.** Resolution:
   **results must be locked before they can be published**, so the official result
   is always a frozen snapshot; if a competition is **corrected after lock**
   (unlock → correct → re-lock), it **must be re-published**. Stories
   [2.2](#22--lock-the-competition-against-further-changes) and
   [7](#7--publish-official-results) are written to this.

3. **Reinstatement and rounds flown while retired (5.5) — resolved, applied.**
   Resolution: a retired pilot's rounds **flown while they were retired** are
   **not eligible as a drop-worst round** and are **excluded from their
   aggregate** — they had no opportunity to fly them, so the class drop-worst
   count applies only to rounds they could fly. Story
   [5.5](#55--retire-and-reinstate-pilots-re-drawing-remaining-rounds) is written
   to this.

4. **Disqualification vs point penalty (5.9) — no change needed,
   flagged.** [00-general-rules §6](../requirements/rules/00-general-rules.md) lets
   the Director impose penalties **up to disqualification**. Point penalties have a
   clear recompute (deduct from aggregate, floor at zero, survive the drop); a
   **disqualification** is a different kind of outcome (removal from
   classification, not a deduction). Story 5.9 covers both but keeps
   disqualification distinct; the precise disqualification placement in the final
   classification is left to per-discipline detail rather than resolved here.
</content>
</invoke>
