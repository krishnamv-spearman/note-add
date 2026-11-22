import { useId, useRef, useState } from 'react';
import { fromDisplay, type IsoDate, toDisplay } from '@/engine';

interface Props {
  value: IsoDate;
  readOnly: boolean;
  onChange: (iso: IsoDate) => void;
}

const INVALID_DATE = 'Use DD/MM/YYYY, for example 20/11/2026';

/**
 * EDT-09: a DD/MM/YYYY text field plus a picker button, never a bare native date input
 * (which shows the device's locale format, e.g. MM/DD/YYYY on US-English phones).
 */
export function DateField({ value, readOnly, onChange }: Props) {
  const id = useId();
  const picker = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = draft ?? toDisplay(value);

  const commit = () => {
    if (draft === null) return;
    const trimmed = draft.trim();
    setDraft(null);
    if (trimmed === '') {
      setError(null); // EDT-11: cleared → previous date
      return;
    }
    const iso = fromDisplay(trimmed);
    if (!iso) {
      setError(INVALID_DATE); // EDT-10: message; previous date kept
      return;
    }
    setError(null);
    if (iso !== value) onChange(iso);
  };

  return (
    <div className="date-field">
      <label htmlFor={id}>Date</label>
      <input
        id={id}
        className="date-input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD/MM/YYYY"
        maxLength={10}
        readOnly={readOnly}
        value={shown}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d/]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
      />
      {!readOnly && (
        <>
          <button
            type="button"
            className="icon-button"
            aria-label="Pick a date"
            onClick={() => picker.current?.showPicker?.()}
          >
            📅
          </button>
          <input
            ref={picker}
            type="date"
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            min="1900-01-01"
            max="2099-12-31"
            value={value}
            onChange={(e) => {
              if (e.target.value && fromDisplay(toDisplay(e.target.value)))
                onChange(e.target.value);
            }}
          />
        </>
      )}
      {error && (
        <p id={`${id}-err`} className="field-message" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
