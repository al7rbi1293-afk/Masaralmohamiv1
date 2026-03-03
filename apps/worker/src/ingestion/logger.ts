import type { StageLogStatus } from './types';

type LogData = Record<string, unknown>;

function emit(level: 'info' | 'error', event: string, data: LogData = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...data,
  };

  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
    return;
  }
  console.log(line);
}

export function logInfo(event: string, data?: LogData) {
  emit('info', event, data);
}

export function logError(event: string, data?: LogData) {
  emit('error', event, data);
}

export function stageEvent(
  stage: string,
  status: StageLogStatus,
  data: LogData = {},
) {
  emit(status === 'failed' ? 'error' : 'info', 'ingestion_stage', {
    stage,
    status,
    ...data,
  });
}
