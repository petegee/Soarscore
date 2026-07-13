# Soarscore — Companion App Requirements

**Status: draft for review.** Consolidates every companion-app obligation
already scattered across the requirements, decisions, architecture and user
stories into one place, plus the owner decisions of 2026-07-08 (one app for
all operator hats; operator name-pick identity; base-served web app with a
phone-sized run-control view); no items remain **OPEN**.
Companion to [high-level-requirements.md](high-level-requirements.md),
[decisions.md](decisions.md) (especially
[D8](decisions.md#d8--physical-shape-headless-authoritative-base-companion-laptop),
[D4](decisions.md#d4--immutable-event-log),
[D6](decisions.md#d6--offline-first-buffer-and-sync-publish-when-connected))
and the [physical architecture §5](../architecture/physical-architecture.md#5-master-laptop--detachable-companion-app).
Sibling of [scorer-device.md](scorer-device.md) — that doc specifies the
base's capture clients; this one specifies its operator client.

The companion app is **the humans' window into the headless Base Station**
(D8). The base owns all contest state, the event log, the shared clock and
the field aids; being screenless, **every human action goes through a
companion client** — normally the master laptop. The app is a **client,
never an authority**: it holds no contest state, so it can arrive, leave,
sleep or fail without stopping a running group.

---

## 1. Role and shape (D8)

- **Base-served web app** *(owner-decided 2026-07-08)*: the base's web
  server serves the operator UI over its local Wi-Fi to any
  browser-equipped client — normally an **ordinary laptop**
  ([physical architecture §5](../architecture/physical-architecture.md#5-master-laptop--detachable-companion-app)).
  Nothing is installed, so any spare laptop is a full replacement, and the
  base's existing web server (pilot page, firmware, health data) gains one
  more surface rather than a second delivery mechanism.
- **Stateless by design**: all state and the event log live on the base;
  current state is always fetched/streamed from it. If the laptop dies, any
  other laptop with the companion app (or the pen-and-paper fallback,
  [D3](decisions.md#d3--failure-policy-pen-and-paper-reconcile-at-the-base))
  takes over with nothing lost.
- **One companion app for all operator hats** *(owner-decided 2026-07-08)*:
  Organiser, Contest Director and Announcer/Timekeeper share the single app
  through **role-oriented views** (setup / run control / score
  administration) — no per-role apps, and **no enforced authorisation**
  between views in the MVP, matching the freely-swapping hats at club scale
  ([users.md](users.md), [D8](decisions.md#d8--physical-shape-headless-authoritative-base-companion-laptop)).
  Scorers and pilots have **no companion-app write path** (see §3.4).
- **Every mutating action is submitted to the base** and lands in the
  immutable event log (D4) with its **originating client**, the **authority
  under which it was taken**, and the **actor-identity field**.
- **Operator name-pick, not authentication** *(owner-decided 2026-07-08,
  amending [D1](decisions.md#d1--trust-model-small-known-trusted-group)/[D4](decisions.md#d4--immutable-event-log))*:
  each companion client asks **"who is operating?"** — a selection from a
  people list, changeable at any time, no password or verification — and
  stamps that name into the actor-identity field of every action it
  submits. This is **identity capture, not authentication**; D1's no-auth
  stance stands. Authentication proper (login, OIDC) stays a
  [Future Enhancement](high-level-requirements.md#future-enhancements) —
  and OIDC in particular conflicts with offline-first operation
  ([D6](decisions.md#d6--offline-first-buffer-and-sync-publish-when-connected))
  unless an identity provider runs locally on the base.

## 2. Multi-client model (D8)

- **Multiple companion clients may connect concurrently** *(owner-decided
  2026-07-08)*. The base accepts actions from any connected client,
  **last-action-wins**; there is **no control-session lock**. Coordination
  is by convention within the small trusted group (D1), and the event log's
  attribution (D4) settles any dispute.
- This dissolves the single laptop's double-booking: a second client can sit
  on the clubhouse table showing standings ([§3.6](#36-reports-standings-and-printing-area-7))
  while the flight-line client keeps run control.
- **Run-control needs a companion client present.** The base runs a started
  group autonomously, but starting groups, holding, gate-releasing and
  advancing rounds are operator actions with no UI on the headless base —
  whoever holds the run-control hat needs a connected client within reach of
  the flight line.

## 3. Functions — the operator surface, by area

The app is the UI for every base-side capability the requirements assign to
a human role. Grouped by who typically drives each one
([users.md](users.md)); under the no-auth trust model any client can perform
any of them — the role labels describe intent, not access control.

### 3.1 Setup and administration — Organiser (Areas 1–4)

- Master data: pilots, landing-bonus tables, contest templates
  ([Area 1](high-level-requirements.md#area-1--master-data-management)).
- Competition lifecycle: create/open/delete, suspend/resume, Lock
  ([Area 2](high-level-requirements.md#area-2--competition-lifecycle)).
- Competition setup and configuration, including CD-authorised mid-contest
  configuration changes with their recompute warnings and descriptor
  re-issue ([Area 3](high-level-requirements.md#area-3--competition-setup--configuration)).
- Draw generation, validation and lane adjustment
  ([Area 4](high-level-requirements.md#area-4--draw--rounds-generation)).

### 3.2 Run control — Contest Director (6.5)

- Start/abort/restart a group; pause/resume, fast-forward and add
  preparation time; the two distinct prep-gate releases (**device offline**
  vs **pilot unconfirmed**)
  ([6.5](high-level-requirements.md#area-6--display-timer--audio-field-aids)).
- The **group view**: which device holds which pilot (the exclusive claim,
  [5.0](high-level-requirements.md#area-5--scoring)) and each device's
  sync state, so the two gate-release forms are distinguishable at a glance
  ([scorer-device.md §4](scorer-device.md#4-prep-gate-vs-an-offline-device-a1)).
  *(The base computes this view; being headless it is **displayed on a
  companion client** — the pre-D8 "Base Station group view" wording was
  swept 2026-07-08.)*
- **The run-control view must work at phone size** *(owner-decided
  2026-07-08)*: the Contest Director's phone browsing the same web app is a
  valid flight-line client, so run control never depends on the laptop's
  location. Actions from it are attributed like any other client (§1
  name-pick, D4).

### 3.3 Round progression — Announcer / Timekeeper (6.4)

- Confirm round completeness and advance to the next round/group — the
  operator start-action at every boundary
  ([D10](decisions.md#d10--operator-driven-progression-automation-runs-only-inside-a-group)).
- A blocked advance **lists its outstanding items** (missing scores,
  unresolved no-scores, granted-but-unflown re-flights); the Contest
  Director's explicit, attributed **"advance anyway" override** is exercised
  here ([6.4](high-level-requirements.md#area-6--display-timer--audio-field-aids)).

### 3.4 Score administration — Contest Director (Area 5)

Scorer self-correction ends with the group
([D11](decisions.md#d11--the-devices-scope-is-the-current-group)); **all
later change to a flown group's data happens here**. Since Scorers and
pilots have no companion-app write path *(owner-decided 2026-07-08)*, a
pilot or Scorer who spots an error in a closed group **asks the Contest
Director**, who makes the correction through these functions — the human
request is the MVP's correction channel, and the change is event-logged
with the CD's authority and name-pick identity (§1).

- Re-flights and group management, pilot-readiness moves, the lone-pilot /
  F3B-annulment CD approvals ([5.3](high-level-requirements.md#area-5--scoring)).
- Score by pilot ([5.4](high-level-requirements.md#area-5--scoring)),
  retirement/reinstatement ([5.5](high-level-requirements.md#area-5--scoring)),
  validation flags ([5.6](high-level-requirements.md#area-5--scoring)),
  no-score resolution ([5.7](high-level-requirements.md#area-5--scoring)).
- Penalties: impose/revoke, event-logged
  ([5.9](high-level-requirements.md#area-5--scoring)).
- Review of base-rejected late device corrections
  ([scorer-device.md §5](scorer-device.md#5-sync-and-conflict-policy-a2)).

### 3.5 Manual entry and the paper fallback — any operator (5.8, D3)

- Bulk score entry per group and round, for any task type — the entry path
  after any failure reverts the field to pen and paper (D3), and the
  mechanism for the CD's end-of-contest corrections.
- The **CD validation pass that gates Lock**
  ([2.3](high-level-requirements.md#area-2--competition-lifecycle)): review
  flagged anomalies (including derived overflies, [D9](decisions.md#d9--per-flight-timestamps-on-the-base-clock),
  and unreconcilable timestamps), enter missing scores, override
  known-incorrect ones, then lock — including the minimum-rounds /
  no-contest determination.
- Paper-fallback manual entries carry **no timestamps**; overfly there is
  the CD's call (D9).

### 3.6 Reports, standings and printing — Area 7

- All Area 7 reports: results (7.1), custom (7.2), draw reports and the
  **advance-printable blank scoring sheets** (7.3 — the standing paper
  fallback kit), score cards (7.4).
- **Mid-contest standings, offline**: cumulative standings and each
  completed round's results viewable on **any connected companion client**
  between rounds — the MVP's way of displaying round results as the contest
  proceeds without internet
  ([7.1](high-level-requirements.md#area-7--reports)).
- **Printing**: the printer hangs off the companion laptop, not the base.

### 3.7 Publishing — the only internet touchpoint (D6)

- Publishing results when connectivity exists is **the laptop's job, on its
  own connection**; the base never touches the internet. Publishing channel
  is still to be defined (D6).
- Being base-served, the app must be able to **export results to the
  operator's machine** (e.g. downloadable files) so publishing can happen
  from that machine's own connection *(owner-decided 2026-07-08)*.

### 3.8 Fleet support (scorer-device.md §8)

- The **device health view** — battery, sync state, firmware version,
  currently-selected pilot per device — is base-computed, companion-displayed
  (same clarification as the group view, §3.2).

## 4. Descriptor-driven screens (NFR-1)

Companion-app screens that display or edit task data must be driven from the
**one centralised flexible task model** — the same single encoding that
drives device capture, validation and scoring
([non-functional.md NFR-1](non-functional.md#nfr-1--one-centralised-flexible-task-model)).
No companion screen may hard-code per-class behaviour.

## 5. Connectivity and failure behaviour

- **Brief link drops are an annoyance, not a loss** — state is on the base
  ([physical architecture §7](../architecture/physical-architecture.md#7-network--one-radio-three-classes-of-traffic)).
  The app must make its connected/disconnected state obvious and re-attach
  without ceremony.
- Companion traffic is the middle criticality class: it **must not be able
  to degrade the contest-critical scorer-device link** (separate SSID/band,
  client caps or prioritisation — an implementation choice).
- A running group **continues with no client connected**; only run-control
  and round advance wait for one (D8).
- Laptop failure needs no special resilience: another client takes over, or
  pen and paper (D3).

---

## Open items

None currently. Previously-open items, all **resolved with the owner
2026-07-08**:

1. **Delivery form** → **base-served web app** (§1), with results export so
   publishing runs on the operator's own connection (§3.7).
2. **Run-control second client** → yes, by construction: the run-control
   view works at phone size, so the CD's phone browsing the same web app is
   the flight-line client (§3.2). Resolves
   [physical architecture Open item 1](../architecture/physical-architecture.md#open-items).
3. **Terminology sweep** → applied: pre-D8 "at/on the Base Station"
   phrasings (D3 manual entry, the 5.0/6.5 group view, the device health
   view, related user stories) now read as base-owned functions
   displayed/operated through a companion client.
