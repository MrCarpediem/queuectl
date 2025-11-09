## queuectl: CLI-Based Background Job Queue System

### Assignment Submission for Flam Ai Placement

---

## Overview

`queuectl` is a Node.js-based CLI tool for managing background job queues with support for retries, scheduling, dead letter queue (DLQ), and worker management. It is designed for reliability, extensibility, and developer productivity.

---

## Features

- **Enqueue Jobs:** Add jobs with custom shell commands and scheduling options.
- **Worker Management:** Start/stop multiple background workers for job processing.
- **Retry & Backoff:** Automatic retries with exponential backoff and configurable limits.
- **Dead Letter Queue (DLQ):** Failed jobs are moved to DLQ for inspection and manual retry.
- **Job Listing & Status:** List jobs by state, view ready-to-run jobs, and get queue summaries.
- **Web Dashboard:** Modern UI with real-time job monitoring, charts, and dark/light mode.
- **Configurable:** Set max retries, backoff base, and job timeout via CLI.
- **Developer Tools:** Clear all jobs/logs for testing and development.

---



## Setup Instructions

1. **Install Dependencies:**
	```bash
	npm install
	```

2. **Database Migration:**
	The database is auto-migrated on first run. To manually migrate:
	```bash
	node src/db.js migrate
	```

3. **Start Web Dashboard:**
	```bash
	node src/web.js
	```
	Visit http://localhost:3000 to access the monitoring interface.

4. **Run Demo Script (Optional):**
	```bash
	bash scripts/demo.sh
	```

---

## CLI Usage

### Enqueue a Job
```bash
queuectl enqueue '{"command": "echo Hello World"}'
```

### Start Workers
```bash
queuectl worker start --count 2
```

### Stop Workers
```bash
queuectl worker stop
```

### List Jobs
```bash
queuectl list --state pending
queuectl list --ready
```

### View Status Summary
```bash
queuectl status
```

### Dead Letter Queue (DLQ)
```bash
queuectl dlq list
queuectl dlq retry <jobId>
```

### Configuration
```bash
queuectl config get max-retries
queuectl config set max-retries 5
queuectl config set backoff-base 3
queuectl config set job-timeout-ms 120000
```

### Developer Helper
```bash
queuectl jobs:clear
```

---

## Architecture & File Structure

```
queuectl/
├── package.json
├── README.md
├── workers.json
├── scripts/
│   └── demo.sh
└── src/
	 ├── cli.js         # CLI entry point (Commander.js)
	 ├── db.js          # SQLite DB setup & migration
	 ├── executor.js    # Shell command execution with timeout
	 ├── queue.js       # Queue logic: enqueue, list, summary, DLQ, config
	 ├── repo.js        # DB repository: jobs, DLQ, logs, config
	 ├── util.js        # Utilities: time, UUID, backoff, JSON
	 ├── web.js         # Web Dashboard with real-time monitoring
	 └── worker.js      # Worker process management & job execution
```

---

## Web Dashboard

The built-in web dashboard provides real-time monitoring and visualization of your job queue:

- **Real-time Updates:** Auto-refreshing job statistics and charts
- **Dark/Light Mode:** Toggle between themes for comfortable viewing
- **Job Distribution:** Visual breakdown of job states via doughnut chart
- **Quick Access:** Direct links to view all jobs and DLQ entries
- **Responsive Design:** Built with Tailwind CSS for a modern, mobile-friendly interface

To access the dashboard:
```bash
node src/web.js
```
Then visit http://localhost:3000 in your browser.

---

## How It Works

1. **Enqueue jobs** via CLI with a shell command and optional scheduling.
2. **Workers** pick up pending jobs, execute them, and log results.
3. **Retries** are handled with exponential backoff up to a configurable limit.
4. **Failed jobs** exceeding retries are moved to the DLQ for inspection or manual retry.
5. **Status and job lists** are available for monitoring and debugging via CLI and web dashboard.

---

## Notes for Flam Ai Placement

- The project demonstrates practical skills in Node.js, SQLite, CLI design, process management, and robust error handling.
- Code is modular, well-commented, and follows best practices for maintainability.
- Extensible for future features (e.g., job types, notifications, web UI).
- Ready for demonstration and further development.

---

## License
MIT

## External Demo

A demo file / additional resources are available here:

https://drive.google.com/file/d/1xuShsG0At7ansaM6GPSgSfYaC4Tkt0I5/view?usp=sharing

Add this to your browser to download or view the demo assets used in the project.
