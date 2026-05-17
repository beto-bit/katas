export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const currentLevel =
  LogLevel[Deno.env.get("LOG_LEVEL") as keyof typeof LogLevel] || LogLevel.INFO;

function log(level: LogLevel, ...args: unknown[]) {
  if (level >= currentLevel) {
    const prefix = `[${new Date().toISOString()}] [${LogLevel[level]}]`;
    console[level === LogLevel.ERROR ? "error" : "log"](prefix, ...args);
  }
}

export const logger = {
  debug: (...args: unknown[]) => log(LogLevel.DEBUG, ...args),
  info: (...args: unknown[]) => log(LogLevel.INFO, ...args),
  warn: (...args: unknown[]) => log(LogLevel.WARN, ...args),
  error: (...args: unknown[]) => log(LogLevel.ERROR, ...args),
};
