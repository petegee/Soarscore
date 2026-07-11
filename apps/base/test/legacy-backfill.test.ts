import { describe, expect, it } from "vitest";
import { stockModelIdFor } from "@soarscore/shared";
import { EventStore } from "../src/eventstore/event-store.js";
import { CompetitionProjection } from "../src/competitions/projection.js";
import { TemplateProjection } from "../src/templates/projection.js";

const attribution = { actorName: "tester", originClient: "test-client", authority: "organiser" };

// Safeguard 5: pre-D12 events carry a bare `discipline`. The projections must
// resolve them to the matching stock model on rebuild — no log rewrite.
describe("legacy discipline back-fill (D12)", () => {
  it("resolves a legacy competition.created discipline to its stock model", () => {
    const eventStore = new EventStore(":memory:");
    eventStore.append({
      scope: "competitions",
      type: "competition.created",
      payload: {
        id: "comp-legacy",
        name: "Old Cup",
        date: "2025-01-01",
        venue: null,
        discipline: "F5L",
        pilotNumbersEnabled: false,
        pilotClassesEnabled: false,
        pilotClasses: [],
      },
      attribution,
    });

    const projection = new CompetitionProjection();
    projection.rebuild(eventStore.readAll());
    expect(projection.getById("comp-legacy")?.classModelId).toBe(stockModelIdFor("F5L"));
  });

  it("resolves a legacy contestTemplate.created discipline to its stock model", () => {
    const eventStore = new EventStore(":memory:");
    eventStore.append({
      scope: "master-data",
      type: "contestTemplate.created",
      payload: {
        id: "tmpl-legacy",
        name: "Old Template",
        discipline: "F3K",
        pilotNumbersEnabled: false,
        pilotClassesEnabled: false,
        pilotClasses: [],
      },
      attribution,
    });

    const projection = new TemplateProjection();
    projection.rebuild(eventStore.readAll());
    expect(projection.getById("tmpl-legacy")?.classModelId).toBe(stockModelIdFor("F3K"));
  });
});
