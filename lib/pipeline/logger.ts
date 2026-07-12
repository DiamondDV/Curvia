type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogFields {
  jobId?: string;
  stage?: string;
  [key: string]: unknown;
}

/**
 * Minimal structured logger — JSON lines to stdout/stderr. Swap for
 * pino/winston later without touching call sites, since every call
 * goes through this one module.
 */
function log(level: LogLevel, message: string, fields: LogFields = {}): void {
  const line = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...fields,
  });

  if (level === 'error' || level === 'warn') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, fields?: LogFields) => log('debug', message, fields),
  info: (message: string, fields?: LogFields) => log('info', message, fields),
  warn: (message: string, fields?: LogFields) => log('warn', message, fields),
  error: (message: string, fields?: LogFields) => log('error', message, fields),
};
