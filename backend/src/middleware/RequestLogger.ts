/**
 * Structured HTTP Request Logger Middleware
 */

import { Context, Next } from 'hono';

export class RequestLogger {
  public static async log(c: Context, next: Next) {
    const start = performance.now();
    const { method, url } = c.req;

    await next();

    const duration = Math.round(performance.now() - start);
    const status = c.res.status;

    const statusColor = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
    const reset = '\x1b[0m';

    console.log(
      `[${new Date().toISOString()}] ${method} ${new URL(url).pathname} ${statusColor}${status}${reset} - ${duration}ms`
    );
  }
}

