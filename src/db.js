import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { nowISO } from './util.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.QUEUECTL_DB || join(__dirname, '..', 'queue.db');

let db;

export const getDB = () => {
  if (!db) {
    db = new Database(DB_PATH, { fileMustExist: false, timeout: 5000 });
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    migrate(db);
  }
  return db;
};

const migrate = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      command TEXT NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('pending','processing','completed','failed','dead')),
      attempts INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      backoff_base INTEGER NOT NULL DEFAULT 2,
      priority INTEGER NOT NULL DEFAULT 0,
      run_at TEXT DEFAULT NULL,
      next_run_at TEXT DEFAULT NULL,
      locked_by TEXT DEFAULT NULL,
      locked_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs(state);
    CREATE INDEX IF NOT EXISTS idx_jobs_sched ON jobs(next_run_at, run_at, priority);

    CREATE TABLE IF NOT EXISTS dlq (
      id TEXT PRIMARY KEY,
      command TEXT NOT NULL,
      attempts INTEGER NOT NULL,
      max_retries INTEGER NOT NULL,
      reason TEXT,
      failed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT NOT NULL,
      exit_code INTEGER,
      stdout TEXT,
      stderr TEXT
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Default config values
  const hasRetries = db.prepare(`SELECT 1 FROM config WHERE key='max_retries'`).get();
  if (!hasRetries) db.prepare(`INSERT INTO config(key,value) VALUES('max_retries','3')`).run();
  const hasBase = db.prepare(`SELECT 1 FROM config WHERE key='backoff_base'`).get();
  if (!hasBase) db.prepare(`INSERT INTO config(key,value) VALUES('backoff_base','2')`).run();
  const hasTimeout = db.prepare(`SELECT 1 FROM config WHERE key='job_timeout_ms'`).get();
  if (!hasTimeout) db.prepare(`INSERT INTO config(key,value) VALUES('job_timeout_ms','60000')`).run();
};

// Handle `npm run migrate`
if (process.argv[2] === 'migrate') {
  getDB();
  console.log(`[${nowISO()}] migration complete at ${DB_PATH}`);
}

// ✅ Export both: getDB() and default instance
export default getDB();   // <— This line provides default export for imports like `import db from './db.js'`
