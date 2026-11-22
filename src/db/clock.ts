import { type Clock, systemClock, todayIso } from '@/engine';

let clock: Clock = systemClock;

/** Tests can inject a clock; the app uses the system clock. Read on every call (DAT-03). */
export function setClock(next: Clock): void {
  clock = next;
}

export function now(): number {
  return clock().getTime();
}

export function today(): string {
  return todayIso(clock);
}

/** STO-08: crypto.randomUUID needs a secure context; fall back for plain-http testing. */
export function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const hex = (n: number): string =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}
