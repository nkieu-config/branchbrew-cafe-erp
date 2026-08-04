export const MAX_OUTBOX_ATTEMPTS = 5;
export const OUTBOX_BATCH_SIZE = 50;
export const MAX_DRAIN_ITERATIONS = 20;
export const RETRY_BACKOFF_BASE_MS = 30 * 1000;
export const STALE_PROCESSING_MS = 5 * 60 * 1000;

export function retryBackoffMs(attempts: number): number {
  const boundedAttempts = Math.min(Math.max(attempts, 1), MAX_OUTBOX_ATTEMPTS);
  return RETRY_BACKOFF_BASE_MS * 2 ** (boundedAttempts - 1);
}
