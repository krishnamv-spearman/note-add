import { useRef, useState } from 'react';
import { shareAgain, shareOrDownload } from '@/platform/share';
import type { ExportFormat } from './exporter';

type State =
  | { kind: 'idle' }
  | { kind: 'preparing'; format: ExportFormat }
  | { kind: 'ready'; file: File }
  | { kind: 'error'; message: string };

export const OFFLINE_FIRST_VISIT = 'Export needs one online visit first. Connect and try again.';

interface Props {
  pageId: string;
  /** SAV-06 / EXP-07: flush pending edits so the export matches the screen. */
  beforeExport?: () => Promise<unknown>;
}

/** Export PDF / Export JPEG with the share menu or download (P5.7–P5.9). */
export function ExportControls({ pageId, beforeExport }: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const busy = useRef(false);

  const run = async (format: ExportFormat) => {
    if (busy.current) return;
    busy.current = true;
    setState({ kind: 'preparing', format });
    try {
      await beforeExport?.();
      const mod = await import('./exporter').catch(() => null); // P5.8: lazy chunk
      if (!mod) {
        setState({ kind: 'error', message: OFFLINE_FIRST_VISIT }); // EXP-08
        return;
      }
      const file = await mod.buildExportFile(pageId, format);
      const outcome = await shareOrDownload(file);
      setState(outcome === 'needs-tap' ? { kind: 'ready', file } : { kind: 'idle' });
    } catch (e) {
      setState({
        kind: 'error',
        message: `Couldn’t export: ${e instanceof Error ? e.message : 'unknown error'}`,
      });
    } finally {
      busy.current = false;
    }
  };

  const preparing = state.kind === 'preparing';
  return (
    <div className="export-controls">
      <button type="button" className="button" disabled={preparing} onClick={() => void run('pdf')}>
        {preparing && state.format === 'pdf' ? 'Preparing…' : 'Export PDF'}
      </button>
      <button type="button" className="button" disabled={preparing} onClick={() => void run('jpg')}>
        {preparing && state.format === 'jpg' ? 'Preparing…' : 'Export JPEG'}
      </button>
      {state.kind === 'ready' && (
        <div className="banner" role="status">
          <span>Your file is ready</span>
          <button
            type="button"
            onClick={() => {
              const { file } = state;
              setState({ kind: 'idle' });
              void shareAgain(file);
            }}
          >
            Share
          </button>
        </div>
      )}
      {state.kind === 'error' && (
        <p className="banner banner-error" role="alert">
          {state.message}
        </p>
      )}
    </div>
  );
}
