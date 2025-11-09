// ✅ Simplified & flexible db.js
// Uses the same DB connection for all modules (CLI, worker, etc.)
// Local default = ./queue.db (no need for long path)

import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { nowISO } from "./util.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ✅ Use env var if available, else fall back to local queue.db
const DB_PATH = process.env.QUEUECTL_DB || resolve(__dirname, "../queue.db");

let dbInstance = null;

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      command TEXT NOT NULL,
      state TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      backoff_base INTEGER DEFAULT 2,
      priority INTEGER DEFAULT 0,
      run_at TEXT,
      next_run_at TEXT,
      locked_by TEXT,
      locked_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dlq (
      id TEXT PRIMARY KEY,
      command TEXT NOT NULL,
      attempts INTEGER,
      max_retries INTEGER,
      reason TEXT,
      failed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT,
      started_at TEXT,
      finished_at TEXT,
      exit_code INTEGER,
      stdout TEXT,
      stderr TEXT
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const defaults = [
    ["max_retries", "3"],
    ["backoff_base", "2"],
    ["job_timeout_ms", "60000"]
  ];

  const stmt = db.prepare(`
    INSERT INTO config(key,value)
    VALUES(?,?)
    ON CONFLICT(key) DO NOTHING
  `);

  for (const [k, v] of defaults) stmt.run(k, v);
}

export default (() => {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH, { timeout: 5000 });
    dbInstance.pragma("journal_mode = WAL");
    dbInstance.pragma("synchronous = NORMAL");
    migrate(dbInstance);
  }
  return dbInstance;
})();

if (process.argv[2] === "migrate") {
  console.log(`[${nowISO()}] migration complete at ${DB_PATH}`);
}
