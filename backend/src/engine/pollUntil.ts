// Generic polling utility that repeatedly executes an operation until a condition is met or timeout expires.
// Injects clock and sleep functions so tests execute instantly without real wall-clock delays.

export interface PollClock {
  now: () => number;
  sleep: (milliseconds: number) => Promise<void>;
}

export const defaultClock: PollClock = {
  now: () => Date.now(),
  sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
};

export interface PollOptions {
  timeoutMilliseconds: number;
  intervalMilliseconds: number;
  clock?: PollClock;
}

export interface PollResult<T> {
  passed: boolean;
  value: T;
  attempts: number;
}

// Rule: When elapsed time equals or exceeds timeoutMilliseconds, polling stops and does not try again.
export async function pollUntil<T>(
  check: () => Promise<{ passed: boolean; value: T }>,
  options: PollOptions
): Promise<PollResult<T>> {
  const clock = options.clock ?? defaultClock;
  const startTime = clock.now();
  let attempts = 0;
  let lastResult: { passed: boolean; value: T } | null = null;

  while (true) {
    attempts++;
    lastResult = await check();

    if (lastResult.passed) {
      return { passed: true, value: lastResult.value, attempts };
    }

    const elapsed = clock.now() - startTime;
    const remainingTime = options.timeoutMilliseconds - elapsed;

    if (remainingTime <= 0) {
      break;
    }

    const waitDuration = Math.min(options.intervalMilliseconds, remainingTime);
    await clock.sleep(waitDuration);

    if (clock.now() - startTime >= options.timeoutMilliseconds) {
      break;
    }
  }

  return {
    passed: false,
    value: lastResult.value,
    attempts
  };
}
