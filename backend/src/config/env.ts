// Loads and validates all environment variables for the application.
// This is the only file allowed to read process.env directly.

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
    .default('info'),
  CORS_ORIGINS: z
    .string()
    .min(1, 'CORS_ORIGINS must not be empty')
    .transform((value) => value.split(',').map((origin) => origin.trim())),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)'),
  DEFAULT_ORG_ID: z.string().min(1, 'DEFAULT_ORG_ID is required'),
  SF_API_VERSION: z.string().regex(/^\d+\.\d+$/, 'SF_API_VERSION must be in format e.g. 60.0')
});

const parseResult = environmentSchema.safeParse(process.env);

if (!parseResult.success) {
  const errorMessages: string[] = [];

  for (const issue of parseResult.error.issues) {
    const fieldName = issue.path.join('.');
    errorMessages.push(`${fieldName}: ${issue.message}`);
  }

  const combinedErrors = errorMessages.join('; ');
  throw new Error(`Environment validation failed: ${combinedErrors}`);
}

export const env = parseResult.data;
