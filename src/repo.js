import db from './db.js';
import { nowISO } from './util.js';

/* ---------------------------------------------------------
   CONFIG TABLE SETUP (Auto-create if not exists)
--------------------------------------------------------- */
db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

/* ---------------------------------------------------------
   CONFIG MANAGEMENT (Clean and Silent)
--------------------------------------------------------- */
export const getConfig = (key) => {
  const normalized = key.replace(/-/g, '_');
  const row = db.prepare(`SELECT value FROM config WHERE key = ?`).get(normalized);
  if (row && row.value !== undefined) return row.value;
  return null;
};

export const setConfig = (key, value) => {
  const normalized = key.replace(/-/g, '_');
  db.prepare(`
    INSERT INTO config (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(normalized, String(value));
};

/* ---------------------------------------------------------
   JOB MANAGEMENT
--------------------------------------------------------- */
export const insertJob = (job) => {
  db.prepare(`
    INSERT INTO jobs (
      id, command, state, attempts, max_retries, backoff_base,
      priority, run_at, next_run_at, created_at, updated_at
    )
    VALUES (
      @id, @command, @state, @attempts, @max_retries, @backoff_base,
      @priority, @run_at, @next_run_at, @created_at, @updated_at
    )
  `).run(job);
};

/* ---------------------------------------------------------
   WORKER OPERATIONS
--------------------------------------------------------- */
export const claimNextJob = (workerId) => {
  const now = nowISO();
  const stmt = db.prepare(`
    UPDATE jobs
    SET state = 'processing', locked_by = ?, locked_at = ?, updated_at = ?
    WHERE id = (
      SELECT id FROM jobs
      WHERE state = 'pending'
        AND (run_at IS NULL OR run_at <= ?)
        AND (next_run_at IS NULL OR next_run_at <= ?)
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
    )
    RETURNING *
  `);
  return stmt.get(workerId, now, now, now, now) || null;
};

/* ---------------------------------------------------------
   JOB LIFECYCLE (Complete / Retry / Move to DLQ)
--------------------------------------------------------- */
export const completeJob = (id) => {
  const now = nowISO();
  db.prepare(`
    UPDATE jobs
    SET state = 'completed',
        updated_at = ?,
        locked_by = NULL,
        locked_at = NULL
    WHERE id = ?
  `).run(now, id);
};

export const scheduleRetry = ({ id, attempts, nextRunAtISO }) => {
  const now = nowISO();
  db.prepare(`
    UPDATE jobs
    SET state = 'pending',
        attempts = ?,
        next_run_at = ?,
        updated_at = ?,
        locked_by = NULL,
        locked_at = NULL
    WHERE id = ?
  `).run(attempts, nextRunAtISO, now, id);
};

export const moveToDLQ = ({ id, command, attempts, max_retries, reason }) => {
  const failed_at = nowISO();
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO dlq (id, command, attempts, max_retries, reason, failed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      command,
      attempts,
      max_retries,
      reason || 'max_retries_exhausted',
      failed_at
    );

    db.prepare(`
      UPDATE jobs
      SET state = 'dead',
          updated_at = ?,
          locked_by = NULL,
          locked_at = NULL
      WHERE id = ?
    `).run(failed_at, id);
  });
  tx();
};

/* ---------------------------------------------------------
   LOGGING
--------------------------------------------------------- */
export const insertLog = (log) => {
  db.prepare(`
    INSERT INTO logs (
      job_id, started_at, finished_at, exit_code, stdout, stderr
    )
    VALUES (
      @job_id, @started_at, @finished_at, @exit_code, @stdout, @stderr
    )
  `).run(log);
};

/* ---------------------------------------------------------
   LISTING & SUMMARY
--------------------------------------------------------- */
export const listJobs = ({ state, where }) => {
  if (where) {
    return db.prepare(`SELECT * FROM jobs WHERE ${where} ORDER BY created_at ASC`).all();
  }
  if (state && state !== 'all') {
    return db.prepare(`SELECT * FROM jobs WHERE state = ? ORDER BY created_at ASC`).all(state);
  }
  return db.prepare(`SELECT * FROM jobs ORDER BY created_at ASC`).all();
};

export const listDLQ = () => db.prepare(`SELECT * FROM dlq ORDER BY failed_at DESC`).all();

export const retryDLQ = (jobId) => {
  const row = db.prepare(`SELECT * FROM dlq WHERE id = ?`).get(jobId);
  if (!row) return false;

  const now = nowISO();
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM dlq WHERE id = ?`).run(jobId);
    db.prepare(`
      UPDATE jobs
      SET state = 'pending',
          attempts = 0,
          next_run_at = NULL,
          updated_at = ?,
          locked_by = NULL,
          locked_at = NULL
      WHERE id = ?
    `).run(now, jobId);
  });
  tx();
  return true;
};

export const summary = () => {
  const counts = db.prepare(`
    SELECT state, COUNT(*) AS c FROM jobs GROUP BY state
  `).all();

  const byState = Object.fromEntries(counts.map((r) => [r.state, r.c]));
  const total = db.prepare(`SELECT COUNT(*) AS c FROM jobs`).get().c;
  const active = db.prepare(`SELECT COUNT(*) AS c FROM jobs WHERE state = 'processing'`).get().c;
  const pending = db.prepare(`SELECT COUNT(*) AS c FROM jobs WHERE state = 'pending'`).get().c;
  const dlq = db.prepare(`SELECT COUNT(*) AS c FROM dlq`).get().c;

  return { total, pending, active, dlq, byState };
};
