/** Arch §6.5: tabs tell each other to reload after a restore or undo (MTB-03). */
export const CHANNEL_NAME = 'note-add';

export type TabMessage = { type: 'reload'; reason: 'restore' | 'undo-restore' };
type Envelope = TabMessage & { from: string };

/**
 * A BroadcastChannel delivers to every other channel object with the same name, including
 * listeners in this same tab, so each message carries this tab's id and the tab ignores its own.
 */
const TAB_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

function channel(): BroadcastChannel | null {
  return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);
}

export function postToOtherTabs(message: TabMessage): void {
  const ch = channel();
  if (!ch) return;
  ch.postMessage({ ...message, from: TAB_ID } satisfies Envelope);
  ch.close();
}

export function onTabMessage(fn: (m: TabMessage) => void): () => void {
  const ch = channel();
  if (!ch) return () => undefined;
  ch.onmessage = (e: MessageEvent<Envelope>) => {
    if (e.data.from === TAB_ID) return;
    const { from: _from, ...message } = e.data;
    fn(message);
  };
  return () => ch.close();
}
