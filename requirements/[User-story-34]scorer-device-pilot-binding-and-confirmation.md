# [STORY-001-034] Bind, Confirm and Re-confirm a Scorer Device to Its Pilot Each Group

> Source: `docs/user-stories/03-scorer.md` §5.0.1–5.0.4 ·
> `docs/requirements/high-level-requirements.md` Area 5.0 ·
> `docs/requirements/users.md` §3 (Scorer), §5 (Pilot cross-check) ·
> `docs/requirements/decisions.md` D2 (dedicated stopwatch-style handheld), D6
> (offline-first), D11 (device scope is the current group) · relates to
> STORY-001-009 (draw/group pilot list), STORY-001-032 (prep gate this
> confirmation feeds)
> Module: 001 (Organiser MVP) · Estimated effort: **4 days**

### Background

There is one Scorer per flying pilot, each on their own device, standing beside
that pilot during the group's working time. The central risk this story exists to
close is the **wrong-pilot failure mode**: if a device is set to the wrong
competitor, a correctly-captured value lands against the wrong person silently.
This story delivers the device-side defence — selecting a competitor from the
group's own pilot list, a pre-group cross-check with the pilot, a **per-group
confirmation guard** that blocks entry until deliberately (re-)armed, and an
**exclusive claim** so two devices can never both hold the same pilot while
another pilot goes uncovered.

The guard re-arms **every group**, deliberately — a Scorer who scored the same
pilot last group must still re-confirm them this group, so a stale selection
carried over from a previous group can never silently capture scores. The same
per-group confirmation is what the Contest Director's prep gate
(STORY-001-032) watches to decide whether preparation can proceed: this story
produces that signal, it does not consume it.

### Business Value

- Attribute every capture automatically to the right pilot, closing the single
  biggest integrity risk in field scoring.
- Let a Scorer work back-to-back groups on one handheld without swapping
  devices or re-joining from scratch.
- Give the Contest Director's prep gate a reliable, per-pilot confirmation
  signal — one pilot can never silently end up with two capture devices while
  another goes Scorer-less.

### Dependencies and Assumptions

- **Prerequisites**: the group's pilot list must exist for the device to select
  from (draw generated/accepted for the round, STORY-001-009); the device has
  received its round/group context from the base station.
- **Data assumptions**: each device holds exactly one active pilot selection at
  a time; a dummy competitor inserted for a lone-pilot safeguard (5.3) is never
  offered as selectable — only real competitors are.
- **Integration points**: the per-group confirmation is the fact the Contest
  Director's prep gate (STORY-001-032 / Area 6.5) consults before releasing
  preparation; the exclusive claim is visible on the base's group view via the
  companion client.
- **Business constraints**: offline-first (D6) — confirmation must survive a
  brief loss of link to the base and reconcile on reconnect; no auth (D1) — the
  guard is a workflow safeguard against mistakes, not a security control.

### Scope In

- Selecting a competitor from the **current group's** pilot list only.
- Displaying the selected pilot prominently (name, pilot number/lane) for the
  Scorer and pilot to cross-check before working time begins.
- A deliberate **per-group** (re-)confirmation, required before any score entry
  is accepted, that **re-arms every group** — no carry-over from the previous
  group.
- Blocking score entry with a clear message while the pilot is unconfirmed for
  the current group.
- Rejecting a second device's attempt to confirm a pilot already claimed by
  another device (**exclusive claim**).
- Re-selecting the pilot on the same device between consecutive groups, without
  needing a different handset or re-joining.

### Scope Out

- The Contest Director releasing the prep gate on a Scorer's behalf ("device
  offline" / "pilot unconfirmed") — STORY-001-032.
- Marking a pilot as unable to fly the group (no-score) — STORY-001-035.
- Actual score capture once a pilot is confirmed — STORY-001-036.
- Device-to-device sync or off-site scoring — Future Enhancements.
- Scorer identity capture (initials/device pairing) — Future Enhancements.

### Acceptance Criteria

#### AC1: The pilot list shows only this group's competitors
**Given** my device is joined to round 4, group 2, and a dummy competitor has
been inserted for a lone pilot in a different group
**When** I open the pilot list
**Then** I see only the competitors flying in round 4 group 2, and no dummy
competitor is ever offered as selectable.

#### AC2: Selecting a competitor sets the device's active target
**Given** the group's pilot list is showing
**When** I select "John Brown, pilot #14"
**Then** John Brown becomes the device's active selection and is shown
prominently by name and pilot number, for me to check against the pilot beside
me.

#### AC3: An unjoined device is reported, not shown empty
**Given** the base station has not yet sent my device its round/group context
**When** I try to open the pilot list
**Then** I am told the device is not yet joined to a group, rather than seeing
an empty or stale list.

#### AC4: Score entry is blocked until the pilot is confirmed for this group
**Given** I selected John Brown for round 4 group 2 but have not yet confirmed
him
**When** I attempt to capture a value
**Then** the attempt is refused, nothing is recorded, and I am told to confirm
the pilot first.

#### AC5: Confirming enables entry
**Given** John Brown is selected but not yet confirmed for round 4 group 2
**When** I deliberately confirm him
**Then** score entry becomes enabled for John Brown in round 4 group 2.

#### AC6: A carried-over selection re-arms unconfirmed for the next group
**Given** I scored John Brown in round 4 group 2 and did not change my
selection
**When** round 4 group 3 begins
**Then** my device treats John Brown as unconfirmed for group 3 and blocks
entry until I confirm him again, even though the selection itself did not
change.

#### AC7: A second device cannot claim an already-confirmed pilot
**Given** another Scorer's device has already confirmed John Brown for round 4
group 2
**When** I select John Brown on my device and attempt to confirm him too
**Then** my confirmation is rejected, I am told John Brown is already claimed
by another device, and I select the correct pilot instead.

#### AC8: Re-selecting corrects a wrong pre-group pick with no residue
**Given** I selected the wrong pilot before the group started and have not
confirmed
**When** I re-select the correct pilot
**Then** the wrong selection leaves no residue — only the newly selected,
still-unconfirmed pilot remains active.

#### AC9: Re-selecting for the next group does not disturb the previous group's results
**Given** I finished scoring John Brown in round 4 group 2
**When** I re-select a different competitor for round 4 group 3 on the same
device
**Then** subsequent entries attribute only to group 3 and the new competitor,
and John Brown's group-2 results are unchanged.

#### Non-Functional Expectations
- The confirmation guard re-arms for every group automatically — no manual
  reset step by an operator.
- Confirmation state survives a brief loss of link to the base station and
  reconciles once the link returns (offline-first, D6).

### INVEST Check

Independent (a self-contained device-to-pilot binding and guard, consumed by
but not dependent on the prep gate) · Valuable (closes the wrong-pilot failure
mode, the single largest integrity risk in field scoring) · Small (4 days, 3
functional points: select + cross-check, per-group guard + exclusive claim,
re-select continuity) · Testable (selection, guard-blocking, exclusive-claim
rejection and cross-group continuity are all directly observable).
