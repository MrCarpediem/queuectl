import { exec } from 'node:child_process';
import { once } from 'node:events';

export const runCommand = async (command, timeoutMs) => {
  return new Promise((resolve) => {
    const child = exec(command, { shell: '/bin/bash' }, (error, stdout, stderr) => {
      // callback fires on completion OR error
    });

    let finished = false;

    const done = (exitCode, stdout = '', stderr = '') => {
      if (finished) return;
      finished = true;
      try { child.kill('SIGKILL'); } catch {}
      resolve({ exitCode, stdout, stderr });
    };

    child.on('spawn', async () => {
      // no-op
    });

    // Collect buffers
    let out = '', err = '';
    child.stdout?.on('data', d => (out += d.toString()));
    child.stderr?.on('data', d => (err += d.toString()));

    child.on('close', (code) => done(code ?? 0, out, err));
    child.on('error', (e) => done(1, out, String(e)));

    // timeout
    if (timeoutMs && timeoutMs > 0) {
      setTimeout(() => done(124, out, (err + '\n[queuectl] timeout reached').trim()), timeoutMs);
    }
  });
};
