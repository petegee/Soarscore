import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { EventStore } from "../src/eventstore/event-store.js";
import { migrate } from "../src/eventstore/migrate.js";

const attribution = { actorName: "tester", originClient: "test-client", authority: "organiser" };

describe("EventStore", () => {
  it("appends events and reads them back in order", () => {
    const store = new EventStore(":memory:");
    store.append({ scope: "master-data", type: "pilot.created", payload: { a: 1 }, attribution });
    store.append({ scope: "master-data", type: "pilot.updated", payload: { a: 2 }, attribution });

    const all = store.readAll();
    expect(all).toHaveLength(2);
    expect(all[0]!.seq).toBeLessThan(all[1]!.seq);
    expect(all[0]!.type).toBe("pilot.created");
    expect(all[1]!.type).toBe("pilot.updated");
  });

  it("enforces immutability via triggers on the same schema the store uses", () => {
    const raw = new Database(":memory:");
    migrate(raw);
    raw.exec(
      "INSERT INTO events VALUES (1, 'ts', 'scope', 'type', '{}', 'a', 'c', 'organiser')",
    );
    expect(() => raw.exec("UPDATE events SET type = 'x' WHERE seq = 1")).toThrow(
      /events are immutable/,
    );
    expect(() => raw.exec("DELETE FROM events WHERE seq = 1")).toThrow(/events are immutable/);
    raw.close();
  });
});
