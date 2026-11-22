import { useId } from 'react';
import { SLIP_COLOURS, type SlipColourId } from '@/theme/colours';

interface Props {
  value: SlipColourId;
  onChange: (id: SlipColourId) => void;
  legend?: string;
}

/** The seven slip colours as a radio group; each swatch is a 44 × 44 px target. */
export function ColourPicker({ value, onChange, legend = 'Colour' }: Props) {
  const name = useId();
  return (
    <fieldset className="colour-picker">
      <legend>{legend}</legend>
      {SLIP_COLOURS.map((c) => (
        <label key={c.id} className="swatch" style={{ background: c.paper, borderColor: c.rule }}>
          <input
            type="radio"
            name={name}
            value={c.id}
            checked={value === c.id}
            onChange={() => onChange(c.id)}
            aria-label={c.label}
          />
          <span className="visually-hidden">{c.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
