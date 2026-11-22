import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  epochToDisplay,
  fromDisplay,
  isoFromDate,
  isValidIso,
  systemClock,
  toDisplay,
  todayIso,
  toFileDate,
} from './dates';

describe('dates', () => {
  it('display ↔ ISO round trip', () => {
    expect(toDisplay('2026-11-20')).toBe('20/11/2026');
    expect(fromDisplay('20/11/2026')).toBe('2026-11-20');
    expect(fromDisplay(' 01/01/2026 ')).toBe('2026-01-01');
    expect(toFileDate('2026-11-20')).toBe('20-11-2026');
  });

  it.each([
    ['DAT-01', '29/02/2028', '2028-02-29'],
    ['DAT-01', '29/02/2000', '2000-02-29'],
    ['DAT-01', '29/02/2027', null],
    ['DAT-01', '29/02/2100', null],
    ['EDT-10', '31/02/2026', null],
    ['EDT-10', '31/04/2026', null],
    ['EDT-10', '00/01/2026', null],
    ['EDT-10', '01/00/2026', null],
    ['EDT-10', '01/13/2026', null],
    ['EDT-10', '1/1/26', null],
    ['EDT-10', '2026-01-01', null],
    ['EDT-11', '', null],
    ['EDT-12', '01/01/1850', null],
    ['EDT-12', '01/01/2300', null],
    ['EDT-12', '01/01/1900', '1900-01-01'],
    ['EDT-12', '31/12/2099', '2099-12-31'],
    ['EDT-12', '31/12/1899', null],
    ['EDT-12', '01/01/2100', null],
  ])('%s: fromDisplay(%j) → %j', (_id, input, expected) => {
    expect(fromDisplay(input)).toBe(expected);
  });

  it('isValidIso', () => {
    expect(isValidIso('2026-11-20')).toBe(true);
    expect(isValidIso('2026-02-30')).toBe(false);
    expect(isValidIso('20/11/2026')).toBe(false);
  });

  it('toDisplay and toFileDate refuse invalid ISO dates', () => {
    expect(() => toDisplay('2026-02-30')).toThrow(RangeError);
    expect(() => toFileDate('nonsense')).toThrow(RangeError);
  });

  it('DAT-02: todayIso uses the injected clock, in local time', () => {
    // 00:05 local time on 21/11 — still 21/11 locally, whatever UTC says.
    const justAfterMidnight = new Date(2026, 10, 21, 0, 5, 0);
    expect(todayIso(() => justAfterMidnight)).toBe('2026-11-21');
    const justBefore = new Date(2026, 10, 20, 23, 59, 59);
    expect(todayIso(() => justBefore)).toBe('2026-11-20');
  });

  it('DAT-04 / DAT-08: local date in the configured non-UTC time zone', () => {
    expect(process.env.TZ).toBeTruthy();
    // 20/11/2026 23:30 UTC is 21/11 in India (+05:30) but 20/11 in Los Angeles.
    const d = new Date(Date.UTC(2026, 10, 20, 23, 30));
    const local = isoFromDate(d);
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(local).toBe(expected);
    if (process.env.TZ === 'Asia/Kolkata') expect(local).toBe('2026-11-21');
  });

  it('todayIso defaults to the system clock', () => {
    expect(todayIso()).toBe(isoFromDate(systemClock()));
    expect(isValidIso(todayIso())).toBe(true);
  });

  it('epochToDisplay and DAY_MS', () => {
    expect(epochToDisplay(new Date(2026, 10, 20, 12).getTime())).toBe('20/11/2026');
    expect(DAY_MS).toBe(86_400_000);
  });
});
