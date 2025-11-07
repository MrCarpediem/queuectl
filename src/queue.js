import { v4 as v4uuid } from 'uuid';
import  db  from './db.js';
import { insertJob, listJobs, summary, listDLQ, retryDLQ, getConfig, setConfig } from './repo.js';
import { nowISO, parseJSON } from './util.js';

/**
 * Enqueue a new job into the queue.
 * Handles command validation, default config loading,
 * and optional scheduling via run_at field.
 */
export const enqueueJob = (jobJsonString) => {
  const parsed = parseJSON(jobJsonString);
  if (!parsed) throw new Error('Invalid JSON payload.');

  if (!parsed.command || String(parsed.command).trim() === '') {
    throw new Error('Missing required "command" field in job JSON.');
  }

  const id = parsed.id || v4uuid();
  const maxRetries = parsed.max_retries ?? Number(getConfig('max_retries') || 3);
  const backoffBase = parsed.backoff_base ?? Number(getConfig('backoff_base') || 2);
  const priority = parsed.priority ?? 0;
  const run_at = parsed.run_at || null;
  const created_at = nowISO();

  insertJob({
    id,
    command: String(parsed.command || '').trim(),
    state: 'pending',
    attempts: 0,
    max_retries: maxRetries,
    backoff_base: backoffBase,
    priority,
    run_at,
    next_run_at: null,
    created_at,
    updated_at: created_at,
  });

  return id;
};

/**
 * List jobs filtered by state
 */
export const listJobsByState = (state) => listJobs({ state });

/**
 * List only jobs that are ready to run now
 * (pending and run_at <= CURRENT_TIMESTAMP)
 */
export const listReadyJobs = () => {
  return listJobs({
    where: "state='pending' AND (run_at IS NULL OR run_at <= CURRENT_TIMESTAMP)",
  });
};

/**
 * Get job summary
 */
export const queueSummary = () => summary();

/**
 * DLQ utilities
 */
export const dlqList = () => listDLQ();
export const dlqRetry = (jobId) => retryDLQ(jobId);

/**
 * Config utilities
 */
export const configGet = (key) => getConfig(key);
export const configSet = (key, value) => setConfig(key, value);

/**
 * Developer helper: Clear all jobs and logs (for testing)
 */
export const clearAllJobs = () => {
  db.prepare('DELETE FROM jobs').run();
  db.prepare('DELETE FROM logs').run();
  db.prepare('DELETE FROM dlq').run();
  console.log('✅ All jobs, logs, and DLQ entries cleared successfully.');
};
