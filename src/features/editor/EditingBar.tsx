import { useSyncExternalStore } from 'react';

/** Keyboard height from visualViewport (arch §7.3). 0 when no on-screen keyboard. */
function subscribe(fn: () => void): () => void {
  const vv = window.visualViewport;
  vv?.addEventListener('resize', fn);
  vv?.addEventListener('scroll', fn);
  window.addEventListener('resize', fn);
  return () => {
    vv?.removeEventListener('resize', fn);
    vv?.removeEventListener('scroll', fn);
    window.removeEventListener('resize', fn);
  };
}

function keyboardInset(): number {
  const vv = window.visualViewport;
  if (!vv) return 0;
  const inset = window.innerHeight - (vv.height + vv.offsetTop);
  return inset > 120 ? inset : 0;
}

const coarse = (): boolean => window.matchMedia?.('(pointer: coarse)').matches ?? false;

interface Props {
  visible: boolean;
  onToggleSign: () => void;
  onNext: () => void;
}

/**
 * P2.11: pinned just above the on-screen keyboard while an amount is focused, because the
 * iPhone decimal keypad has no minus and no Next key. Hidden with a physical keyboard.
 */
export function EditingBar({ visible, onToggleSign, onNext }: Props) {
  const inset = useSyncExternalStore(subscribe, keyboardInset, () => 0);
  if (!visible || (inset === 0 && !coarse())) return null;
  const keep = (e: React.SyntheticEvent) => e.preventDefault(); // keep focus in the amount
  return (
    <div className="editing-bar" style={{ bottom: inset }} role="toolbar" aria-label="Amount keys">
      <button type="button" onMouseDown={keep} onPointerDown={keep} onClick={onToggleSign}>
        ±
      </button>
      <button type="button" onMouseDown={keep} onPointerDown={keep} onClick={onNext}>
        Next ↵
      </button>
    </div>
  );
}
