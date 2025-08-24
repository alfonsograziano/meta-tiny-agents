// Create and expose a simple logger that logs to the console

const ENABLE_LOGS = true;

export const logger = {
  log: (message: string) => {
    if (!ENABLE_LOGS) return;
    console.log(message);
  },
  error: (message: string) => {
    if (!ENABLE_LOGS) return;
    console.error(message);
  },
  warn: (message: string) => {
    if (!ENABLE_LOGS) return;
    console.warn(message);
  },
  debug: (message: string) => {
    if (!ENABLE_LOGS) return;
    console.debug(message);
  },
};
