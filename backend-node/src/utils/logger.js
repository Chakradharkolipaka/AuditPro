function base(level, message, meta = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  // Structured logs for cloud platforms
  console.log(JSON.stringify(entry));
}

export const logger = {
  info: (message, meta) => base("info", message, meta),
  warn: (message, meta) => base("warn", message, meta),
  error: (message, meta) => base("error", message, meta),
};
