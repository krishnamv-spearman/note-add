import type { ChainInput } from '../src/engine/chain';
import { parseAmount } from '../src/engine/money';
import { emptyLine, LINES_PER_PAGE } from '../src/engine/page';
import { asPaise, type Line, type PageStatus } from '../src/engine/types';

/** A line from typed text, parsed exactly as the editor would. */
export function aLine(amountText: string, description = ''): Line {
  const r = parseAmount(amountText);
  return { description, amountText, amountPaise: r.kind === 'ok' ? r.paise : null };
}

/** Ten lines; the given amounts fill the first lines, the rest are empty. */
export function linesOf(
  amounts: readonly string[] = [],
  descriptions: readonly string[] = [],
): Line[] {
  return Array.from({ length: LINES_PER_PAGE }, (_, i) => {
    const a = amounts[i];
    return a === undefined && descriptions[i] === undefined
      ? emptyLine()
      : aLine(a ?? '', descriptions[i] ?? '');
  });
}

export interface PageSpec {
  amounts?: string[];
  status?: PageStatus;
  id?: string;
}

/** A chain input with stale (zero) cached totals, so recalculation has work to do. */
export function aPage(number: number, spec: PageSpec = {}): ChainInput {
  return {
    id: spec.id ?? `p${number}`,
    number,
    status: spec.status ?? 'draft',
    lines: linesOf(spec.amounts),
    broughtForwardPaise: asPaise(0),
    totalPaise: asPaise(0),
    totalUpdatedOn: null,
  };
}

/** n pages, each with the same amounts. */
export function aChain(n: number, amounts: string[] = ['450', '-300', '1280.75']): ChainInput[] {
  return Array.from({ length: n }, (_, i) => aPage(i + 1, { amounts }));
}
