function serializeMeta(meta) {
  if (!meta) {
    return '';
  }

  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return '';
  }
}

function log(level, message, meta) {
  const timestamp = new Date().toISOString();
  console[level](`[${timestamp}] ${message}${serializeMeta(meta)}`);
}

export const logger = {
  info(message, meta) {
    log('log', message, meta);
  },
  warn(message, meta) {
    log('warn', message, meta);
  },
  error(message, meta) {
    log('error', message, meta);
  },
};
