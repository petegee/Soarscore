# Soarscore — Recorded Decisions

Durable, cross-cutting decisions that shape the requirements but are not
derivable from the rule docs or the area index. Each is a settled position —
revisit deliberately, don't re-litigate session by session. Decided
**2026-07-07** with the project owner.

---

## D1 — Trust model: small, known, trusted group

The system is intended, initially, for local use in New Zealand among a small
group of well-known, well-trusted individuals, and operates on individual
integrity and honesty. There is no intention at this stage to allow other
groups access.

**Consequences**
- No user authentication, no Scorer identity capture, and no physical or
  electronic score sign-off in the MVP. (The event log still carries an
  **actor-identity field** on every event, defaulted to "unknown" — how it
  is populated is post-MVP; see [D4](#d4--immutable-event-log).)
- The FAI signed-score-card rule
  ([general-rules §2](rules/00-general-rules.md#2-data-the-timer--helper-collects)
  — an unsigned card scores zero in classes that require it) is **consciously
  waived**: these are club-level contests, not FAI-sanctioned events. This is
  a scoping decision recorded here — the rule docs are unchanged, per the
  house-keeping rules.
- Auditability comes from the event log ([D4](#d4--immutable-event-log)), not
  from signatures.
- *(Added 2026-07-08.)* The FAI **helper/official separation** — a helper is
  a fellow pilot assisting the flying pilot, while the timer/scorer is an
  official who offers no help — is likewise **consciously waived**: with a
  small club-level pool of people, **the Scorer is the helper**. The term
  "helper" is therefore not used in the requirements (the former 3.5
  "helper assignment" draw constraint is removed).
- *(Added 2026-07-08.)* The FAI **two-timekeeper practice** (e.g. F3J's two
  stopwatches per competitor) is **consciously waived**: at club level the
  **one Scorer's device time is official** ([D2](#d2--scorer-device-dedicated-esp32-stopwatch-style-handheld)/[D9](#d9--per-flight-timestamps-on-the-base-clock)).
  The dangling "timekeeper count" parameter is removed from 3.7; if
  per-discipline work ever needs FAI officiating fidelity, it reopens this
  deliberately. As with the signed-card waiver, the rule docs are unchanged.

## D2 — Scorer device: dedicated ESP32 stopwatch-style handheld

Scorer hand-held devices are **ESP32 dev-board, round stopwatch-type devices
running custom firmware** (to be developed and integrated as part of this
project). No other devices are catered for or permitted — no BYOD phones or
tablets. **The Scorer's device is the stopwatch** — flight timing is performed
on the device itself, not transcribed from a separate watch.

**Consequences**
- The Scorer-device interaction model must fit a small round display with
  no-look, stopwatch-style operation — not a phone-style touch UI
  ([users.md §3](users.md#3-scorer)).
- The device's hardware/firmware requirements are drafted in
  [scorer-device.md](scorer-device.md) (capture model, on-device/base split,
  sync, fleet; open items listed there).

## D3 — Failure policy: pen and paper, reconcile at the base

At **any point of system failure**, the field reverts to **pen and paper**;
results are manually entered into the Base Station afterwards to compute final
standings and reports. At the end of the contest the Contest Director (or
Organiser under CD authority) **validates the entered scores**, manually enters
missing scores, and overrides entered scores known to be incorrect.

**Consequences**
- Base-station **manual score entry** is a first-class MVP path
  ([5.8](high-level-requirements.md#area-5--scoring)).
- Blank **scoring sheets must be printable in advance** of any round, as the
  standing fallback kit ([7.3](high-level-requirements.md#area-7--reports)).
- A **CD end-of-contest validation pass gates Lock**
  ([2.2](high-level-requirements.md#area-2--competition-lifecycle)).

## D4 — Immutable event log

The system records **all mutations as an immutable, write-only log of events**,
so it is always possible to know what happened, when, and how the contest
evolved. This is the MVP's auditability mechanism (in place of sign-off, D1)
and its dispute/debugging record. Current state must be derivable from the
log. This constrains the domain-model design and should be decided together
with the flexible task-model NFR
([non-functional.md NFR-1](non-functional.md#nfr-1--one-centralised-flexible-task-model)).

**Accepted risk — single copy** *(owner-decided 2026-07-08)*: in the MVP the
event log exists as **one copy on the Base Station's storage**. Loss of
already-captured data (e.g. storage corruption on day two of a two-day
event losing day one) is an **explicitly accepted risk** at club level; all
backup — including a minimal mirror-to-companion-client — stays a
[Future Enhancement](high-level-requirements.md#future-enhancements).
Printing round results as the contest proceeds ([7.1](high-level-requirements.md#area-7--reports))
is the informal paper hedge.

**Attribution** *(decided 2026-07-08)*: wherever the requirements say an
action is "attributable", it means the event carries the **originating
client** (device/laptop), the **authority under which the action was taken**
(e.g. a Contest-Director action), and an **actor-identity field**. How that
identity is obtained (login, initials, device pairing) is **deferred beyond
the MVP** — in the MVP the field defaults to **"unknown"**, consistent with
D1's no-auth stance, and the small trusted group resolves names from memory.

## D5 — End of working time does not stop the device stopwatch

There is **no requirement for the end of working time to stop the hand-held
stopwatch devices**. The Scorer times through to the model's **first ground
contact, even when that falls after the horn** *(amended 2026-07-08 by
[D9](#d9--per-flight-timestamps-on-the-base-clock) — originally "stops on
the horn")*. The horn, by ear, remains the field authority telling pilots
the working time has ended
([6.2](high-level-requirements.md#area-6--display-timer--audio-field-aids)).

**Consequences**
- [6.1](high-level-requirements.md#area-6--display-timer--audio-field-aids) no
  longer auto-stops flight timing.
- Class rules still cap countable flight time at the end of working time; the
  system applies that cap — and derives any **overfly** and its magnitude —
  from the per-flight timestamps (D9), rather than the Scorer judging it at
  the line or the base flagging bare durations.

## D6 — Offline-first; buffer and sync; publish when connected

The system must run **entirely offline from the internet**, but be able to
**publish results when internet connectivity is available** (publishing
channel to be defined later). Hand-held devices that lose sync with the Base
Station **continue to capture data/scores/metrics and sync when the link
returns**. A live-scoring public web page for real-time contest progress is a
**future enhancement**, not MVP.

**Consequences**
- No MVP feature may depend on internet connectivity.
- Device↔base sync conflict policy: **never auto-resolve** — both captures
  are event-logged and the conflict surfaces as an anomaly in the CD
  validation pass
  ([scorer-device.md §5](scorer-device.md#5-sync-and-conflict-policy-a2)).

## D7 — Scale bounds and multi-day operation

A typical event is **single-day or two-day**, with **up to 20 pilots** and
**up to ~8 rounds per day**. Two-day events are routine, so **suspend at end
of day / resume next day is MVP scope**
([2.3](high-level-requirements.md#area-2--competition-lifecycle)). These
bounds size everything: device fleet ≈ max group size plus spares, report
volumes are small, draw computation is trivial at this scale.

## D8 — Physical shape: headless authoritative base, companion laptop

*(Decided 2026-07-08.)* The Base Station is a **headless embedded controller
at the flight line** that owns all contest state, the event log (D4), the
shared clock and the radio; the **field board and loudspeakers are wired to
it** (so the horn — the timing authority, D5 — can never be stale); the
**master laptop runs a companion app as a detachable client** holding no
state; **pilots' phones** may read an **MVP-optional, strictly read-only
draw/standings web page** served by the base over local Wi-Fi — no native
app. Full detail and implications:
[physical architecture](../architecture/physical-architecture.md).

**Consequences**
- A running group survives the laptop leaving, sleeping or failing; but
  run-control and round advance need a connected operator client.
- *(Added 2026-07-08.)* **Multiple companion clients may connect
  concurrently, last-action-wins** — no control-session lock; every action
  is event-logged with its originating client and exercised authority (D4).
  Coordination is by convention within the trusted group (D1).
- Pilot-phone and laptop traffic must not be able to degrade the
  scorer-device link.
- The base is a deliberate single point of failure — D3 is the answer.

## D9 — Per-flight timestamps on the base clock

*(Decided 2026-07-08.)* Every per-flight record carries **start and stop
timestamps on the base's shared clock**, stamped automatically by the device
at the Scorer's start/stop actions — never entered by hand — buffered offline
and reconciled on sync (D6). The Scorer stops the watch at the model's
**first ground contact even after the horn** (amending D5): the raw capture
is release→touchdown, and **the system derives the countable (capped) flight
time, any overfly and its magnitude, and launch-before-working-time** from
the timestamps against the group's working-time window.

**Why:** an overfly cannot be derived from a duration alone — a pilot who
launches mid-window can overfly with a flight time far shorter than the
working time — and the graded overfly consequences (e.g. F3J's −30 within a
minute, zero beyond) need to know *how long after the horn* the model
landed. Timestamps also give the system launch-before-working-time detection
(F3K) and corroborate flight ordering.

**Consequences**
- Device↔base clock sync becomes **scoring-relevant**, not just display: the
  ±0.5 s mirror bound also bounds timestamp accuracy
  ([scorer-device.md §7](scorer-device.md#7-countdown-staleness-bound-a6));
  stamps that cannot be reconciled within it are flagged for the CD
  validation pass rather than presented as exact.
- Paper-fallback / manual entries
  ([5.8](high-level-requirements.md#area-5--scoring)) carry no timestamps;
  any overfly there is the Contest Director's call in the validation pass
  (D3).
- [6.1](high-level-requirements.md#area-6--display-timer--audio-field-aids)'s
  earlier "flag any captured time exceeding the working time" heuristic is
  replaced by this derivation.

## D10 — Operator-driven progression; automation runs only inside a group

*(Decided 2026-07-08.)* **Nothing crosses a group or round boundary without
an operator action.** The Announcer/Timekeeper starts every group; at a
round boundary the same action is the round advance
([6.4](high-level-requirements.md#area-6--display-timer--audio-field-aids)).
The automatic phased sequence (prep → working → landing) runs only
**inside** a started group, and only for tasks whose shape fits it —
**duration-shaped tasks**. Tasks that do not fit (e.g. F3B Distance and
Speed, F3K all-up) are **manual-run**: starting the group marks it current
and pushes the devices their group context for normal capture, but no
automated clock, callouts or prep-gate countdown run. Whether a task is
sequence-driven or manual-run **derives from the task type** — it is not a
per-competition switch — and the operator's interaction is identical either
way, so nobody needs to remember which tasks self-advance: **none do**.

**Interlocks.** An advance with outstanding items — missing scores,
unresolved no-scores, granted-but-unflown re-flights — always **blocks with
the items listed**; only the Contest Director's explicit, attributed
**"advance anyway" override** proceeds, converting outstanding missing
scores into flagged anomalies for the end-of-contest validation pass (D3),
unresolved no-scores into zeros per
[5.7](high-level-requirements.md#area-5--scoring), and lapsing any unflown
re-flight entitlement (the original result stands, flagged). There is no
strictness setting: strict is the only mode, and the override is the
per-incident relief valve.

**Consequences**
- Automatic group start after an inter-group gap is removed from
  [6.5](high-level-requirements.md#area-6--display-timer--audio-field-aids);
  the **inter-group gap setting is dropped** from 3.8 (nothing consumes it).
- The CD's "pause the inter-group progression" run-control action is moot
  (nothing progresses on its own) and is removed; prep
  pause/fast-forward/add-time, the split prep-gate releases and
  abort/restart are unchanged.
- The round-completeness gate and the Scorer correction window
  ([Area 5](high-level-requirements.md#area-5--scoring)) are **always on** —
  they are scoring integrity, not field-aid automation. *(The correction
  window was later narrowed to the group boundary by
  [D11](#d11--the-devices-scope-is-the-current-group).)*
- Manual-run groups have no base-clock working-time window, so D9's overfly
  derivation does not apply to them; their timing structures are per-class
  (deferred per-discipline work) and any overrun is the CD's call in the
  validation pass. The device-side pre-group confirmation guard
  ([5.0](high-level-requirements.md#area-5--scoring)) still applies; the
  T−1:00 prep-gate pause exists only where the automated sequence runs.

## D11 — The device's scope is the current group

*(Decided 2026-07-08.)* A Scorer device's world is **the current group** —
from the base's group-context push to the start of the next group. Nothing
on the device reaches backward past a group boundary; anything that must is
base-side work.

**Consequences**
- **Group entry requires sync.** A device enters a group only via the
  base's **group-context push** (pilot short-list, working time, and the
  **current task descriptor**); an offline device that missed the push
  cannot capture for that group until it syncs — pen and paper (D3) covers
  the meanwhile. A device that received the push and *then* dropped offline
  continues normally, buffering (D6).
- **Descriptor changes apply at group boundaries.** A CD-authorised
  mid-contest configuration change
  ([Area 3](high-level-requirements.md#area-3--competition-setup--configuration))
  re-issues the task descriptor; each device applies it at its **next group
  entry, never mid-group** — so a Scorer's screen never changes under their
  thumbs, and every capture is made under the descriptor current at its
  group's start.
- **On-device corrections end with the group** *(narrowing the earlier
  round-bounded Scorer correction window)*. A Scorer may correct a value
  they captured only while its group is current — **up to the start of the
  next group**. After that, any change to a flown group's data is
  base-side: mid-contest score administration
  ([5.3](high-level-requirements.md#area-5--scoring)/[5.4](high-level-requirements.md#area-5--scoring))
  via the companion app, or the Contest Director's end-of-contest
  validation (D3). The base **rejects and surfaces** a buffered correction
  that syncs after its group has closed — never applies it silently.
- The **round-completeness gate**
  ([6.4](high-level-requirements.md#area-6--display-timer--audio-field-aids))
  is unchanged, but it no longer bounds Scorer self-correction (that ends
  earlier, with the group) — it is purely scoring integrity.
