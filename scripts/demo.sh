#!/usr/bin/env bash
set -e

echo "=== migrate ==="
npm run migrate

echo "=== enqueue 3 jobs ==="
queuectl enqueue '{"id":"job1","command":"echo Hello","priority":1}'
queuectl enqueue '{"id":"job2","command":"bash -lc \"sleep 1 && echo Done\""}'
queuectl enqueue '{"id":"job3","command":"bash -lc \"exit 42\"","max_retries":2}'

echo "=== start 2 workers ==="
queuectl worker start --count 2
sleep 5

echo "=== status ==="
queuectl status

echo "=== list all ==="
queuectl list --state all

echo "=== wait for retries ==="
sleep 8

echo "=== status / dlq ==="
queuectl status
queuectl dlq list

echo "=== stop workers ==="
queuectl worker stop
