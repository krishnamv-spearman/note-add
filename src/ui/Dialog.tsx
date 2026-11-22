import { type ReactNode, useEffect, useId, useRef } from 'react';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children?: ReactNode;
  actions: ReactNode;
  onSubmit?: () => void;
}

/**
 * P3.9: native <dialog> (modal: focus moves in and is trapped; Escape closes). Focus returns
 * to the element that opened it (A11Y-05).
 */
export function Dialog({ open, title, onClose, children, actions, onSubmit }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      opener.current = document.activeElement as HTMLElement | null;
      if (typeof el.showModal === 'function') el.showModal();
      else el.setAttribute('open', '');
    } else if (!open && el.open) {
      if (typeof el.close === 'function') el.close();
      else el.removeAttribute('open');
      opener.current?.focus?.();
    }
  }, [open]);

  useEffect(
    () => () => {
      opener.current?.focus?.();
    },
    [],
  );

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {open && (
        <form
          method="dialog"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit?.();
          }}
        >
          <h2 id={titleId}>{title}</h2>
          {children}
          <div className="dialog-actions">{actions}</div>
        </form>
      )}
    </dialog>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmProps) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onCancel}
      onSubmit={onConfirm}
      actions={
        <>
          <button type="button" className="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className={destructive ? 'button button-danger' : 'button button-primary'}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
