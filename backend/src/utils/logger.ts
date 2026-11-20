// Creates the shared Pino logger for recording system events.
// Automatically masks passwords, tokens, and keys so secrets never leak into logs.

import pino from 'pino';
import { env } from '../config/env.js';

// Sensitive fields that must be hidden in logs
const redactedFields = [
  'req.headers.authorization',
  'headers.authorization',
  'authorization',
  '*.*secret*',
  '*.*token*',
  '*.*password*',
  '*.*privatekey*',
  '*.*refreshtoken*',
  '*.*accesstoken*',
  '*.*clientsecret*',
  'secret',
  'token',
  'password',
  'privateKey',
  'refreshToken',
  'accessToken',
  'clientSecret'
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: redactedFields,
    censor: '[REDACTED]'
  }
});
