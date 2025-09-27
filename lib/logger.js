/**
 * This is just a wrapper around pino to make it easier to use
 */

import pino from 'pino';

const logger = pino({
  level: process.env.PLUGIN_LOG_LEVEL || 'info',
});

/**
 * Create a child logger with a specific name
 * @param {string} name 
 * @returns {pino.Logger}
 */
export const createLogger = (name) => {
  return logger.child({ name });
};