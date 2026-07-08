import Database from "better-sqlite3";
import type { Attribution } from "@soarscore/shared";
import { migrate } from "./migrate.js";

export interface EventRecord {
  seq: number;
  timestamp: string;
  scope: string;
  type: string;
  payload: unknown;
  attribution: Attribution;
}

export interface AppendInput {
  scope: string;
  type: string;
  payload: unknown;
  attribution: Attribution;
}

interface EventRow {
  seq: number;
  timestamp: string;
  scope: string;
  type: string;
  payload: string;
  actor_name: string;
  origin_client: string;
  authority: string;
}

function rowToRecord(row: EventRow): EventRecord {
  return {
    seq: row.seq,
    timestamp: row.timestamp,
    scope: row.scope,
    type: row.type,
    payload: JSON.parse(row.payload),
    attribution: {
      actorName: row.actor_name,
      originClient: row.origin_client,
      authority: row.authority,
    },
  };
}

export type EventLogger = (record: EventRecord) => void;

// The only module that touches the events table (D4). better-sqlite3 is
// synchronous, so a single connection naturally serialises appends.
export class EventStore {
  private readonly db: Database.Database;
  private readonly insertStmt;
  private readonly readAllStmt;
  private readonly onAppend?: EventLogger;

  constructor(dbPath: string, onAppend?: EventLogger) {
    this.onAppend = onAppend;
    this.db = new Database(dbPath);
    migrate(this.db);
    this.insertStmt = this.db.prepare(
      `INSERT INTO events (timestamp, scope, type, payload, actor_name, origin_client, authority)
       VALUES (@timestamp, @scope, @type, @payload, @actorName, @originClient, @authority)`,
    );
    this.readAllStmt = this.db.prepare("SELECT * FROM events ORDER BY seq ASC");
  }

  append(input: AppendInput): EventRecord {
    const timestamp = new Date().toISOString();
    const result = this.insertStmt.run({
      timestamp,
      scope: input.scope,
      type: input.type,
      payload: JSON.stringify(input.payload),
      actorName: input.attribution.actorName,
      originClient: input.attribution.originClient,
      authority: input.attribution.authority,
    });
    const record: EventRecord = {
      seq: Number(result.lastInsertRowid),
      timestamp,
      scope: input.scope,
      type: input.type,
      payload: input.payload,
      attribution: input.attribution,
    };
    this.onAppend?.(record);
    return record;
  }

  readAll(): EventRecord[] {
    return (this.readAllStmt.all() as EventRow[]).map(rowToRecord);
  }

  close(): void {
    this.db.close();
  }
}
