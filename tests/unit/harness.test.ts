import { describe, expect, it } from 'vitest';

describe('harness', () => {
  it('runs unit tests in the configured time zone (DAT-08)', () => {
    expect(process.env.TZ).toBeTruthy();
  });

  it('blocks network access in unit tests', () => {
    expect(() => fetch('https://example.com')).toThrow(/Network access is not allowed/);
  });
});
