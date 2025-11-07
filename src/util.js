import { randomUUID } from 'node:crypto';

export const nowISO = () => new Date().toISOString();
export const sleep = (ms) => new Promise(res => setTimeout(res, ms));
export const uuid = () => randomUUID();

export const parseJSON = (s) => {
  try { return JSON.parse(s); } catch { return null; }
};

// exponential backoff: base ** attempts (min 1s, cap optional)
export const backoffDelaySec = (base, attempts, capSec = 3600) => {
  const s = Math.max(1, Math.floor(Math.pow(base, attempts)));
  return Math.min(s, capSec);
};
