# Soarscore — User-Story Generation Prompts

This folder holds **one self-contained prompt per user role**. Each prompt is
designed to be handed to a **fresh Claude agent** that has access to the repo
(and therefore to `CLAUDE.md` and everything under `docs/`) but **no prior
conversation context**. Splitting the work one-role-per-agent keeps each agent's
context small and its output focused.

Each agent's job is to write the **user stories** for a single
[user](../../requirements/users.md), fleshing out the requirement
[areas](../../requirements/high-level-requirements.md) that serve that user into
stories with acceptance criteria. Output lands in `docs/user-stories/`.

## The prompts

| # | Prompt | Role | Interaction |
|---|---|---|---|
| 01 | [01-organiser.md](01-organiser.md) | Organiser | Direct — setup & admin |
| 02 | [02-contest-director.md](02-contest-director.md) | Contest Director | Direct — authority & decisions |
| 03 | [03-scorer.md](03-scorer.md) | Scorer | Direct — per-competitor capture |
| 04 | [04-announcer-timekeeper.md](04-announcer-timekeeper.md) | Announcer / Timekeeper | Direct — field aids |
| 05 | [05-pilot.md](05-pilot.md) | Pilot / Competitor | Indirect — reads only |

## Why only these five

`users.md` identifies exactly these five **MVP** roles. The **Team Manager** and
**Jury** are explicitly *deferred beyond the MVP* and have no MVP tasks, so no
prompt is generated for them yet — add one if/when they are pulled into scope.

## How to run

Give one prompt to one agent. The prompts can run **independently and in
parallel**. Each prompt is complete on its own; do not assume an agent has read
the others. Where areas are shared between roles (e.g. Area 5 serves both Scorer
and Pilot), each prompt states which slice of the area belongs to its role so
coverage overlaps as little as possible.
