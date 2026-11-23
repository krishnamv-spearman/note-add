import { useRef, useState } from 'react';
import { beginBusy } from '@/platform/pwa';
import { type BackupRun, runBackup, shareBackupAgain } from './backupActions';

type State =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'ready'; file: File }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string };

interface Props {
  label?: string;
  disabled?: boolean;
  onDone?: (run: BackupRun) => void;
}

export function BackupButton({ label = 'Back up now', disabled = false, onDone }: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const busy = useRef(false);

  const start = async () => {
    if (busy.current) return;
    busy.current = true;
    const release = beginBusy();
    setState({ kind: 'working' });
    try {
      const run = await runBackup();
      onDone?.(run);
      if (run.outcome === 'needs-tap') setState({ kind: 'ready', file: run.file });
      else if (run.outcome === 'cancelled') setState({ kind: 'idle' });
      else setState({ kind: 'done', message: `Backup saved as ${run.file.name}` });
    } catch (e) {
      setState({
        kind: 'error',
        message: `Couldn’t back up: ${e instanceof Error ? e.message : 'error'}`,
      });
    } finally {
      busy.current = false;
      release();
    }
  };

  return (
    <div className="backup-button">
      <button
        type="button"
        className="button button-primary"
        disabled={disabled || state.kind === 'working'}
        onClick={() => void start()}
      >
        {state.kind === 'working' ? 'Preparing…' : label}
      </button>
      {state.kind === 'ready' && (
        <div className="banner" role="status">
          <span>Your file is ready</span>
          <button
            type="button"
            onClick={() => {
              const { file } = state;
              setState({ kind: 'idle' });
              void shareBackupAgain(file).then((o) => {
                if (o !== 'cancelled')
                  setState({ kind: 'done', message: `Backup saved as ${file.name}` });
              });
            }}
          >
            Share
          </button>
        </div>
      )}
      {state.kind === 'done' && (
        <p className="hint" role="status">
          {state.message}
        </p>
      )}
      {state.kind === 'error' && (
        <p className="banner banner-error" role="alert">
          {state.message}
        </p>
      )}
    </div>
  );
}
