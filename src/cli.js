#!/usr/bin/env node
import { Command } from 'commander';
import { enqueueJob, listJobsByState, queueSummary, dlqList, dlqRetry, configGet, configSet } from './queue.js';
import { startWorkers, stopWorkers } from './worker.js';

const program = new Command();
program
  .name('queuectl')
  .description('CLI-based background job queue')
  .version('1.0.0');

program
  .command('enqueue')
  .argument('<jobJSON>', 'Job payload JSON')
  .description('Add a new job to the queue')
  .action((jobJSON) => {
    const id = enqueueJob(jobJSON);
    console.log(`enqueued: ${id}`);
  });

const worker = program.command('worker').description('Manage workers');

worker
  .command('start')
  .option('--count <n>', 'Number of workers', '1')
  .description('Start workers')
  .action(async (opts) => {
    await startWorkers(Number(opts.count));
  });

worker
  .command('stop')
  .description('Stop workers gracefully')
  .action(() => {
    stopWorkers();
  });

program
  .command('status')
  .description('Show summary of job states & active workers')
  .action(() => {
    const s = queueSummary();
    console.table(s.byState);
    console.log({ total: s.total, pending: s.pending, active: s.active, dlq: s.dlq });
  });

program
  .command('list')
  .option('--state <state>', 'pending|processing|completed|failed|dead|all', 'all')
  .description('List jobs by state')
  .action((opts) => {
    const rows = listJobsByState(opts.state);
    if (!rows.length) return console.log('no jobs');
    console.table(rows.map(r => ({
      id: r.id, state: r.state, cmd: r.command, attempts: r.attempts,
      max_retries: r.max_retries, prio: r.priority, run_at: r.run_at, next_run_at: r.next_run_at
    })));
  });

const dlq = program.command('dlq').description('Dead Letter Queue commands');

dlq
  .command('list')
  .description('List DLQ jobs')
  .action(() => {
    const rows = dlqList();
    if (!rows.length) return console.log('dlq empty');
    console.table(rows);
  });

dlq
  .command('retry')
  .argument('<jobId>', 'Job ID to retry from DLQ')
  .description('Retry a DLQ job')
  .action((jobId) => {
    const ok = dlqRetry(jobId);
    console.log(ok ? `DLQ job ${jobId} requeued` : `DLQ job ${jobId} not found`);
  });

const config = program.command('config').description('Manage configuration');

config
  .command('get')
  .argument('<key>', 'config key')
  .action((key) => {
    console.log(configGet(key));
  });

config
  .command('set')
  .argument('<key>', 'max-retries | backoff-base | job-timeout-ms')
  .argument('<value>', 'value')
  .action((key, value) => {
    const map = {
      'max-retries': 'max_retries',
      'backoff-base': 'backoff_base',
      'job-timeout-ms': 'job_timeout_ms',
    };
    const k = map[key] || key; // allow raw key too
    configSet(k, value);
    console.log(`set ${k}=${value}`);
  });

program.parse();
