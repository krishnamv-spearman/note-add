import { pageTotal } from './page';
import { isWithinLimit, type IsoDate, type Line, type Paise, type PageStatus, ZERO } from './types';

export interface ChainInput {
  id: string;
  number: number;
  status: PageStatus;
  lines: readonly Line[];
  broughtForwardPaise: Paise;
  totalPaise: Paise;
  totalUpdatedOn: IsoDate | null;
}

export interface ChainError {
  kind: 'over-limit';
  pageNumber: number;
}

export interface ChainResult<T extends ChainInput> {
  /** Pages with corrected brought forward, total and totalUpdatedOn. */
  pages: T[];
  /** Only pages whose cached values (bf, total, totalUpdatedOn) changed. */
  changedIds: string[];
  error?: ChainError;
}

/**
 * Walks a notebook's pages in the given order (arch §5.4). Page 1 starts at 0; each later
 * page's brought forward is the previous page's total. A Final page whose total changes gets
 * totalUpdatedOn = today. Any total outside the limit returns an error and no changes.
 */
export function recalculateChain<T extends ChainInput>(
  pages: readonly T[],
  today: IsoDate,
): ChainResult<T> {
  const out: T[] = [];
  const changedIds: string[] = [];
  let broughtForward: Paise = ZERO;
  for (const page of pages) {
    const total = pageTotal(broughtForward, page.lines);
    if (!isWithinLimit(total)) {
      return {
        pages: [...pages],
        changedIds: [],
        error: { kind: 'over-limit', pageNumber: page.number },
      };
    }
    const totalChanged = total !== page.totalPaise;
    const totalUpdatedOn = page.status === 'final' && totalChanged ? today : page.totalUpdatedOn;
    if (
      broughtForward !== page.broughtForwardPaise ||
      totalChanged ||
      totalUpdatedOn !== page.totalUpdatedOn
    ) {
      out.push({ ...page, broughtForwardPaise: broughtForward, totalPaise: total, totalUpdatedOn });
      changedIds.push(page.id);
    } else {
      out.push(page);
    }
    broughtForward = total;
  }
  return { pages: out, changedIds };
}

/** Returns the pages, in their current order, numbered contiguously from 1. */
export function renumber<T extends { number: number }>(pages: readonly T[]): T[] {
  return pages.map((page, i) => (page.number === i + 1 ? page : { ...page, number: i + 1 }));
}

export function chainErrorMessage(error: ChainError): string {
  return `This would make the total on page ${error.pageNumber} more than ₹99.99 crore`;
}
