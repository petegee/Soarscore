# [STORY-001-006] Reusable Contest Templates

> Source: `docs/user-stories/01-organiser.md` §1.3, §3.1 (seeding) · `docs/requirements/high-level-requirements.md` Areas 1.3, 3.1
> Module: 001 (Organiser MVP) · Estimated effort: **3 days**

### Background

A club runs the same kinds of contest repeatedly — the monthly F5J, the
winter F3K series. Configuring draw, scoring and task settings from scratch
each time is slow and error-prone, and requires understanding the scoring
maths. A contest template captures a configured competition's settings, with
its discipline, under a reusable name; creating a competition from the
template seeds all of it, leaving everything editable. Templates are master
data shared across competitions.

### Business Value

- Provide the Organiser with one-step reuse of a proven competition
  configuration.
- Support quick, correct event creation without re-deriving scoring settings.
- Enable template maintenance without disturbing competitions already created
  from a template.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-003 (competitions), STORY-001-004
  (discipline), STORY-001-007/008 (there must be draw/scoring/task settings
  worth templating). Recommended late in the setup group.
- **Data assumptions**: a template is discipline-specific; per-discipline
  task detail is defined by the deferred per-discipline requirements.
- **Integration points**: consumed by competition creation (STORY-001-003's
  flow gains a "seed from template" path).
- **Business constraints**: templates capture configuration, never roster or
  results.

### Scope In

- Save a configured competition (or a fresh configuration) as a named,
  discipline-specific template capturing draw / scoring / task settings.
- Create a competition seeded from a template, with every setting still
  editable.
- Edit and delete templates without affecting competitions already created
  from them.

### Scope Out

- The configuration content itself (STORY-001-004/007/008).
- Multi-discipline templates — templates are single-discipline by design.

### Acceptance Criteria

#### AC1: Save a configuration as a template
**Given** an F5J competition with configured draw, scoring and task settings
**When** the Organiser saves it as template "Club F5J standard"
**Then** the template captures those settings and the discipline F5J under
that name, available when creating future competitions.

#### AC2: Seed a new competition from a template
**Given** the "Club F5J standard" template
**When** the Organiser creates a competition from it named "Levin Spring F5J"
**Then** the new competition's draw, scoring and task settings are pre-filled
from the template and the Organiser can still change any of them.

#### AC3: Discipline travels with the template and cannot silently mismatch
**Given** a competition created from the F5J template
**When** the Organiser opens it
**Then** its discipline is F5J and cannot be silently changed to a class
whose tasks differ (the STORY-001-004 discipline guard applies).

#### AC4: Template edits do not touch existing competitions
**Given** two competitions already created from "Club F5J standard"
**When** the Organiser edits the template's preparation-time setting, or
deletes the template entirely
**Then** both existing competitions keep the settings they were created with,
unchanged.

### INVEST Check

Independent (pure master-data feature over existing configuration) ·
Valuable (repeat events set up in minutes) · Small (3 days, 3 functional
points: save-as-template, seed-from-template, template lifecycle isolation) ·
Testable.
