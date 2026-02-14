import 'server-only';

export class TimeoutError extends Error {
  readonly ms: number;

  constructor(ms: number, message = 'انتهت مهلة الطلب. حاول مرة أخرى.') {
    super(message);
    this.name = 'TimeoutError';
    this.ms = ms;
  }
}

export class CircuitOpenError extends Error {
  readonly key: string;
  readonly retryAfterMs: number;

  constructor(key: string, retryAfterMs: number) {
    super('الخدمة غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.');
    this.name = 'CircuitOpenError';
    this.key = key;
    this.retryAfterMs = retryAfterMs;
  }
}

type CircuitState = {
  failures: number;
  openedUntil: number;
  lastFailureAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __MASAR_CIRCUITS__: Map<string, CircuitState> | undefined;
}

function circuits() {
  if (!globalThis.__MASAR_CIRCUITS__) {
    globalThis.__MASAR_CIRCUITS__ = new Map<string, CircuitState>();
  }
  return globalThis.__MASAR_CIRCUITS__;
}

export async function withTimeout<T>(promise: PromiseLike<T>, ms: number, message?: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms, message)), ms);
  });

  try {
    const work = Promise.resolve(promise);
    return (await Promise.race([work, timeoutPromise])) as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function withCircuitBreaker<T>(
  key: string,
  opts: { failureThreshold: number; cooldownMs: number },
  fn: () => Promise<T>,
): Promise<T> {
  const store = circuits();
  const now = Date.now();
  const state = store.get(key);

  if (state?.openedUntil && state.openedUntil > now) {
    throw new CircuitOpenError(key, state.openedUntil - now);
  }

  try {
    const result = await fn();
    store.delete(key);
    return result;
  } catch (error) {
    const prev = state ?? { failures: 0, openedUntil: 0, lastFailureAt: 0 };
    const failures = prev.failures + 1;
    const openedUntil = failures >= opts.failureThreshold ? now + opts.cooldownMs : 0;

    store.set(key, {
      failures,
      openedUntil,
      lastFailureAt: now,
    });

    throw error;
  }
}
