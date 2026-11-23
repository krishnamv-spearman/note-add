import { useRef } from 'react';
import { useNavigate } from 'react-router';
import { appendPage, newPageTarget } from '@/db';
import { editorPath } from './paths';

/**
 * Bottom-nav "New page" (arch §7.1): append to the last opened notebook (or the most recently
 * updated one); with no notebooks, open the "Add a new book" dialog (NB-05).
 */
export function useNewPage(): () => Promise<void> {
  const navigate = useNavigate();
  const busy = useRef(false);
  return async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const target = await newPageTarget();
      if (!target) {
        void navigate('/?new=1');
        return;
      }
      const r = await appendPage(target);
      if (r.ok) void navigate(editorPath(target, r.value.pageNumber), { state: { focus: 0 } });
    } finally {
      busy.current = false;
    }
  };
}
