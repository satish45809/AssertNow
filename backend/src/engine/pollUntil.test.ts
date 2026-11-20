// Tests the pollUntil utility with simulated clocks and sleep durations.
// Verifies instant execution, retry iterations, timeout terminations, and interval enforcement.

import { describe, it, expect, vi } from 'vitest';
import { pollUntil, type PollClock } from './pollUntil.js';

describe('pollUntil', () => {
  function createFakeClock(initialTime = 1000): { clock: PollClock; sleeps: number[] } {
    let currentTime = initialTime;
    const sleeps: number[] = [];

    const clock: PollClock = {
      now: () => currentTime,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        currentTime += ms;
      }
    };

    return { clock, sleeps };
  }

  it('passes on the first try with 1 attempt and zero sleeps', async () => {
    const { clock, sleeps } = createFakeClock();
    const checkFn = vi.fn().mockResolvedValue({ passed: true, value: 'ok' });

    const result = await pollUntil(checkFn, {
      timeoutMilliseconds: 5000,
      intervalMilliseconds: 1000,
      clock
    });

    expect(result.passed).toBe(true);
    expect(result.value).toBe('ok');
    expect(result.attempts).toBe(1);
    expect(sleeps).toHaveLength(0);
    expect(checkFn).toHaveBeenCalledTimes(1);
  });

  it('passes on a later try and stops sleeping further', async () => {
    const { clock, sleeps } = createFakeClock();
    let counter = 0;
    const checkFn = vi.fn().mockImplementation(async () => {
      counter++;
      if (counter < 3) {
        return { passed: false, value: `attempt_${counter}` };
      }
      return { passed: true, value: 'success' };
    });

    const result = await pollUntil(checkFn, {
      timeoutMilliseconds: 10000,
      intervalMilliseconds: 1000,
      clock
    });

    expect(result.passed).toBe(true);
    expect(result.value).toBe('success');
    expect(result.attempts).toBe(3);
    expect(sleeps).toEqual([1000, 1000]);
    expect(checkFn).toHaveBeenCalledTimes(3);
  });

  it('times out and returns the last real value and attempt count', async () => {
    const { clock, sleeps } = createFakeClock();
    let counter = 0;
    const checkFn = vi.fn().mockImplementation(async () => {
      counter++;
      return { passed: false, value: `value_${counter}` };
    });

    const result = await pollUntil(checkFn, {
      timeoutMilliseconds: 3000,
      intervalMilliseconds: 1000,
      clock
    });

    expect(result.passed).toBe(false);
    expect(result.value).toBe('value_3');
    expect(result.attempts).toBe(3);
    expect(sleeps).toEqual([1000, 1000, 1000]);
  });

  it('handles timeout shorter than interval by sleeping only for remaining duration', async () => {
    const { clock, sleeps } = createFakeClock();
    const checkFn = vi.fn().mockResolvedValue({ passed: false, value: 'initial' });

    const result = await pollUntil(checkFn, {
      timeoutMilliseconds: 400,
      intervalMilliseconds: 1000,
      clock
    });

    expect(result.passed).toBe(false);
    // Sleeps only for 400ms instead of full 1000ms interval
    expect(sleeps).toEqual([400]);
  });
});
