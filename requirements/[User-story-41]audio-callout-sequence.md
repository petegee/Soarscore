# [STORY-001-041] Fire the Group's Audio Callout Sequence on the Shared Clock

> Source: `docs/user-stories/04-announcer-timekeeper.md` §6.2.1, §6.2.2 ·
> `docs/requirements/high-level-requirements.md` Area 6.2 · `docs/requirements/
> decisions.md` D10 (operator-driven progression) · `docs/requirements/rules/
> 00-general-rules.md` §1, §2 · relates to STORY-001-040 (the shared clock and
> phased sequence these callouts fire from), STORY-001-044 (the group-start
> action that begins the sequence)
> Module: 001 (Organiser MVP) · Estimated effort: **4 days**

### Background

A duration-shaped group's phased sequence ([STORY-001-040](%5BUser-story-40%5Dgroup-timer-engine-and-shared-clock.md))
needs to be **heard**, not just displayed: pilots must know whether they are
in the current group, and everyone on the field needs reliable, correctly
timed audible cues through preparation, working time and the landing window,
without the Announcer/Timekeeper watching a clock and calling each one by
hand. This story delivers that mandatory callout set, fired entirely off the
shared clock, plus any optional extra in-working-time reminders the
competition has configured.

The mandatory set is fixed: round/group and pilot names (flying order, name
and pilot number) announced before preparation, the start of preparation, the
remaining working time announced each minute on the minute, every second from
−30 s to zero, a loud horn at end of working time, and the landing window's
start and its all-down (end) call. For the MVP, pilot names are voiced by
text-to-speech in English only — pronunciation of international names is an
accepted MVP limitation, not a blocker.

### Business Value

- Let every pilot and helper hear, without watching a screen, whether they
  are in the current group and what phase the group is in.
- Give the Announcer/Timekeeper reliable, consistent callouts without having
  to watch the clock and call each one manually.
- Let a competition add its own optional in-working-time reminders on top of
  a fixed, dependable mandatory set.

### Dependencies and Assumptions

- **Prerequisites**: the shared clock and phased sequence exist to fire
  callouts from (STORY-001-040); the group's flying order, pilot names and
  numbers are already established by the draw (Area 4).
- **Data assumptions**: whether optional in-working-time reminders are
  enabled, and their timing, comes from the per-competition field-aid
  settings ([3.8](../docs/requirements/high-level-requirements.md#area-3--competition-setup--configuration)).
- **Integration points**: fires strictly off the shared clock from
  STORY-001-040; a start/abort/restart of the group re-bases the clock and
  this story's pending callouts with it.
- **Business constraints**: pilot names are voiced by English-only
  text-to-speech in the MVP (Future Enhancements covers other languages/
  recorded audio); no spoken wording, voice or sound design is prescribed
  here.

### Scope In

- Announcing the round and group by name before the sequence proceeds.
- Announcing each competitor in the group, in flying order, by name and pilot
  number.
- Announcing the start of preparation.
- Announcing remaining working time each minute on the minute.
- Announcing every second of the final 30 seconds of working time, down to
  zero.
- Sounding a loud horn at the end of working time.
- Announcing the start of the landing window and its all-down (end) call.
- Cancelling and re-basing pending callouts with the clock when a group is
  started, aborted or restarted — never leaving a previous run's callouts
  queued.
- Firing any additional in-working-time reminders when the competition has
  configured and enabled them, alongside the mandatory set.

### Scope Out

- The shared clock and phased sequence themselves — STORY-001-040.
- The field display board — STORY-001-042.
- Configuring which optional reminders are enabled and their timing — Area
  3.8, the Organiser's.
- Non-English voicing or recorded-audio callouts — Future Enhancement.
- The deliberate action that starts, aborts or restarts a group —
  STORY-001-044 / STORY-001-032 (Contest Director abort).

### Acceptance Criteria

#### AC1: Round, group and pilots are announced before the sequence proceeds
**Given** Round 2 Group B is about to run, with competitors John Brown (#4),
Mary Field (#11) and Alex Reid (#7) in that flying order
**When** the group's sequence begins
**Then** the speakers announce "Round 2, Group B", then announce each
competitor in flying order by name and pilot number (John Brown, pilot 4;
Mary Field, pilot 11; Alex Reid, pilot 7).

#### AC2: Preparation start is announced
**Given** the pilots have just been announced
**When** preparation begins
**Then** the start of preparation is announced.

#### AC3: Working time is called each minute on the minute
**Given** working time is running with 8 minutes remaining
**When** each whole minute passes
**Then** the remaining time is announced on that minute (8, 7, 6 … minutes
remaining), with no minute skipped or repeated.

#### AC4: The final 30 seconds are called every second
**Given** working time reaches its final 30 seconds
**When** it counts down
**Then** every second from −30 s to zero is announced individually.

#### AC5: A loud horn sounds at end of working time
**Given** working time reaches zero
**When** it ends
**Then** a loud horn sounds, distinct from the spoken callouts.

#### AC6: Landing window start and all-down are announced
**Given** the landing window begins after working time ends, and later all
competitors have landed
**When** the landing window starts, and separately when it ends
**Then** its start is announced, and its all-down (end) is announced.

#### AC7: A restart cancels and re-bases pending callouts
**Given** a group's working time is running with its per-minute and −30 s
callouts scheduled
**When** the Contest Director aborts and restarts the group
([STORY-001-032](%5BUser-story-32%5Drun-control-authority.md))
**Then** all of that run's pending callouts are cancelled, and the callout
sequence re-bases cleanly from preparation with the restarted clock — none of
the previous run's callouts fire late.

#### AC8: Configured optional reminders fire alongside the mandatory set
**Given** the competition has configured and enabled a 4-minute
in-working-time reminder
**When** working time reaches 4 minutes remaining
**Then** that reminder fires in addition to the mandatory per-minute callout;
**and given** no optional reminders are configured, **when** working time
runs, **then** only the mandatory callouts fire.

#### Non-Functional Expectations
- Every callout is driven by the shared clock (STORY-001-040) so it cannot
  fire at a time the field board disagrees with.
- Pilot names are voiced by English-only text-to-speech for the MVP;
  mispronunciation of international names is an accepted limitation, not a
  defect to fix within this story.

### INVEST Check

Independent (a callout player driven by, but separable from, the shared clock
it consumes) · Valuable (the reliable, hands-free audible cues the field
depends on) · Small (4 days, 3 functional points: mandatory announce/callout
set, cancel-and-re-base on restart, configurable optional reminders) ·
Testable (each mandatory callout's timing, the re-base on restart, and
optional-reminder firing are all directly observable).
