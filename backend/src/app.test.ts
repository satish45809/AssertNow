// Tests the health check endpoint and error responses on the Express application.
// Starts the server on an ephemeral port to verify real HTTP responses via fetch.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from './app.js';
import { env } from './config/env.js';

describe('Server HTTP Endpoints', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const application = createApp();
    await new Promise<void>((resolve) => {
      server = application.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('returns 200 with status ok and ISO timestamp for GET /health', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      success: boolean;
      data: { status: string; timestamp: string };
    };

    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
    expect(new Date(body.data.timestamp).toISOString()).toBe(body.data.timestamp);
  });

  it('allows PATCH in Access-Control-Allow-Methods for OPTIONS preflight', async () => {
    const origin = env.CORS_ORIGINS[0] ?? 'http://localhost:5173';
    const response = await fetch(`${baseUrl}/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin
      }
    });

    expect(response.status).toBe(204);
    const allowedMethods = response.headers.get('Access-Control-Allow-Methods');
    expect(allowedMethods).toBeTruthy();
    expect(allowedMethods).toContain('PATCH');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
  });

  it('sets Access-Control-Allow-Origin header when origin is in CORS_ORIGINS', async () => {
    const allowedOrigin = env.CORS_ORIGINS[0] ?? 'http://localhost:5173';
    const response = await fetch(`${baseUrl}/health`, {
      headers: {
        Origin: allowedOrigin
      }
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(allowedOrigin);
  });

  it('does not set Access-Control-Allow-Origin header when origin is not in CORS_ORIGINS', async () => {
    const disallowedOrigin = 'http://not-allowed.example.com';
    const response = await fetch(`${baseUrl}/health`, {
      headers: {
        Origin: disallowedOrigin
      }
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('returns 404 for unknown route in standardized format', async () => {
    const response = await fetch(`${baseUrl}/unknown-route`);
    expect(response.status).toBe(404);

    const body = (await response.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };

    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
