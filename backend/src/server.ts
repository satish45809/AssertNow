// Starts the Express web server listening on the configured network port.
// Handles system signals to shut down smoothly when the process is stopped.

import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const application = createApp();

const server = application.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server started successfully');
});

function handleGracefulShutdown(signalName: string): void {
  logger.info({ signal: signalName }, 'Shutting down server gracefully');

  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
