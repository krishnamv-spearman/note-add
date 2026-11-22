import { Link, NavLink } from 'react-router';
import { slipColour } from '@/theme/colours';

/** LOOK-07: status is always text, never colour alone. */
export function StatusBadge({ status }: { status: 'draft' | 'final' }) {
  return <span className={`badge badge-${status}`}>{status === 'final' ? 'Final' : 'Draft'}</span>;
}

interface StackProps {
  to: string;
  name: string;
  colour: string;
  pageCount: number;
  latestTotal: string;
}

/** A notebook as a small stack of slips: thick border and shadow (spec §3.1). */
export function NotebookStack({ to, name, colour, pageCount, latestTotal }: StackProps) {
  const c = slipColour(colour);
  return (
    <Link
      to={to}
      className="notebook-stack"
      style={{ ['--paper' as string]: c.paper, ['--rule' as string]: c.rule }}
    >
      <span className="stack-name">{name}</span>
      <span className="stack-meta">
        {pageCount} {pageCount === 1 ? 'page' : 'pages'}
      </span>
      <span className="stack-total amount">{latestTotal}</span>
    </Link>
  );
}

/** Deliberately different from a notebook: thin border, no shadow, a plus sign. */
export function AddBookTile({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="add-book" onClick={onClick}>
      <span aria-hidden="true" className="plus">
        +
      </span>
      Add a new book
    </button>
  );
}

export function BottomNav({ onNewPage }: { onNewPage: () => void }) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      <NavLink to="/" end>
        Notebooks
      </NavLink>
      <button type="button" onClick={onNewPage}>
        New page
      </button>
      <NavLink to="/settings">Settings</NavLink>
    </nav>
  );
}
