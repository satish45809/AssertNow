/**
 * Centralized API Client
 * Manages HTTP communication with the AssertNow Backend Engine.
 * Enforces strict error throwing with ZERO silent fallbacks.
 * Configurable via VITE_API_BASE_URL or NEXT_PUBLIC_API_BASE_URL.
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
  public static getBaseUrl(): string {
    const raw =
      (import.meta as any).env?.VITE_API_BASE_URL ||
      (import.meta as any).env?.NEXT_PUBLIC_API_BASE_URL ||
      (import.meta as any).env?.VITE_API_URL ||
      'http://localhost:5000';
    return String(raw).replace(/\/+$/, '');
  }

  public static getUrl(endpoint: string): string {
    const base = this.getBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    // If endpoint already starts with http/https, use it directly
    if (/^https?:\/\//i.test(endpoint)) {
      return endpoint;
    }

    // If base already contains /api/salesforce
    if (base.endsWith('/api/salesforce')) {
      if (cleanEndpoint.startsWith('/api/salesforce/')) {
        return `${base}${cleanEndpoint.slice('/api/salesforce'.length)}`;
      }
      return `${base}${cleanEndpoint}`;
    }

    // Base is e.g. http://localhost:5000
    if (cleanEndpoint.startsWith('/api/salesforce/')) {
      return `${base}${cleanEndpoint}`;
    }
    if (cleanEndpoint.startsWith('/api/')) {
      return `${base}${cleanEndpoint}`;
    }
    return `${base}/api/salesforce${cleanEndpoint}`;
  }

  public static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = this.getUrl(endpoint);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorCode =
          data?.error?.code ||
          (typeof data?.error === 'string' ? data.error : null) ||
          `HTTP_${response.status}`;
        const errorMessage =
          data?.error?.message ||
          data?.message ||
          (typeof data?.error === 'string' ? data.error : null) ||
          `Request failed with status ${response.status} (${response.statusText})`;
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
