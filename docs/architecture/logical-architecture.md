# Soarscore — Logical High-Level Architecture

A logical (not deployment) view of the system: **what the parts are and how they
talk**, independent of any specific technology, framework or wire protocol.
It complements the [requirements](../requirements/high-level-requirements.md) and
[users](../requirements/users.md) — see those for *what* each part does and *who*
it serves.

## The shape in one line

One **Base Station** runs the competition; **N Scorer Devices** capture live
results against it two-way, one Scorer per flying competitor; a **bright field
board and loudspeakers** plus each Scorer device follow the group's shared clock;
**users** interact according to their [role](../requirements/users.md).

## Diagram

```mermaid
flowchart TB
    %% ---- People ----
    subgraph Officials["Administrative / officiating users"]
        direction LR
        ORG["👤 Organiser<br/><i>setup &amp; admin</i>"]
        CD["👤 Contest Director<br/><i>authority &amp; decisions</i>"]
    end

    ANN["👤 Announcer / Timekeeper<br/><i>runs the group on the flight line</i>"]

    subgraph Scorers["Per-competitor field users — one Scorer per flying pilot"]
        direction LR
        SC1["👤 Scorer 1"]
        SC2["👤 Scorer 2"]
        SCn["👤 Scorer N"]
    end

    PILOT["👤 Pilot / Competitor<br/><i>indirect — reads only, never self-scores</i>"]

    %% ---- Systems ----
    BASE["🖥️ Base Station<br/><b>Competition Management Software</b><br/>master data · setup · draw · scoring · results"]

    FIELD["📺 Field Aids<br/><b>bright board + loudspeakers</b><br/>round · group · phase · countdown · callouts<br/><i>(Area 6)</i>"]

    subgraph Devices["N Scorer Devices — score capture, one per Scorer"]
        direction LR
        D1["📱 Scorer Device 1"]
        D2["📱 Scorer Device 2"]
        Dn["📱 Scorer Device N"]
    end

    %% ---- Two-way base <-> device link ----
    BASE -- "pilot · group · round · phase · working time · countdown" --> D1
    D1   -- "task results / metrics" --> BASE
    BASE -- "pilot · group · round · phase · working time · countdown" --> D2
    D2   -- "task results / metrics" --> BASE
    BASE -- "pilot · group · round · phase · working time · countdown" --> Dn
    Dn   -- "task results / metrics" --> BASE

    %% ---- Users to systems ----
    ORG   -- "configure, draw, administer scores, report" --> BASE
    CD    -- "penalties, re-flights, retirements, run-control, lock &amp; publish" --> BASE
    ANN   -- "run phased timer, callouts, board; start/advance groups" --> FIELD
    SC1   -- "select pilot · record flight" --> D1
    SC2   -- "select pilot · record flight" --> D2
    SCn   -- "select pilot · record flight" --> Dn

    %% ---- Field aids driven by the base station ----
    BASE -- "round · group · phase · shared clock" --> FIELD

    %% ---- Pilot: indirect ----
    BASE -. "published draw &amp; results" .-> PILOT
    PILOT -. "cross-checks device is set to their name" .-> D1

    classDef system fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#0d47a1;
    classDef device fill:#e8f5e9,stroke:#2e7d32,stroke-width:1px,color:#1b5e20;
    classDef person fill:#fff3e0,stroke:#e65100,stroke-width:1px,color:#e65100;
    classDef fieldaid fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px,color:#4a148c;

    class BASE system;
    class D1,D2,Dn device;
    class ORG,CD,ANN,SC1,SC2,SCn,PILOT person;
    class FIELD fieldaid;
```

## What the diagram says

- **Base Station** — the single authority. Runs the competition management
  software: master data, setup, the fair anti-repeat draw, live scoring
  aggregation, and results. Everything reconciles here.
- **N Scorer Devices** — one per Scorer, capturing live during a group's working
  time. The **base↔device link is two-way**:
  - **down** (base → device): the pilot, group, round and working-time context the
    device needs to present the right entry — plus the live **phase and countdown**
    it mirrors from the field-aid clock ([Area 6](../requirements/high-level-requirements.md#area-6--display-timer--audio-field-aids));
  - **up** (device → base): the competitor's task results / metrics (times,
    landings, laps, heights, motor runs, penalties).
- **Users**, attached by [role](../requirements/users.md):
  - **Organiser** and **Contest Director** operate the **Base Station** —
    administrative setup vs. officiating authority.
  - Each **Scorer** operates **one Scorer Device**, recording the adjacent pilot.
    Several work in parallel within a group.
  - The **Announcer / Timekeeper** operates the **Field Aids** (Area 6) — the
    bright board and loudspeakers — running each group's automatic phased sequence
    (prep → working → landing) and advancing rounds. The **Contest Director** holds
    the run-control authority actions (prep pause / fast-forward, gate override,
    abort) via the Base Station.
  - The **Pilot** is **indirect**: reads the published draw and results, and
    cross-checks (before the group starts) that a Scorer's device is set to their
    name — but never self-scores.

## Notes & caveats

- **Logical, not physical.** "Two-way link" is a logical dependency, not a claim
  about transport, topology or sync strategy. The MVP assumes Scorers capture live
  into the shared system; *remote* scoring and device-to-device sync are
  [future enhancements](../requirements/high-level-requirements.md#future-enhancements).
- **Scorer Devices are dedicated hardware** — ESP32 stopwatch-style handhelds
  running custom firmware; the device *is* the Scorer's stopwatch, and no other
  device types are permitted. Devices are **offline-tolerant**: if the base link
  drops they keep capturing and sync when it returns. The whole system is
  **offline-first** — no internet required to run a contest; results publish when
  connectivity exists. See
  [decisions.md](../requirements/decisions.md) (D2, D6).
- **Field Aids (Area 6) are confirmed and in MVP scope** — a bright board and
  loudspeakers, always present and driven by the Base Station from one shared
  clock. The Announcer/Timekeeper here is the *group-level* operator, **not** the
  per-competitor Scorer (see the
  [naming caution](../requirements/users.md#4-announcer--timekeeper-field-aid-operator)).
- **One person, several hats** — Organiser, Contest Director and Announcer may be
  the same individual at a small contest; the **Scorer** role cannot be merged,
  since a whole group flies at once.
