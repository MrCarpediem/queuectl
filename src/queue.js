import { v4 as v4uuid } from 'uuid';
import { insertJob, listJobs, summary, listDLQ, retryDLQ, getConfig, setConfig } from './repo.js';
import { nowISO, parseJSON } from './util.js';

export const enqueueJob = (jobJsonString) => {
  const parsed = parseJSON(jobJsonString);
  if (!parsed) throw new Error('Invalid JSON payload.');
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

export const listJobsByState = (state) => listJobs({ state });
export const queueSummary = () => summary();

export const dlqList = () => listDLQ();
export const dlqRetry = (jobId) => retryDLQ(jobId);

export const configGet = (key) => getConfig(key);
export const configSet = (key, value) => setConfig(key, value);
