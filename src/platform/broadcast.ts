/** Arch §6.5: tabs tell each other to reload after a restore or undo (MTB-03). */
export const CHANNEL_NAME = 'note-add';

export type TabMessage = { type: 'reload'; reason: 'restore' | 'undo-restore' };

function channel(): BroadcastChannel | null {
  return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);
}

export function postToOtherTabs(message: TabMessage): void {
  const ch = channel();
  if (!ch) return;
  ch.postMessage(message);
  ch.close();
}

export function onTabMessage(fn: (m: TabMessage) => void): () => void {
  const ch = channel();
  if (!ch) return () => undefined;
  ch.onmessage = (e: MessageEvent<TabMessage>) => fn(e.data);
  return () => ch.close();
}
