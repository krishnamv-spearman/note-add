import type { IsoDate } from './types';

/** Injected clock so "today" is deterministic in tests (arch §5.5). */
export type Clock = () => Date;
export const systemClock: Clock = () => new Date();

export const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_YEAR = 1900;
const MAX_YEAR = 2099;

const pad2 = (n: number): string => String(n).padStart(2, '0');

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isValidParts(year: number, month: number, day: number): boolean {
  if (year < MIN_YEAR || year > MAX_YEAR || month < 1 || month > 12 || day < 1) return false;
  const max = month === 2 && isLeap(year) ? 29 : (MONTH_DAYS[month - 1] as number);
  return day <= max;
}

/** The local calendar date of a Date, as 'YYYY-MM-DD'. */
export function isoFromDate(d: Date): IsoDate {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayIso(clock: Clock = systemClock): IsoDate {
  return isoFromDate(clock());
}

export function isValidIso(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m !== null && isValidParts(Number(m[1]), Number(m[2]), Number(m[3]));
}

function partsOf(iso: IsoDate): string[] {
  if (!isValidIso(iso)) throw new RangeError(`Not a valid ISO date: ${iso}`);
  return iso.split('-');
}

/** '2026-11-20' → '20/11/2026'. */
export function toDisplay(iso: IsoDate): string {
  const [y, m, d] = partsOf(iso);
  return `${d}/${m}/${y}`;
}

/** '2026-11-20' → '20-11-2026' (file names). */
export function toFileDate(iso: IsoDate): string {
  const [y, m, d] = partsOf(iso);
  return `${d}-${m}-${y}`;
}

/** 'DD/MM/YYYY' → ISO, or null unless a real date between 01/01/1900 and 31/12/2099. */
export function fromDisplay(text: string): IsoDate | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return isValidIso(iso) ? iso : null;
}

/** Display date of an epoch timestamp in local time: 'DD/MM/YYYY'. */
export function epochToDisplay(ms: number): string {
  return toDisplay(isoFromDate(new Date(ms)));
}
