type LogLevel = 'info' | 'warn' | 'error';

type LogData = Record<string, unknown>;

function emit(level: LogLevel, event: string, data: LogData = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...data,
  };

  const line = JSON.stringify(payload);

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function logInfo(event: string, data?: LogData) {
  emit('info', event, data);
}

export function logWarn(event: string, data?: LogData) {
  emit('warn', event, data);
}

export function logError(event: string, data?: LogData) {
  emit('error', event, data);
}
