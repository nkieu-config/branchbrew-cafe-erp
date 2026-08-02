import { ApiError } from './client';
import { NetworkError } from './network-error';

export const MAX_QUERY_RETRIES = 3;

export function isRetriableFailure(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  if (error instanceof ApiError) {
    return error.statusCode === 408 || error.statusCode === 429 || error.statusCode >= 500;
  }
  return false;
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_QUERY_RETRIES && isRetriableFailure(error);
}

export function retryBackoffMs(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 8000);
}
