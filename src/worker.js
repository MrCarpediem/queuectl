import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import fs from "node:fs";
import {
  nowISO,
  sleep,
  backoffDelaySec
} from "./util.js";
import {
  claimNextJob,
  completeJob,
  scheduleRetry,
  moveToDLQ,
  insertLog,
  getConfig
} from "./repo.js";
import { runCommand } from "./executor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PID_FILE = process.env.QUEUECTL_PIDS || join(__dirname, "..", "workers.json");

/* ---------------------------------------------------------
   START WORKERS (Master)
--------------------------------------------------------- */
export const startWorkers = async (count = 1) => {
  const pids = [];
  for (let i = 0; i < count; i++) {
    const child = fork(join(__dirname, "worker.js"), ["child"], { stdio: "inherit" });
    pids.push(child.pid);
  }
  fs.writeFileSync(PID_FILE, JSON.stringify({ started_at: nowISO(), pids }, null, 2));
  console.log(`[${nowISO()}] started ${count} worker(s). PIDs: ${pids.join(", ")}`);
};

/* ---------------------------------------------------------
   STOP WORKERS
--------------------------------------------------------- */
export const stopWorkers = () => {
  if (!fs.existsSync(PID_FILE)) {
    console.log("No running workers found.");
    return;
  }
  const { pids } = JSON.parse(fs.readFileSync(PID_FILE, "utf-8"));
  let stopped = 0;
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
      stopped++;
    } catch {}
  }
  fs.rmSync(PID_FILE, { force: true });
  console.log(`[${nowISO()}] sent SIGTERM to ${stopped} worker(s). They will exit after current job.`);
};

/* ---------------------------------------------------------
   CHILD WORKER LOOP
--------------------------------------------------------- */
const childLoop = async () => {
  const workerId = `w-${process.pid}`;
  const timeoutMs = Number(getConfig("job_timeout_ms") || 60000);
  let stopping = false;

  process.on("SIGTERM", () => (stopping = true));

  console.log(`[${nowISO()}] worker ${process.pid} loop started`);

  while (true) {
    if (stopping) {
      await sleep(250);
      continue;
    }

    const job = claimNextJob(workerId);
    if (!job) {
      await sleep(300); // idle polling
      if (stopping) break;
      continue;
    }

    const started_at = nowISO();
    const result = await runCommand(job.command, timeoutMs);
    const finished_at = nowISO();

    insertLog({
      job_id: job.id,
      started_at,
      finished_at,
      exit_code: result.exitCode,
      stdout: result.stdout?.slice(0, 65535) ?? "",
      stderr: result.stderr?.slice(0, 65535) ?? ""
    });

    if (result.exitCode === 0) {
      console.log(`✅ Job ${job.id} completed successfully.`);
      completeJob(job.id);
    } else {
      const attempts = job.attempts + 1;
      const maxRetries = job.max_retries;

      if (attempts >= maxRetries) {
        console.log(
          `☠️  Job ${job.id} failed after ${attempts}/${maxRetries} attempts. Moving to DLQ.`
        );
        moveToDLQ({
          id: job.id,
          command: job.command,
          attempts,
          max_retries: maxRetries,
          reason: `exit ${result.exitCode}`
        });
      } else {
        const base = job.backoff_base;
        const delaySec = backoffDelaySec(base, attempts);
        const nextRunAtISO = new Date(Date.now() + delaySec * 1000).toISOString();
        console.log(
          `🔁 Job ${job.id} failed (exit ${result.exitCode}). Retrying in ${delaySec}s.`
        );
        scheduleRetry({ id: job.id, attempts, nextRunAtISO });
      }
    }

    if (stopping) break;
  }

  console.log(`[${nowISO()}] worker ${process.pid} exiting...`);
  process.exit(0);
};

if (process.argv[2] === "child") {
  childLoop();
}
