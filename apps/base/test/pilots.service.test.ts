import { describe, expect, it } from "vitest";
import { EventStore } from "../src/eventstore/event-store.js";
import { PilotLibraryProjection } from "../src/pilots/projection.js";
import { NoRostersYetChecker } from "../src/pilots/roster-reference-checker.js";
import { PilotService } from "../src/pilots/service.js";
import { NotFoundError, ValidationError } from "../src/pilots/errors.js";

const attribution = { actorName: "tester", originClient: "test-client", authority: "organiser" };

function buildService() {
  const eventStore = new EventStore(":memory:");
  const projection = new PilotLibraryProjection();
  const service = new PilotService(eventStore, projection, new NoRostersYetChecker());
  return { eventStore, projection, service };
}

describe("PilotService", () => {
  it("creates, updates, and deletes a pilot", () => {
    const { service } = buildService();

    const created = service.create(
      { name: "Ada Lovelace", registrationId: "NZ1", club: "Wellington", contact: "ada@example.com" },
      attribution,
    );
    expect(created.name).toBe("Ada Lovelace");

    const updated = service.update(
      created.id,
      { name: "Ada L.", registrationId: null, club: null, contact: null },
      attribution,
    );
    expect(updated.registrationId).toBeNull();
    expect(service.get(created.id).name).toBe("Ada L.");

    service.delete(created.id, attribution);
    expect(() => service.get(created.id)).toThrow(NotFoundError);
  });

  it("rebuilds identical state via full replay", () => {
    const { eventStore, service } = buildService();
    service.create({ name: "Grace Hopper", registrationId: null, club: null, contact: null }, attribution);
    const p2 = service.create(
      { name: "Katherine Johnson", registrationId: "K1", club: null, contact: null },
      attribution,
    );
    service.update(p2.id, { name: "K. Johnson", registrationId: "K1", club: "X", contact: null }, attribution);

    const before = service.list();

    const freshProjection = new PilotLibraryProjection();
    freshProjection.rebuild(eventStore.readAll());

    expect(freshProjection.getAll()).toEqual(before);
  });

  it("rejects a whitespace-only name", () => {
    const { service } = buildService();
    expect(() =>
      service.create({ name: "   ", registrationId: null, club: null, contact: null }, attribution),
    ).toThrow(ValidationError);
  });

  it("allows clearing optional fields on edit", () => {
    const { service } = buildService();
    const pilot = service.create(
      { name: "Bessie Coleman", registrationId: "R1", club: "C1", contact: "hi" },
      attribution,
    );
    const updated = service.update(
      pilot.id,
      { name: "Bessie Coleman", registrationId: "", club: "", contact: "" },
      attribution,
    );
    expect(updated).toMatchObject({ registrationId: null, club: null, contact: null });
  });

  it("retains both pilots when names collide", () => {
    const { service } = buildService();
    const a = service.create({ name: "John Brown", registrationId: null, club: "A", contact: null }, attribution);
    const b = service.create({ name: "John Brown", registrationId: null, club: "B", contact: null }, attribution);
    expect(a.id).not.toBe(b.id);
    expect(service.list()).toHaveLength(2);
  });

  it("issues a new id when a deleted pilot is recreated", () => {
    const { service } = buildService();
    const first = service.create({ name: "Bert", registrationId: null, club: null, contact: null }, attribution);
    service.delete(first.id, attribution);
    const second = service.create({ name: "Bert", registrationId: null, club: null, contact: null }, attribution);
    expect(second.id).not.toBe(first.id);
  });

  it("records attribution on the event row, defaulting actor to unknown", () => {
    const { eventStore, service } = buildService();
    service.create(
      { name: "Attributed", registrationId: null, club: null, contact: null },
      { actorName: "unknown", originClient: "unknown-client", authority: "organiser" },
    );
    service.create(
      { name: "Named Actor", registrationId: null, club: null, contact: null },
      { actorName: "Pete", originClient: "client-42", authority: "organiser" },
    );

    const [first, second] = eventStore.readAll();
    expect(first!.attribution.actorName).toBe("unknown");
    expect(second!.attribution.actorName).toBe("Pete");
    expect(second!.attribution.originClient).toBe("client-42");
  });

  it("fails to update or delete an unknown id", () => {
    const { service } = buildService();
    expect(() =>
      service.update("missing", { name: "X", registrationId: null, club: null, contact: null }, attribution),
    ).toThrow(NotFoundError);
    expect(() => service.delete("missing", attribution)).toThrow(NotFoundError);
  });
});
