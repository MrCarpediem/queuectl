#!/usr/bin/env node
import { Command } from "commander";
import {
  enqueueJob,
  listJobsByState,
  listReadyJobs,
  queueSummary,
  dlqList,
  dlqRetry,
  configGet,
  configSet,
  clearAllJobs
} from "./queue.js";
import { startWorkers, stopWorkers } from "./worker.js";

const program = new Command();

program
  .name("queuectl")
  .description("CLI-based background job queue system with retry, DLQ, and scheduling support")
  .version("1.2.0");

/* ---------------------------------------------------------
   ENQUEUE
--------------------------------------------------------- */
program
  .command("enqueue")
  .argument("<jobJSON>", "Job payload JSON string")
  .description("Add a new job to the queue")
  .action((jobJSON) => {
    try {
      enqueueJob(jobJSON);
    } catch (err) {
      console.error("❌ Error:", err.message);
    }
  });

/* ---------------------------------------------------------
   WORKER COMMANDS
--------------------------------------------------------- */
const worker = program.command("worker").description("Manage background workers");

worker
  .command("start")
  .option("--count <n>", "Number of workers", "1")
  .description("Start N worker processes")
  .action(async (opts) => {
    await startWorkers(Number(opts.count));
  });

worker
  .command("stop")
  .description("Stop running workers gracefully")
  .action(() => {
    stopWorkers();
  });

/* ---------------------------------------------------------
   STATUS SUMMARY
--------------------------------------------------------- */
program
  .command("status")
  .description("Show summary of job states & active workers")
  .action(() => {
    const s = queueSummary();
    console.log("\n📊 Job Summary:\n");
    console.table(s.byState);
    console.log({
      total: s.total,
      pending: s.pending,
      active: s.active,
      dlq: s.dlq
    });
  });

/* ---------------------------------------------------------
   JOB LISTING
--------------------------------------------------------- */
program
  .command("list")
  .option("--state <state>", "Filter by state (pending|processing|completed|failed|dead|all)", "all")
  .option("--ready", "Show only jobs ready to run now")
  .description("List jobs by state or readiness")
  .action((opts) => {
    let rows = [];
    if (opts.ready) rows = listReadyJobs();
    else rows = listJobsByState(opts.state);

    if (!rows.length) return console.log("📭 No jobs found.");
    console.log("\n📋 Job List:\n");
    console.table(
      rows.map((r) => ({
        id: r.id,
        state: r.state,
        cmd: r.command,
        attempts: r.attempts,
        max_retries: r.max_retries,
        prio: r.priority,
        run_at: r.run_at,
        next_run_at: r.next_run_at
      }))
    );
  });

/* ---------------------------------------------------------
   DLQ COMMANDS
--------------------------------------------------------- */
const dlq = program.command("dlq").description("Dead Letter Queue commands");

dlq
  .command("list")
  .description("List jobs in Dead Letter Queue")
  .action(() => {
    const rows = dlqList();
    if (!rows.length) return console.log("📭 DLQ empty");
    console.log("\n☠️  Dead Letter Queue:\n");
    console.table(rows);
  });

dlq
  .command("retry")
  .argument("<jobId>", "Job ID to retry from DLQ")
  .description("Retry a job from Dead Letter Queue")
  .action((jobId) => {
    const ok = dlqRetry(jobId);
    console.log(ok ? `🔁 DLQ job ${jobId} requeued successfully.` : `❌ DLQ job ${jobId} not found.`);
  });

/* ---------------------------------------------------------
   CONFIGURATION
--------------------------------------------------------- */
const config = program.command("config").description("Manage system configuration");

config
  .command("get")
  .argument("<key>", "config key")
  .action((key) => {
    console.log(configGet(key));
  });

config
  .command("set")
  .argument("<key>", "max-retries | backoff-base | job-timeout-ms")
  .argument("<value>", "value")
  .action((key, value) => {
    const map = {
      "max-retries": "max_retries",
      "backoff-base": "backoff_base",
      "job-timeout-ms": "job_timeout_ms"
    };
    const normalized = map[key] || key;
    configSet(normalized, value);
    console.log(`⚙️  Updated ${normalized}=${value}`);
  });

/* ---------------------------------------------------------
   DEVELOPER UTIL (CLEAR)
--------------------------------------------------------- */
program
  .command("clear")
  .description("Delete all jobs, logs, and DLQ entries")
  .action(() => {
    clearAllJobs();
  });

program.parse();
