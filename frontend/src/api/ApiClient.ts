/**
 * Centralized API Client
 * Manages HTTP communication with the AssertNow Backend Engine.
 * Enforces strict error throwing with ZERO silent fallbacks.
 */

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number, code: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ApiClient {
  public static readonly BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api/salesforce';

  public static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorCode = data?.error?.code || (typeof data?.error === 'string' ? data.error : null) || `HTTP_${response.status}`;
        const errorMessage = data?.error?.message || data?.message || (typeof data?.error === 'string' ? data.error : null) || `Request failed with status ${response.status} (${response.statusText})`;
        const errorDetails = data?.error?.details || data?.details || data;

        throw new ApiError(errorMessage, response.status, errorCode, errorDetails);
      }

      return data?.data !== undefined ? data.data : data;
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        throw err;
      }
      const nativeError = err as Error;
      throw new ApiError(
        `Network / Backend Connection Error: ${nativeError.message}`,
        0,
        'BACKEND_OFFLINE',
        nativeError
      );
    }
  }

  public static get<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', headers });
  }

  public static post<T>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  public static put<T>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  public static patch<T>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  public static delete<T>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    });
  }
}
