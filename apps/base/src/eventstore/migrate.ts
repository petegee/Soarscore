import type Database from "better-sqlite3";

// Idempotent boot-time migration. The immutability triggers are the
// enforcement point for the append-only log — no code path may UPDATE or
// DELETE an events row, and the DB refuses it even if one tried.
export function migrate(db: Database.Database): void {
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      scope TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      origin_client TEXT NOT NULL,
      authority TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS events_no_update
    BEFORE UPDATE ON events
    BEGIN
      SELECT RAISE(ABORT, 'events are immutable');
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS events_no_delete
    BEFORE DELETE ON events
    BEGIN
      SELECT RAISE(ABORT, 'events are immutable');
    END;
  `);
}
