import type { CSSProperties, ReactNode } from 'react';
import { slipColour } from '@/theme/colours';

interface Props {
  colour: string | null | undefined;
  children: ReactNode;
  className?: string;
  /** Rendered element; a Slip can be a plain block or a link wrapper's child. */
  as?: 'div' | 'span';
  ruled?: boolean;
}

/**
 * The sticky-note surface (arch §7.4): paper colour, faint ruled lines in a darker shade,
 * soft shadow, the chosen slip font (from --slip-font).
 */
export function Slip({ colour, children, className = '', as = 'div', ruled = true }: Props) {
  const c = slipColour(colour);
  const style = { '--paper': c.paper, '--rule': c.rule } as CSSProperties;
  const Tag = as;
  return (
    <Tag
      className={`slip ${ruled ? 'slip-ruled' : ''} ${className}`.trim()}
      style={style}
      data-colour={c.id}
    >
      {children}
    </Tag>
  );
}
