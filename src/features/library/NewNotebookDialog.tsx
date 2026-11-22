import { useState } from 'react';
import { type ColourId, DEFAULT_COLOUR, NOTEBOOK_NAME_MAX } from '@/db';
import { ColourPicker } from '@/ui/ColourPicker';
import { Dialog } from '@/ui/Dialog';

interface Props {
  open: boolean;
  title: string;
  submitLabel: string;
  initialName?: string;
  initialColour?: ColourId;
  showName?: boolean;
  showColour?: boolean;
  onSubmit: (name: string, colour: ColourId) => Promise<string | null>;
  onClose: () => void;
}

/** Name + colour form used to create, rename or recolour a notebook. */
export function NotebookDialog({
  open,
  title,
  submitLabel,
  initialName = '',
  initialColour = DEFAULT_COLOUR,
  showName = true,
  showColour = true,
  onSubmit,
  onClose,
}: Props) {
  const [name, setName] = useState(initialName);
  const [colour, setColour] = useState<ColourId>(initialColour);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const message = await onSubmit(name, colour);
    setError(message);
  };

  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      onSubmit={() => void submit()}
      actions={
        <>
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button-primary">
            {submitLabel}
          </button>
        </>
      }
    >
      {showName && (
        <label className="field">
          <span>Name</span>
          <input
            type="text"
            value={name}
            maxLength={NOTEBOOK_NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={error ? true : undefined}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the dialog's first field
            autoFocus
          />
        </label>
      )}
      {error && (
        <p className="field-message" role="alert">
          {error}
        </p>
      )}
      {showColour && <ColourPicker value={colour} onChange={setColour} />}
    </Dialog>
  );
}
