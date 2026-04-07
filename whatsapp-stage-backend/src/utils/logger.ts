const isProd = process.env.NODE_ENV === "production";

function formatMessage(level: string, message: string, meta?: unknown): string {
  const ts = new Date().toISOString();
  if (meta === undefined) {
    return `[${ts}] [${level}] ${message}`;
  }
  return `[${ts}] [${level}] ${message} ${JSON.stringify(meta)}`;
}

export const logger = {
  info(message: string, meta?: unknown): void {
    console.log(formatMessage("INFO", message, meta));
  },

  warn(message: string, meta?: unknown): void {
    console.warn(formatMessage("WARN", message, meta));
  },

  error(message: string, meta?: unknown): void {
    console.error(formatMessage("ERROR", message, meta));
  },

  debug(message: string, meta?: unknown): void {
    if (!isProd) {
      console.debug(formatMessage("DEBUG", message, meta));
    }
  }
};
