import { v4 as v4uuid } from "uuid";
import db from "./db.js";
import {
  insertJob,
  listJobs,
  summary,
  listDLQ,
  retryDLQ,
  getConfig,
  setConfig,
} from "./repo.js";
import { nowISO, parseJSON } from "./util.js";

/* ---------------------------------------------------------
   ENQUEUE: Add a new job to queue
--------------------------------------------------------- */
export const enqueueJob = (jobJsonString) => {
  const parsed = parseJSON(jobJsonString);
  if (!parsed) throw new Error("Invalid JSON payload.");

  if (!parsed.command || String(parsed.command).trim() === "") {
    throw new Error('Missing required "command" field in job JSON.');
  }

  const id = parsed.id || v4uuid();

  // ✅ Safe config read
  const maxRetries = parsed.max_retries ?? Number(getConfig("max_retries") || 3);
  const backoffBase = parsed.backoff_base ?? Number(getConfig("backoff_base") || 2);
  const priority = parsed.priority ?? 0;
  const run_at = parsed.run_at || null;
  const created_at = nowISO();

  insertJob({
    id,
    command: String(parsed.command || "").trim(),
    state: "pending",
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

/* ---------------------------------------------------------
   JOB LISTING
--------------------------------------------------------- */
export const listJobsByState = (state) => listJobs({ state });

export const listReadyJobs = () =>
  listJobs({
    where: "state='pending' AND (run_at IS NULL OR run_at <= CURRENT_TIMESTAMP)",
  });

/* ---------------------------------------------------------
   SUMMARY
--------------------------------------------------------- */
export const queueSummary = () => summary();

/* ---------------------------------------------------------
   DEAD LETTER QUEUE (DLQ)
--------------------------------------------------------- */
export const dlqList = () => listDLQ();

export const dlqRetry = (jobId) => retryDLQ(jobId);

/* ---------------------------------------------------------
   CONFIG UTILITIES
--------------------------------------------------------- */
const keyMap = {
  "max-retries": "max_retries",
  "backoff-base": "backoff_base",
  "job-timeout-ms": "job_timeout_ms",
};

/* ---------------------------------------------------------
   CONFIG UTILITIES
--------------------------------------------------------- */
export const configGet = (key) => {
  const map = {
    "max-retries": "max_retries",
    "backoff-base": "backoff_base",
    "job-timeout-ms": "job_timeout_ms",
  };
  const normalizedKey = map[key] || key;
  // ✅ just return the value — no console.log here
  return getConfig(normalizedKey);
};

export const configSet = (key, value) => {
  const map = {
    "max-retries": "max_retries",
    "backoff-base": "backoff_base",
    "job-timeout-ms": "job_timeout_ms",
  };
  const normalizedKey = map[key] || key;
  // ✅ just update silently — CLI will handle printing
  return setConfig(normalizedKey, value);
};


/* ---------------------------------------------------------
   DEVELOPER UTILITY (CLEANUP)
--------------------------------------------------------- */
export const clearAllJobs = () => {
  db.prepare("DELETE FROM jobs").run();
  db.prepare("DELETE FROM logs").run();
  db.prepare("DELETE FROM dlq").run();
};
