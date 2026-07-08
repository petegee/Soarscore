# Soarscore — User Stories: Pilot / Competitor

> 👤 **The Pilot is an _indirect_ user.** In the MVP the pilot does **not operate
> the software** and does **not enter their own data**. Their flight is recorded
> **by the Scorer** standing beside them; the pilot **reads** the draw and
> results, **cross-checks** (before the group starts) that the Scorer's device is
> set to their name, and **provides/confirms** their own entry details. Pilots
> **never self-score** — a conflict of interest — and this is **permanent**, not a
> Future Enhancement
> ([`users.md §5`](../requirements/users.md#5-pilot--competitor)).

The pilot is the reason the contest exists, but every need below is met **through
the system and the officials**, not by the pilot pressing buttons. Each story is
framed as an **outcome the system must make available** to the pilot — via the
roster, the field aids, the published draw, and the results — with the mediating
role named. The pilot's only active verbs are **read**, **cross-check**, and
**provide/confirm their own entry details**.

**Scope.** MVP only. These stories flesh out the Pilot's touch-points from
[`users.md §5`](../requirements/users.md#5-pilot--competitor) and the
[logical architecture](../architecture/logical-architecture.md), where the pilot
reads the **published draw & results** and cross-checks a Scorer device, but never
self-scores:

- **Area 3.4** — Roster Entry: confirm their own entry details (class, start
  number) are right; the [Organiser](01-organiser.md) maintains the roster.
- **Area 5.0 / 5.2** — the pilot's **cross-check** half — verify, before the group
  begins, that the adjacent Scorer's device is set to their name — and assurance
  their flight is **recorded against them** by the [Scorer](03-scorer.md).
- **Area 6.2 / 6.3** — hear the round / group / pilot announcements and read the
  field board, to know **whether they are in the current group** and how the
  working time is running.
- **Area 7.1 / 7.3 / 7.4** — read the **draw and flying order** (when / which group
  / which lane) and **correct, transparent results** (position, round-by-round
  breakdown, drop-worst applied correctly, penalties visible).

**Role boundaries — not crossed here.** The pilot does **not** operate setup, the
draw, score capture, run control, or admin — those are the
[Organiser](01-organiser.md) / [Contest Director](02-contest-director.md) /
[Scorer](03-scorer.md) / [Announcer/Timekeeper](04-announcer-timekeeper.md) roles.
In particular, the **device binding and the pre-group confirmation guard** are the
**Scorer's** ([5.0.2](03-scorer.md#502--confirm-the-selected-pilot-before-the-group-starts),
[5.0.4](03-scorer.md#504--pre-group-confirmation-guard-blocks-entry-until-re-confirmed));
these stories write only the pilot's **cross-check** half. **Draw fairness** is
produced by the Organiser/Contest Director (Area 4); the pilot only **reads** the
result and relies on it.

Stories are **high-level and implementation-agnostic** — _what outcome_ the pilot
must be able to obtain, never a specific screen, app or channel. Rule-bound
stories (results) stay consistent with
[`docs/requirements/rules/`](../requirements/rules/), which is authoritative and
read-only.

---

## Area 3.4 — Confirm own entry details (via the roster)

### 3.4 — Confirm my entry details are correct

**As a** Pilot / Competitor, **I want** to be able to confirm that my entry
details on the roster — my name, class and start number — are right, **so that** I
fly and am scored under the correct identity and there are no attribution
surprises later.

**Acceptance criteria**
- [ ] Given the competition roster
  ([Organiser 3.4](01-organiser.md#34--build-and-edit-the-roster)), when it is
  published or made viewable, then it shows **my name and the entry attributes
  that apply to me** — my **start number** and **class** where those options are
  enabled ([3.3](../requirements/high-level-requirements.md#area-3--competition-setup--configuration)) —
  so I can check they match what I provided.
- [ ] Given I spot a detail that is wrong, when I raise it, then the **Organiser**
  can correct it on the roster on my behalf — I do **not** edit the roster myself;
  my role is to **provide/confirm**, theirs is to maintain.
- [ ] Given the roster changes before the draw (e.g. a late entry or a corrected
  start number), when it is re-published, then the corrected details are what the
  draw and later reports use, so my identity stays consistent downstream.

**Traces to:** area(s) 3.4 · users.md §5 Pilot / Competitor
**Notes:** The **Organiser** owns roster maintenance
([3.4](01-organiser.md#34--build-and-edit-the-roster)); the pilot only supplies
and confirms their own details. Start numbers and pilot classes are optional entry
features ([3.3](../requirements/high-level-requirements.md#area-3--competition-setup--configuration))
— where disabled, the pilot simply has no such attribute to confirm.

---

## Area 5.0 / 5.2 — Being scored: the pilot's cross-check

### 5.0 — Cross-check the Scorer's device is set to my name before the group starts

**As a** Pilot / Competitor, **I want** to be able to verify, before my group's
working time begins, that the Scorer beside me has their device set to **my**
name, **so that** I have assurance my flight will be recorded against me and not a
stale pilot carried over from the previous group.

**Acceptance criteria**
- [ ] Given the moment before a group starts, when I look at the device of the
  Scorer assigned to me, then the device **plainly shows the selected competitor**
  (name, and start number where enabled) so I can confirm it is **me** — this is
  the pilot-facing side of the Scorer's pre-group confirmation
  ([Scorer 5.0.2](03-scorer.md#502--confirm-the-selected-pilot-before-the-group-starts)).
- [ ] Given the device shows the **wrong** pilot, when I notice before the group
  starts, then I can prompt the **Scorer to re-select** me from the group's pilot
  list ([Scorer 5.0.3](03-scorer.md#503--re-select-the-pilot-between-back-to-back-groups))
  before any score is captured — the **Scorer owns the binding and the
  re-selection**; I only flag it.
- [ ] Given the preparation countdown **pauses at one minute remaining** until
  every pilot in the group has exactly one confirming device
  ([6.5](../requirements/high-level-requirements.md#area-6--display-timer--audio-field-aids)),
  when that hold is in effect, then it gives me a **defined window** to do this
  cross-check before working time can begin.

**Traces to:** area(s) 5.0 · users.md §5 Pilot / Competitor
**Notes:** The **device binding, the pre-group confirmation, and the guard against
a stale selection are the Scorer's**
([5.0.2](03-scorer.md#502--confirm-the-selected-pilot-before-the-group-starts),
[5.0.4](03-scorer.md#504--pre-group-confirmation-guard-blocks-entry-until-re-confirmed));
this story is only the pilot's **cross-check**. The pilot never operates the
device — verification is by looking, and any correction is made by the Scorer.

### 5.2 — Assurance my flight is recorded against me (I never self-score)

**As a** Pilot / Competitor, **I want** my flight's task metrics recorded on my
behalf by the Scorer and attributed to me, **so that** my result is captured
correctly without me ever entering or scoring my own flight.

**Acceptance criteria**
- [ ] Given my group flies, when the Scorer beside me captures my task metrics
  ([Scorer 5.1](03-scorer.md#area-51--score-entry),
  [5.2](03-scorer.md#area-52--task-scoring-screens)), then those entries are
  recorded **against me** — I do **not** enter, edit or self-score any of them
  ([`users.md §5`](../requirements/users.md#5-pilot--competitor)).
- [ ] Given I do not fly my group at all, when the Scorer marks that I **cannot
  make the group** ([Scorer 5.0.5](03-scorer.md#505--mark-that-the-pilot-cannot-make-the-group-no-score)),
  then this is recorded as a **no-score** — meaning _did not fly_, **distinct from
  a zero** _(flew and scored zero)_ — and I may still be moved into a later group
  in the round to fly
  ([5.7](../requirements/high-level-requirements.md#area-5--scoring)); it only
  becomes a zero at round end if no group remains for me.
- [ ] Given a correction is needed to a recorded value, when it is made, then it is
  made by the **Scorer** (within their window) or by the
  **Organiser/Contest Director** as score administration
  ([5.3](../requirements/high-level-requirements.md#area-5--scoring)/[5.4](../requirements/high-level-requirements.md#area-5--scoring))
  — never by me.

**Traces to:** area(s) 5.2, 5.0, 5.7 · users.md §5 Pilot / Competitor
**Notes:** This is the pilot's _passive_ side of scoring — the outcome (a correct,
attributed result) without any pilot operation. The **no-score vs zero**
distinction ([5.7](../requirements/high-level-requirements.md#area-5--scoring)) is
resolved by the [Scorer](03-scorer.md#505--mark-that-the-pilot-cannot-make-the-group-no-score)
and [Contest Director](02-contest-director.md); it matters to the pilot only in
that a missed group is not silently a zero while a re-fly is still possible.

---

## Area 6.2 / 6.3 — Knowing when I fly (audio + field board)

### 6.2 / 6.3 — Hear the announcements and read the board to know when and where I fly

**As a** Pilot / Competitor, **I want** to hear the round, group and pilot
announcements and read the field board, **so that** I know whether I am in the
current group, in what flying order, and how much working time remains — without
having to ask an official.

**Acceptance criteria**
- [ ] Given a group is about to run, when its sequence is announced over the
  speakers ([6.2](../requirements/high-level-requirements.md#area-6--display-timer--audio-field-aids)),
  then I hear the **round and group** and then the group's **pilots in flying order
  with name and start number**, so I can tell **whether I am in this group** and
  where I am in its order.
- [ ] Given my group is flying, when I read the **field board**
  ([6.3](../requirements/high-level-requirements.md#area-6--display-timer--audio-field-aids)),
  then it shows the **current round, group, phase** (preparation / working time /
  landing window) and the **remaining time** of that phase, big and
  daylight-readable from the flight line, so I know how the working time is
  running.
- [ ] Given working time is running, when the clock passes each minute and the
  final 30 seconds, then I hear the **per-minute** and **−30 s second-by-second**
  callouts and the **end-of-working-time horn**, and the **landing** / **all-down**
  calls, so I can time my flight and landing by ear.

**Traces to:** area(s) 6.2, 6.3 · users.md §5 Pilot / Competitor
**Notes:** The Announcer/Timekeeper **operates** these field aids
([04-announcer-timekeeper.md](04-announcer-timekeeper.md)); the pilot only
**consumes** them. Pilot names are **audio-only** (not on the board) and voiced by
**English text-to-speech** in the MVP
([6.2](../requirements/high-level-requirements.md#area-6--display-timer--audio-field-aids));
pronunciation of international names is an accepted MVP limitation.

---

## Area 7.1 / 7.3 / 7.4 — Reading the draw, flying order and results

### 7.3 — Read the draw and my flying order (when, which group, which lane)

**As a** Pilot / Competitor, **I want** to read the published draw, **so that** I
know for **every round** when I fly — in which group, in what flying order, and in
which lane — and can be ready at the line in time.

**Acceptance criteria**
- [ ] Given the draw is published
  ([Organiser 7.3](01-organiser.md#73--produce-draw-reports)), when I read it, then
  I can find **my group and flying position for every round**, so I know when I am
  up across the whole contest, not just the current round.
- [ ] Given lanes are allocated
  ([3.5](../requirements/high-level-requirements.md#area-3--competition-setup--configuration)/[4.4](../requirements/high-level-requirements.md#area-4--draw--rounds-generation)),
  when the draw shows my group, then it shows the **lane** I am assigned so I know
  where on the line to be.
- [ ] Given the draw is adjusted before flying (e.g. a lane reassignment or an
  entrant replacement), when it is re-published, then what I read reflects the
  **current** draw — I read only the published result and do **not** alter it.

**Traces to:** area(s) 7.3 (draw), 7.1 (flying order) · users.md §5 Pilot /
Competitor
**Notes:** The pilot is **read-only** to the draw. Producing and adjusting it is
the [Organiser's](01-organiser.md) (Area 4 / 7.3) under the
[Contest Director's](02-contest-director.md) authority. MVP has **no teams and no
frequency management** (all 2.4 GHz), so the pilot reads group/lane/order only —
no frequency slot
([general-rules §1](../requirements/rules/00-general-rules.md#1-pilot-assignment-to-groups-the-draw)).

### 7.1 / 7.4 — Read correct, transparent results

**As a** Pilot / Competitor, **I want** results that are correct, transparent and
promptly available — my position, my round-by-round breakdown, with drop-worst and
penalties applied correctly, **so that** I can see exactly how my placing was
arrived at and trust it.

**Acceptance criteria**
- [ ] Given results are published
  ([Organiser 7.1](01-organiser.md#71--produce-results-reports),
  [7.4](../requirements/high-level-requirements.md#area-7--reports)), when I read
  them, then they are presented in **final-classification order, winner first**,
  and I can find **my overall position** and **aggregate**
  ([general-rules §5](../requirements/rules/00-general-rules.md#5-final-classification-common)).
- [ ] Given my result, when I read the **round-by-round breakdown**, then I can see
  **each round's normalised group score** for me — where the best raw result in my
  group is **1000** and mine is scaled to it (inverted for speed tasks;
  **F3B normalises its three tasks separately**)
  ([general-rules §3](../requirements/rules/00-general-rules.md#3-group-score-normalisation)).
- [ ] Given the class applies **drop-worst**, when my aggregate is shown, then my
  **discarded (lowest) round is identifiable** and the aggregate reflects the
  discard; where the rounds flown are **at or below the class threshold** (e.g.
  7 or fewer in F3J, 4 or fewer in F5J), no round is dropped
  ([general-rules §5](../requirements/rules/00-general-rules.md#5-final-classification-common)).
- [ ] Given a **penalty** was imposed on me, when I read the results, then it is
  **visible** and **deducted from the final aggregate**, and it is **retained even
  if the round it occurred in is the dropped one**; an aggregate that would go
  negative is shown as **zero**
  ([general-rules §5](../requirements/rules/00-general-rules.md#5-final-classification-common),
  [§6](../requirements/rules/00-general-rules.md#6-penalties-common)).
- [ ] Given the contest is still under way, when a round completes, then **that
  round's results and the cumulative standings are readable on the master
  laptop's companion app** (e.g. on the clubhouse table) between rounds — and
  on the **MVP-optional read-only pilot-phone page** where the event serves it
  ([physical architecture §6](../architecture/physical-architecture.md#6-pilot-phones--optional-read-only-web-page)) —
  available as the contest proceeds, with no internet required; I do not have
  to wait for the whole contest to end to see my standing
  ([7.1](../requirements/high-level-requirements.md#area-7--reports);
  [general-rules §5](../requirements/rules/00-general-rules.md#5-final-classification-common)).

**Traces to:** area(s) 7.1, 7.4 · users.md §5 Pilot / Competitor ·
[general-rules §3, §5, §6](../requirements/rules/00-general-rules.md)
**Notes:** The pilot **reads** results; computing, correcting, locking and
publishing them are the [Organiser](01-organiser.md) /
[Contest Director](02-contest-director.md) roles (Areas 5, 2.2, 7). Every
acceptance criterion here is bound to the scoring rules — **best raw = 1000**,
class-specific **drop-worst**, and **penalties on the aggregate, retained through a
dropped round**.

### 7.3 / 4.3 — Assurance the draw is fair

**As a** Pilot / Competitor, **I want** assurance that the draw I fly under is
fair, **so that** I can trust I meet other competitors as evenly as the roster
allows and my matchups were not stacked.

**Acceptance criteria**
- [ ] Given the draw is generated with an **anti-repeat matrix** so any two pilots
  meet as few times as possible
  ([general-rules §1](../requirements/rules/00-general-rules.md#1-pilot-assignment-to-groups-the-draw),
  [4.2](../requirements/high-level-requirements.md#area-4--draw--rounds-generation)),
  when I read the published draw, then the fairness it embodies is something I can
  **rely on** without operating any tool myself.
- [ ] Given the **Contest Director validates and accepts (or re-draws)** the draw
  ([4.3](../requirements/high-level-requirements.md#area-4--draw--rounds-generation)),
  when the draw I fly under is published, then it is one that **passed that
  validation** — fairness is produced and vouched for by the officials, not by me.
- [ ] Given I believe a matchup looks wrong, when I raise it, then it is the
  **Contest Director's** call to review or re-draw
  ([4.3](02-contest-director.md)) — I read and question, I do not adjust the draw.

**Traces to:** area(s) 7.3, 4.3 · users.md §5 Pilot / Competitor ·
[general-rules §1](../requirements/rules/00-general-rules.md#1-pilot-assignment-to-groups-the-draw)
**Notes:** This is the pilot's **read/trust** side of a fairness that is produced
in **Area 4** by the [Organiser](01-organiser.md) (generate) and
[Contest Director](02-contest-director.md) (validate/accept). It deliberately does
**not** duplicate their capability — the pilot obtains **assurance**, not control.
Team-separation and frequency-spacing fairness constraints are **out of MVP scope**
(individual-only, all 2.4 GHz)
([general-rules MVP note](../requirements/rules/00-general-rules.md)).

---

## Conflicts & questions for the user

**None found.** Every Pilot task in
[`users.md §5`](../requirements/users.md#5-pilot--competitor) maps cleanly onto an
**indirect** capability — read, cross-check, or provide/confirm own details — with
no story that has the pilot operating setup, the draw, capture, run control or
admin, and no self-scoring. The results stories are consistent with
[`00-general-rules.md`](../requirements/rules/00-general-rules.md) (best raw =
1000, class-specific drop-worst, penalties on the aggregate and retained through a
dropped round). A few points recorded for the reader rather than as open
conflicts:

1. **Self-scoring is permanently out of scope**, not a Future Enhancement — a
   conflict of interest. Any future _remote_ scoring is for **officials**, not for
   pilots recording their own flights
   ([`users.md` Notes](../requirements/users.md#notes-for-future-work),
   [Future Enhancements](../requirements/high-level-requirements.md#future-enhancements)).
   The pilot stays indirect by design.
2. **The 5.0 cross-check is the pilot's half only.** The device binding, the
   pre-group confirmation and the stale-selection guard are the **Scorer's**
   ([5.0.2](03-scorer.md#502--confirm-the-selected-pilot-before-the-group-starts),
   [5.0.4](03-scorer.md#504--pre-group-confirmation-guard-blocks-entry-until-re-confirmed));
   these stories rely on those without re-specifying them.
3. **Draw fairness is read, not operated, by the pilot.** The pilot's assurance
   story ([7.3 / 4.3](#73--43--assurance-the-draw-is-fair)) intentionally does not
   duplicate the Organiser's generate ([4.2](01-organiser.md)) or the Contest
   Director's validate/accept ([4.3](02-contest-director.md)) capabilities.
4. **No Future-Enhancement dependencies.** Teams, frequency management and
   internationalised (non-English) name voicing are all out of MVP scope; the
   pilot stories assume individual-only, 2.4 GHz, English TTS and do not depend on
   any deferred capability.
