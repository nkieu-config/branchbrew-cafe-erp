import { notifySessionExpired } from '@/lib/auth/session-expiry';
import { createNetworkError } from './network-error';

const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const API_URL =
  typeof window === 'undefined'
    ? process.env.INTERNAL_API_URL || PUBLIC_API_URL
    : PUBLIC_API_URL;

export { API_URL };

type ApiErrorBody = {
  statusCode?: number;
  code?: string;
  message?: string;
  details?: unknown;
  requestId?: string;
};

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(message: string, statusCode: number, body: ApiErrorBody = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = body.code;
    this.requestId = body.requestId;
    this.details = body.details;
  }
}

function networkError(): Error {
  return createNetworkError(API_URL);
}

async function throwApiError(response: Response): Promise<never> {
  const errorData: ApiErrorBody = await response.json().catch(() => ({}));
  if (response.status === 401) {
    notifySessionExpired();
  }
  throw new ApiError(
    errorData.message || 'An error occurred while fetching data',
    response.status,
    errorData,
  );
}

export async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const url = `${API_URL}${endpoint}`;

  const defaultOptions: RequestInit = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  let response: Response;
  try {
    response = await fetch(url, { ...defaultOptions, ...options });
  } catch {
    throw networkError();
  }

  if (!response.ok) await throwApiError(response);

  if (response.status === 204) return null;

  const text = await response.text();
  if (!text || text.trim() === '') return null;
  try {
    return JSON.parse(text);
  } catch {
    console.error('Failed to parse JSON response:', text);
    return null;
  }
}

export async function fetchAPIBlob(endpoint: string): Promise<Blob> {
  const url = `${API_URL}${endpoint}`;

  let response: Response;
  try {
    response = await fetch(url, { credentials: 'include' });
  } catch {
    throw networkError();
  }

  if (!response.ok) await throwApiError(response);

  return response.blob();
}
