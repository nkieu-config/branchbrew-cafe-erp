export const OFFLINE_MESSAGE =
  'You appear to be offline. Check your connection and try again.';

export const UNREACHABLE_MESSAGE =
  'Cannot reach the server right now. Please try again in a moment.';

export class NetworkError extends Error {
  readonly isOffline: boolean;

  constructor(message: string, isOffline: boolean) {
    super(message);
    this.name = 'NetworkError';
    this.isOffline = isOffline;
  }
}

function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function createNetworkError(apiUrl: string): NetworkError {
  const offline = isBrowserOffline();
  if (process.env.NODE_ENV === 'development') {
    console.error(
      `[api] Unable to reach ${apiUrl}. Start the backend with: npm run dev:backend`,
    );
  }
  return new NetworkError(offline ? OFFLINE_MESSAGE : UNREACHABLE_MESSAGE, offline);
}
