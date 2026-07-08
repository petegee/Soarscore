# Soarscore — Blind-Spots Report, Second Pass

**Date:** 2026-07-08. A follow-on adversarial pass over the full doc set
(requirements, decisions, users, both architecture views, all rule digests,
all five user-story docs), run **after** the first report's findings
([blindspots-report.md](blindspots-report.md)) were actioned and D1–D8
recorded. Everything already resolved there is not repeated.

Findings are grouped: **A** — contradictions with recorded decisions (mostly
stale text predating a decision); **B** — rules-and-scoring model gaps;
**C** — operational and consistency gaps; **D** — risks to acknowledge and
housekeeping. Each item states the evidence, a suggested fix (with a
recommendation), and, where the call is the owner's, **what's needed from
you**. Per the house-keeping rules, nothing has been changed yet — this
report flags and proposes only.

---

## A. Contradictions with recorded decisions (stale text)

These four are places where a doc still says the pre-decision thing. All are
mechanical fixes once confirmed.

### A1. Pilot story: standings "on the Base Station screen" vs D8 headless base — ✅ RESOLVED 2026-07-08

**Applied:** AC re-pointed at the master laptop's companion app, with the
MVP-optional pilot-phone page mentioned as the second read path.

**Evidence.** [`05-pilot.md` 7.1/7.4](docs/user-stories/05-pilot.md), last
acceptance criterion: "that round's results and the cumulative standings are
readable **on the Base Station screen** (e.g. on the clubhouse table)".
D8 and the [physical architecture](docs/architecture/physical-architecture.md)
make the base **headless**; the mid-contest standings screen is the **master
laptop's companion app** ([7.1](docs/requirements/high-level-requirements.md#area-7--reports)
was already amended). The pilot story kept the pre-D8 wording (it dates from
the C1 fix, which pre-dated D8 by a day).

**Fix (recommended):** re-point the AC at the laptop companion app, and
optionally mention the MVP-optional pilot-phone page as the second read path.

### A2. Scorer stories: "large touch targets" vs D2 stopwatch device — ✅ RESOLVED 2026-07-08

**Applied:** intro, story 5.1.2's statement and its first AC reworded to the
D2 vocabulary (no-look stopwatch-grade operation, physical start/stop,
deliberate interactions; explicitly not a phone-style touch UI).

**Evidence.** [`03-scorer.md`](docs/user-stories/03-scorer.md) intro ("large
touch targets, minimal keystrokes") and story 5.1.2's first AC ("uses **large
touch targets**"). D2 and [users.md §3](docs/requirements/users.md#3-scorer)
say the opposite: a ~1.3-inch round stopwatch handheld, **no-look physical
start/stop, not a phone-style touch UI**. The story text predates D2.

**Fix (recommended):** replace "large touch targets / minimal keystrokes"
with the D2 vocabulary — no-look stopwatch-grade operation, physical
start/stop, minimal deliberate interactions — matching users.md §3 and
scorer-device.md §3.

### A3. Announcer story: "all flight-time timing stops" at end of working time vs D5 — ✅ RESOLVED 2026-07-08

**Applied:** AC reworded to the rule, not the mechanism — flight time no
longer *counts* past the horn; devices keep timing to touchdown and the
system applies the cap from the D9 timestamps.

**Evidence.** [`04-announcer-timekeeper.md` 6.1.1](docs/user-stories/04-announcer-timekeeper.md),
third AC: "for classes whose rules require it, **all flight-time timing
stops** at that instant". D5 is explicit that end of working time does **not**
stop the device stopwatch — the Scorer stops on the horn and the base flags
over-time captures. As written, the AC reads as a system behaviour that D5
forbids.

**Fix (recommended):** reword to the rule, not the mechanism: the horn marks
the point beyond which flight time no longer *counts*; devices are not
stopped by the system (D5), and the base handles the cap downstream. (But see
B1 — the "cap" mechanism itself has a hole.)

### A4. Who records overruns — two docs contradict the raw-capture principle — ✅ RESOLVED 2026-07-08

**Applied:** Announcer 6.1.1's landing-window AC now derives the overrun
from the D9 timestamps; CD 5.9's Notes now separate Scorer-observed events
(land-out, contact) from system-derived conditions (overruns, zeroes).

**Evidence.** The raw-capture principle
([scorer-device.md §1–2](docs/requirements/scorer-device.md#1-capture-model--what-a-scorer-records))
says derived conditions — explicitly including over-working-time — are the
**system's**, never entered by the Scorer. But:

- [`04-announcer-timekeeper.md` 6.1.1](docs/user-stories/04-announcer-timekeeper.md),
  last AC: the landing-window overrun "consequence is **recorded by the
  Scorer** as part of the flight (5.2.3), not auto-computed by the timer".
- [`02-contest-director.md` 5.9 Notes](docs/user-stories/02-contest-director.md):
  the deductions "a Scorer captures … (land-outs, the model contacting a
  person, **working-time overruns, a zero'd flight**)". Working-time overruns
  are system-derived, and "a zero'd flight" is a scoring outcome, not an
  observation.

**Fix (recommended):** align both passages with the raw-capture principle:
the Scorer records observations (land-out, contact); overruns and zeroes are
derived by the base. *However*, B1 below shows the base cannot currently
derive overfly from what is captured — resolve B1 first, then fix the wording
to match whichever mechanism is chosen.

---

## B. Rules-and-scoring model gaps

### B1. Overfly cannot be detected from what is captured — ✅ RESOLVED 2026-07-08

**Applied** (fix 1, owner-decided): recorded as
**[D9](docs/requirements/decisions.md#d9--per-flight-timestamps-on-the-base-clock)**
— per-flight start/stop timestamps on the base clock; the Scorer times to
first ground contact (D5 amended); the system derives the cap, overfly and
its magnitude, and launch-before-working-time. Written into 6.1,
scorer-device.md (§1 timestamp principle, §2, §7, Open item 11, A.3 note),
Scorer story 5.2.1 and CLAUDE.md. The A3/A4 wording fixes remain their own
items, now unblocked.

**Context.** Several classes score an overfly — landing after the end of
working time (F3J: −30 up to 1 min over, zero beyond; F5J: no landing bonus
if any overfly, zero beyond 1 min; F5L: zero beyond 30 s; F5K: −100
landing-window overfly). The docs' stated mechanism
([6.1](docs/requirements/high-level-requirements.md#area-6--display-timer--audio-field-aids),
D5, scorer-device §2, the F3J capture-matrix row) is: *the base flags any
captured time exceeding the working time*.

**The hole:** the captured field is a **duration**, and a pilot can launch at
any point inside the working time. A pilot who launches 5 minutes into a
10-minute working time and lands 30 s after the horn has a flight time of
~5:30 — nowhere near exceeding the 10-minute working time, yet a real
overfly. The duration>working-time heuristic catches only the degenerate
launch-at-zero case. Worse, per D5 the Scorer stops the watch **on the horn**
— so a rule-following Scorer produces a capped duration that carries *no
trace* of the overfly at all, and the graded consequence (−30 within 1 min vs
zero beyond; F5L's 30 s line) depends on **how long after the horn** the
model landed, which nobody captures.

**Suggested fixes**

1. *(Recommended)* Capture **base-clock timestamps** for each flight's
   start/stop as part of the per-flight record (the device already mirrors
   the shared clock; stamping locally and reconciling on sync fits D6). The
   base can then derive launch-before-working-time (F3K zero), overfly and
   its magnitude, and last-flight ordering, all from raw data — fully
   consistent with the raw-capture principle. D5 then changes shape slightly:
   the Scorer stops the watch **at touchdown even if after the horn**, and
   the *system* caps the countable time — the horn stays the field authority
   for pilots, but the watch records what happened.
2. Keep stop-on-horn and add a Scorer-observed **overfly flag + seconds-late
   estimate** (an `event_flag` with a number). Simpler firmware, but it makes
   the Scorer interpret/judge, against the raw-capture principle, and a
   guessed "45 s late" decides a zero-vs-−30 boundary.
3. Scope graded overfly consequences out of MVP capture and leave them to the
   CD validation pass on Scorer say-so. Cheapest, but it makes a
   rules-defined score depend on memory.

**Needed from you:** which mechanism. Note fix 1 touches D5's wording, the
capture model (scorer-device §1, Appendix A), and story 5.2.1.

### B2. F3B (and two F3K tasks) don't fit the Area 6 running model or the Area 4 draw model — ✅ RESOLVED 2026-07-08

**Context.** Area 6 runs every group through one automatic sequence
(prep → working time → landing window), and Area 4 draws *one* group
structure per round. F3B is in MVP scope but structurally disagrees:

- An F3B **round is three tasks** (A Duration, B Distance, C Speed), each
  with **different group-size minima** (5 / 3 / 8-or-all —
  [f3b.md §1](docs/requirements/rules/f3b.md)) — so one round needs up to
  three different group decompositions, which 4.1/4.2 ("groups-per-round")
  cannot express.
- **Task C is flown sequentially per pilot** (a timed 4-leg course, judged by
  course judges — the capture matrix itself says "not the shoulder Scorer"),
  with no shared working time, no landing window, and no meaning for the
  prep-gate/one-Scorer-per-pilot model. What Area 6 announces and counts
  down for Task C, and who holds which device, is undefined.
- **F3K Task C (all-up, last-down)** needs 3–5 successive launch signals
  inside one working time — the phase model has no repeated-signal concept.
  F3K also prescribes a 45 s test-flight window and 60 s no-fly period before
  each working time ([f3k.md §1](docs/requirements/rules/f3k.md)) that the
  3.8 phase configuration cannot represent.

**Suggested fixes**

1. *(Recommended)* Record a decision: the MVP's generic running model covers
   the duration-task shape (F3J, F5J, F5L, F3K most tasks, F5K); **per-class
   running-sequence variants are part of the deferred per-discipline work**,
   and F3B's Tasks B/C (and F3K Task C) are explicitly listed there. This
   keeps the docs honest about what "F3B support" means today: scoring and
   manual/hand-held capture work; the automated field-aid sequence does not
   drive a Task C.
2. Extend Area 6 now with a per-task sequence descriptor (repeated signals,
   optional phases, per-task group minima in Area 4). Correct but a large
   scope addition for the MVP.

**Needed from you:** confirm fix 1 (or say F3B's odd tasks must be fully
driven in MVP, which reopens Area 4/6 scope). Given the local F3B scene runs
its own lap/speed rig, fix 1 looks aligned with reality.

**Applied:** resolved beyond fix 1 by a broader decision, **D10 —
operator-driven progression** (`docs/requirements/decisions.md`). All group
and round boundaries are operator actions — nothing starts itself; the
automatic phased sequence runs only *inside* a started group and only for
duration-shaped tasks. Non-fitting tasks (F3B B/C, F3K all-up) are
**manual-run**: starting them marks the group current and pushes device
context, but no automated clock/callouts/prep-gate run; sequence-driven vs
manual-run derives from the task type, and the operator's action is identical
either way. The inter-group gap setting is dropped (nothing consumes it) and
the CD's "pause inter-group progression" removed. Interlocks always block
with items listed; only the CD's attributed "advance anyway" override
proceeds (missing scores → flagged anomalies, unresolved no-scores → zeros
per 5.7) — no strictness setting. Per-class running-sequence detail (incl.
the Area 4 per-task group-minima gap) stays in the deferred per-discipline
work. Files: `decisions.md`, `high-level-requirements.md` (Area 6 intro,
3.8, 6.4, 6.5, notes), `users.md`, `CLAUDE.md`,
`02-contest-director.md`, `04-announcer-timekeeper.md`.

### B3. F3B group annulment is broader than the lone-pilot case — ✅ RESOLVED 2026-07-08

**Context.** [f3b.md §1](docs/requirements/rules/f3b.md): "a group result is
annulled if **only one competitor in it has a valid result**". The
requirements handle this only as the lone-pilot-*group* edge case
(5.3's dummy-override interplay). But the rule also fires in a **full group
where everyone except one scores zero/invalid** (all land out, say) — the
system would currently hand the one valid pilot 1000 where F3B says annul.
Also unstated: what annulment *means* operationally (the group re-flies —
which interacts with re-flight placement and the round-close gate).

**Suggested fix:** add the general condition to the F3B slice of scoring
(detect "one valid result in group" at group-score time, not just at draw
time), and record that the consequence is a re-flight of the group per
F3B.1.5/1.11 mechanics. Flag it through the same CD-warning path as the
existing lone-pilot handling.

**Applied:** as suggested. The 5.3 row now states the F3B annulment
condition is checked **at group-score time** (fires however the
one-valid-result state arose, including a full group where everyone else
zeroed), consequence = group re-flight via the 5.3 mechanics, surfaced
through the same CD-warning path; matching AC added to the CD dummy-override
story.

### B4. Minimum-rounds-for-a-valid-contest is missing for F3B and F5K — ✅ RESOLVED 2026-07-08

**Context.** 2.2's no-contest rule keys off "the class rules' minimum for a
valid contest (per the per-class rule docs)". The digests record it for
F3J (4), F5J (4), F3K (5), F5L (4) — but **f3b.md and f5k.md state no
minimum**, so 2.2 is unenforceable for two of six classes. If the FAI text
genuinely defines none, that fact itself needs recording (a rules-extraction
check against source-docs, which is a legitimate rules/ update).

**Suggested fix:** one extraction pass over the F3B and F5K source text; add
either the number or an explicit "no minimum defined — CD judgement" note to
each digest, and reflect it in 2.2's examples.

**Applied:** extraction pass done against the source docs. **F3B**: minimum
**one round + one task** for a valid competition (`F3B.1.8 b`; five complete
rounds for a Championship result) — added to `f3b.md`. **F5K**: section
`5.5.10` genuinely defines **no minimum** — recorded explicitly in `f5k.md`
as "no minimum defined — CD judgement". 2.2's examples in
`high-level-requirements.md` updated with the full six-class picture.

### B5. The task-integral penalty enumeration is never derived per class — ✅ RESOLVED 2026-07-08

**Context.** The descriptor's `event_flags` draw from "a **fixed system-wide
enumeration** of task-integral penalty types"
([scorer-device.md A.2](docs/requirements/scorer-device.md#a2-task-descriptor-one-per-task-type)),
but no doc enumerates it or checks it against the rule digests. The per-class
rules contain a lot of Scorer/timekeeper-observable events: F5J's −100 trio
(motor before signal, wrong launch direction, not straight-ahead 3 s), launch
outside the corridor (zero), motor-overrun (zero), F5K's landed-outside-pilot-
area (−10) and motor-restart (zero), F3J's towline-not-cleared (−100), F3B's
safety-plane crossing (−300), F5L's landing-measurement zeroes, etc. The two
worked examples list only `land_out` and `model_contacts_person`.

Each of these needs a classification: **Scorer event-flag** (observed at the
line) vs **system-derived** (from raw data) vs **CD-imposed** (5.9). Without
that table, the "fixed enumeration" cannot be fixed and the descriptor
contract (prototype Open item 1) is under-specified.

**Suggested fix:** a per-class penalty/deduction table derived from the rule
digests, appended to scorer-device.md (or the future per-discipline docs),
with the three-way classification. This is derivation work, not a decision —
except where an event is borderline observable (flag those to you).

**Applied:** derived and appended as **`scorer-device.md` Appendix B** — the
full six-class table classified Scorer-event-flag / system-derived /
CD-imposed, closing with the resulting complete per-class `flags[]` set for
the descriptor contract (adds ~7 flags beyond `land_out` /
`model_contacts_person`). **Four borderline calls flagged for owner
confirmation** before the descriptor freeze: F3J towline-not-cleared, F3K
flying-outside-window, F5J launch-infringement trio + motor-overrun
(launch-marshal territory vs the shoulder Scorer). F3B Tasks B/C map to
base-side manual entry (manual-run per D10); the F3K unsigned-card and F5L
helper-timing rules map to existing D1/D2 waivers.

### B6. Rule-derived configuration lacks guardrails — and F5K's NLH has no home — ✅ RESOLVED 2026-07-08

**Context.** Story 3.6 established the pattern: class rule is the **default
and guardrail**, deviation needs explicit confirmation (applied to
drop-worst). But the same exposure exists, un-guarded, for other 3.x
parameters that the rules fix per class:

- **Landing-bonus tables (1.2/3.7)** — free-form master data, yet F3J, F5J,
  F3B and F5L each mandate a specific table. Selecting the F5J table for an
  F3J contest today produces no warning.
- **Points-per-second (3.7)** — F5L is 2 pt/s, everyone else 1 pt/s.
- **Landing-window duration (3.8)** — rule-bounded in classes with overfly
  windows.
- **F5K's Nominal Launch Height** — a *per-competition, wind-dependent*
  scoring input (60/70 m, CD-announced) that appears in
  [f5k.md](docs/requirements/rules/f5k.md) but in **no configuration
  sub-area at all**; likewise F5J's height-deduction constants (0.5/3 pt per
  m) exist only in the rules digest. These are presumably "per-discipline
  deferred", but NLH is genuinely *configuration* (it changes per event by
  weather), not a fixed rule constant — it needs a named home.

**Suggested fix:** extend the 3.6 guardrail sentence to cover all
rule-derived 3.7/3.8 parameters and landing-table selection ("defaults from
the class rule; deviation warns"); add NLH (and its ilk: per-class scoring
constants that vary per event) to 3.7's parameter list or explicitly to the
per-discipline deferral note.

**Applied:** as suggested. 3.6's row now states the general guardrail
(class-rule default; deviation needs explicit confirmed warning; never a
silent accept) covering all rule-fixed 3.6–3.8 parameters including
landing-table selection and points-per-second; 3.7's row gains **per-event
rule constants** with F5K's NLH as the named example. Matching ACs added to
Organiser stories 3.6 (generalised guardrail) and 3.7 (NLH's named home).

---

## C. Operational and consistency gaps

### C1. "Attributable" is required everywhere, but D1 removed identity — ✅ RESOLVED 2026-07-08

**Context.** D1: no auth, **no Scorer identity capture**. Yet the CD and
Organiser stories repeatedly require actions to be "**attributable/auditable
(who changed what)**" (Organiser 5.4), "attributable to me" (CD 2.2 unlock,
5.9, 6.5, dummy override). With no login and no identity, the event log can
attribute to a **device** or a **client/role**, but "who" is undefined — two
people sharing the laptop are indistinguishable.

**Suggested fixes**

1. *(Recommended)* Define attribution = **origin + claimed role**: every
   event carries the originating client (device id / laptop) and the role
   under which the action was taken (CD actions are taken from a CD-labelled
   part of the UI). No identity, consistent with D1; "who" means "which box,
   wearing which hat".
2. Add a lightweight free-text operator initials field at session start —
   slightly more than D1 intended, but gives a human name in disputes.

**Needed from you:** which reading of "attributable" the MVP means.

**Applied:** owner chose a third way: every event carries an
**actor-identity field**, but **how identity is obtained is deferred beyond
the MVP** — the field defaults to **"unknown"**. Combined with what the log
records anyway (originating client + the authority under which the action
was taken), that triple is now the recorded definition of "attributable"
(D4, with a cross-reference from D1's no-identity consequence). Identity
capture (login/initials/device pairing) added to Future Enhancements.

### C2. Two devices can select the same pilot; a pilot can end up with none — ✅ RESOLVED 2026-07-08

**Context.** Scorers self-select from the pushed group short-list. Nothing
prevents two devices confirming the **same pilot** (leaving another pilot
Scorer-less), and the prep gate's "every Scorer in the group has confirmed"
is really "every **pilot** has a confirming device" — the docs never say
which. Consequences differ: duplicate-selection means concurrent captures
for one pilot (colliding with 5.1.3's attribution promises) and a silent
gap for another (surfacing only as the gate holding, with the CD's
"pilot unconfirmed" release wrongly available as a no-score).

**Suggested fix:** state the gate's unit as **per-pilot** (each group pilot
needs exactly one confirming device); the base warns/blocks a second device
confirming an already-claimed pilot (visible in the group view, which
already shows each device's selected pilot). Re-selection away frees the
pilot. Small requirement, cheap at the base.

**Applied:** as suggested, with **block** (not warn) chosen for the second
claim. Gate unit restated as per-pilot ("every pilot has exactly one
confirming device") in 5.0 and 6.5 of `high-level-requirements.md`;
confirmation defined as an **exclusive claim arbitrated by the base**
(rejecting device shows "pilot already claimed"; re-selection frees the
claim) in `scorer-device.md` §3, with a §4 addition that a **buffered
confirmation reconciling on sync passes the same arbitration** and a late
losing claim is rejected and surfaced, not merged. New AC in Scorer story
5.0.4; "every Scorer has confirmed" wording updated in the CD 6.5,
Announcer 6.5.1 and Pilot 7.x stories.

### C3. Re-flights vs the round-close gate and the conflict machinery — ✅ RESOLVED 2026-07-08

**Context.** Two interactions are unstated:

- **The gate.** 6.4 blocks the round advance on missing scores and
  unresolved no-scores — but not on a **granted-but-unflown re-flight**.
  Placement priority 3 is "original group re-flies at the end of the ongoing
  round"; if the Announcer advances before it is flown, the entitlement is
  stranded. The gate needs a third outstanding-item type: pending re-flights.
- **Better-of needs two results per pilot per round.** The re-flight scoring
  rule (fillers and re-flown groups score the better of two flights) means
  the *same pilot, same round* legitimately holds two captured results. The
  sync-conflict policy (scorer-device §5) treats "same pilot/flight with two
  captures" as an **anomaly for human resolution** — the requirements never
  distinguish the legitimate re-flight duplicate (resolved automatically by
  the better-of rule) from the accidental duplicate (anomaly). The data
  model must separate "second capture of the same flight" from "capture of a
  second working-time for the same round".

**Suggested fix:** add the pending-re-flight condition to 6.4/5.7's gate
list; state in 5.3 that re-flight results are stored as distinct
working-time results (never conflict-flagged), with better-of applied by the
scoring rules.

**Applied:** both fixes. **Gate:** a granted-but-unflown re-flight is now a
third outstanding item blocking the round advance (6.4, D10's interlock
list, Announcer 6.4 story, CD 6.5 story, users.md); under the CD's "advance
anyway" override the entitlement **lapses** — the original result stands,
flagged for the validation pass. **Data model:** 5.3 and
`scorer-device.md` §5 now state that a re-flight is a **second working-time
result** for the same pilot/round, stored distinctly and resolved by the
scoring rules (better-of for fillers/non-entitled group members; the
entitled competitor scores the re-flight even if worse, per general-rules
§7) — conflict-flagging is reserved for two captures of the **same**
flight. CD 5.3 story Notes cross-reference both.

### C4. What state does a group in progress resume into after a base reboot? — ✅ RESOLVED 2026-07-08

**Context.** The base "resumes into the correct contest state from the event
log" after an unplanned reboot (scorer-device §9, physical arch §1). For a
group **mid-working-time**, the correct state is unknowable: the shared
clock was dead, the horn never sounded, phase boundaries passed silently.
Replaying the log restores the *data*, not the group's live timeline.

**Suggested fix (recommended):** state the rule — a group that was running
at the moment of base failure is **treated as aborted** on resume (the
existing 6.5 abort semantics: restart from preparation, accumulated metrics
annulled), unless the CD instead accepts pen-and-paper results for it under
D3. That makes reboot-resume a defined path rather than an implementation
surprise.

**Applied:** as recommended (**always abort**), after weighing a softer
resume-if-window-still-open variant — the owner chose the simple
conservative rule. Recorded in `physical-architecture.md` §3 (base
responsibilities + §8 failure table), Organiser story 2.3's
unplanned-shutdown AC, and `scorer-device.md` §5 (buffered captures from an
annulled run sync in but are event-logged only, never applied — the re-run's
captures are the live ones).

### C5. The single laptop is double-booked, and multi-client rules are unstated — ✅ RESOLVED 2026-07-08

**Context.** The physical architecture gives the laptop three simultaneous
jobs: flight-line **run control** (6.4/6.5 — "needs the laptop … within
reach of the flight line"), the **clubhouse standings screen** (7.1 — "on
the clubhouse table"), and **printing/publishing**. One laptop cannot be at
the flight line and on the clubhouse table between rounds — the two named
use-cases collide in space. Separately, "any other laptop with the companion
app takes over" implies **multiple concurrent clients** are possible, but no
requirement says whether two clients may connect at once and what happens if
both issue run-control actions (open item 1 touches the CD-phone variant
only).

**Suggested fix:** decide and record: either (a) one operator client at a
time (base enforces a single control session; read-only extra clients are
fine — the pilot page already exists for reading), or (b) multiple clients
with last-action-wins and event-logged origins. And soften 7.1's clubhouse
example or note it assumes a second (read-only) client or the pilot-phone
page. **Needed from you:** (a) or (b), and whether a second cheap client
(open item 1's operator page) is wanted for the flight line.

**Applied:** owner chose **(b) multiple clients, last-action-wins**. No
control-session lock: the base accepts actions from any connected companion
client; every action is event-logged with originating client + exercised
authority (the D4 attribution triple from C1); the trusted group (D1)
coordinates by convention. The double-booking dissolves — a second client
can show clubhouse standings while the flight line keeps run control; 7.1's
wording generalised from "the master laptop's screen" to "any connected
companion-app client". Files: `physical-architecture.md` §5,
`decisions.md` (D8 consequence), `high-level-requirements.md` (7.1).

### C6. Mid-contest config changes never reach the devices — ✅ RESOLVED 2026-07-08

**Context.** Task descriptors are "pushed at competition start"
(scorer-device §1); the per-group push carries only working-time overrides.
A CD-authorised mid-contest change to task rules (the Area 3 rule's whole
purpose — "a wrong target time discovered in round 3") that alters capture
fields, precision or penalty flags has **no stated path to the fleet**.

**Suggested fix:** one sentence in scorer-device §1 / A.1: descriptor pushes
are re-issued on any authorised mid-contest change, and a device applies the
new descriptor at its next group boundary (never mid-group).

**Applied:** as suggested, folded into **D11 — the device's scope is the
current group** (`decisions.md`). The group-context push carries the current
descriptor; a device applies changes at its next group entry, never
mid-group; and **group entry requires that push** — an offline device that
missed it cannot capture for the group until it syncs (D3 covers the
meanwhile), while a device that got the push then dropped offline buffers
normally. Every capture is therefore made under the descriptor current at
its group's start, eliminating the stale-descriptor corner case. Files:
`decisions.md` (D11), Area 3 mid-contest-change rule in
`high-level-requirements.md`, `scorer-device.md` §1.

### C7. Two configuration terms are dangling: "helper assignment" and "timekeeper count" — ✅ RESOLVED 2026-07-08

**Context.** 3.5 configures "**helper assignment**" as a draw constraint —
no other doc defines what it is (presumably: pilot A crews for pilot B, so
they must not be drawn into the same group — but that is a guess). 3.7
configures "**timekeeper count**" — the rules (F3J's two stopwatches,
`F3J.3 e`) give it meaning, but the MVP's one-device-one-Scorer model has no
story for a second timekeeper's time, no averaging rule, and no D1-style
waiver saying club contests run with one. Both terms are currently
requirements words with no requirement behind them.

**Suggested fix:** define helper-assignment in 3.5 (one line: mutual-helper
pairs are kept in different groups, as a draw constraint like anti-repeat);
for timekeeper count, either record an explicit D1-style waiver ("club-level:
one Scorer's time is official; the FAI two-timekeeper practice is waived")
or drop the parameter from 3.7 until per-discipline work needs it.
**Needed from you:** confirm the waiver reading.

**Applied:** owner clarified the deeper fact — under FAI rules a *helper* is
a fellow pilot assisting the flying pilot while the timer/scorer is a
non-assisting official, and at club level **that separation itself is
waived: the Scorer is the helper**. Both terms removed: "helper assignment"
dropped from 3.5 (and the term "helper" from the requirements vocabulary),
"timekeeper count" dropped from 3.7 with a D1-style waiver (one Scorer's
device time is official). Both waivers recorded as dated additions to
**D1's consequences** alongside the signed-card waiver; rule docs unchanged.
Files: `decisions.md` (D1), `high-level-requirements.md` (3.5, 3.7),
`01-organiser.md` (3.5, 3.7 stories), `feature-parity.md`.

### C8. The Scorer correction window vs the device's one-pilot scope — ✅ RESOLVED 2026-07-08

**Context.** 5.1.2 lets a Scorer correct their captured value **until next
round start**; 5.0.3/5.1.3 say re-selection changes the active target and a
device "only ever affects my confirmed competitor's record". Once the Scorer
re-confirms a *new* pilot for the next group, correcting the *previous*
pilot's value is exactly what 5.1.3's wording forbids. The intended scope is
clearly "captures **this device made** this round", but no doc says so.

**Suggested fix:** one clarifying line in 5.1.3 (or scorer-device §3): a
device may correct any capture *it originated* within the current round,
regardless of the currently confirmed pilot; it still cannot touch another
device's captures.

**Applied:** resolved the *opposite* way from the suggestion, by owner
decision (**D11**): rather than widening device corrections across the
round, the **Scorer correction window was narrowed from next-round start to
next-group start** — the device focuses only on the current group, so the
5.1.3 tension never arises. Changes to flown groups are base-side:
mid-contest score administration via the companion app (5.3/5.4) or the
CD's end-of-contest validation (5.8). A buffered correction syncing after
its group closed is rejected and surfaced, never silently applied. Ripple:
Area 5 intro / 2.3 / 6.4 rows in `high-level-requirements.md`,
`scorer-device.md` §3 + §5, Scorer stories 5.0.3 / 5.1.2 / 5.1.3 (+
resolved-items amendments), Announcer 6.4, Organiser 2.3 AC, `users.md`,
`feature-parity.md`.

---

## D. Risks to acknowledge, and housekeeping

### D1. The event log is a single copy on a single SD card — ✅ RESOLVED 2026-07-08 (risk accepted)

**Context.** D4 makes the event log the sole source of truth; D8 puts it on
one embedded box; "Data integrity & backup" is a **Future Enhancement**. D3
(pen and paper) answers *go-forward* failure, but not **loss of
already-captured data**: a corrupted SD card on day two of a two-day event
loses day one with no recovery path unless every round's results happened to
be printed. At Pi-class hardware on field power, storage corruption is the
*likely* failure, not the exotic one.

**Suggested fix (recommended):** promote one narrow slice of backup into
MVP: the base **streams/copies the event log to any connected companion
laptop** (which is present anyway), or snapshots to a second SD/USB on round
boundaries. Cheap, offline, and turns D3 into a complete answer. Full
backup/restore stays future.

**Applied:** owner chose to **accept the risk** — all backup, including the
minimal mirror, stays a Future Enhancement. The single-copy day-loss risk is
now recorded as an **explicitly accepted risk** in D4 (`decisions.md`), with
mid-contest printing (7.1) noted as the informal paper hedge.

### D2. Housekeeping — ✅ RESOLVED 2026-07-08

- **A2 in the first report is actually resolved.** The "never auto-resolve"
  recommendation was adopted verbatim into
  [scorer-device.md §5](docs/requirements/scorer-device.md#5-sync-and-conflict-policy-a2)
  (and D6's consequence line still calls the policy "open"). Mark A2
  ✅ in blindspots-report.md and update D6's wording.
- **D2's consequence bullet** in decisions.md still says a hardware/firmware
  doc "is needed (see blindspots-report.md)" — scorer-device.md now exists;
  re-point the reference.
- **D4 references `todos.md` (Non-Functional)** — the file exists at the repo
  root but is not referenced from any docs/ index; consider whether its NFR
  content should graduate into docs/requirements/ so decisions don't lean on
  a scratch file.

**Applied:** first two items done — first report's A2 marked ✅ (with the
resolution recorded there), D6's "conflict policy open" replaced with the
adopted never-auto-resolve policy, and D2's consequence re-pointed from
`blindspots-report.md` to `scorer-device.md`. Third item done too
(owner-confirmed): the two NFRs graduated to
**`docs/requirements/non-functional.md`** (NFR-1 centralised flexible task
model, tied to the descriptor and D4; NFR-2 additive-only extensibility);
D4 and the CLAUDE.md repo map re-pointed; todos.md items ticked with
pointers (the OIDC-login todo is covered by the C1 identity Future
Enhancement).

---

## Suggested order of attack

1. ~~**B1 (overfly detection)**~~ — ✅ decided 2026-07-08 (fix 1:
   per-flight base-clock timestamps, recorded as D9; D5 amended).
2. ~~**B2 (F3B/F3K running-model scope)**~~ — ✅ decided 2026-07-08
   (operator-driven progression + manual-run tasks, recorded as D10).
3. ~~**A1–A4**~~ — ✅ applied 2026-07-08.
4. ~~**C2, C3, C6, C8**~~ — ✅ decided 2026-07-08 (C2 exclusive per-pilot
   claim; C3 re-flight gate item + distinct working-time results; C6+C8
   recorded as D11: the device's scope is the current group).
5. ~~**C1, C5, C7, B4–B6**~~ — ✅ decided 2026-07-08 (C1 actor-identity
   field defaulting "unknown"; C5 multi-client last-action-wins; C7 D1
   waivers; B3–B6 applied incl. the Appendix B penalty derivation).
   **D1 (event-log backup)** remains, plus the D2 housekeeping items.
