import { Link } from 'react-router';

/** Phase 3 stub; the font, backup and about sections arrive in phases 4 and 6. */
export function SettingsScreen() {
  return (
    <section aria-labelledby="settings-heading">
      <Link to="/" className="back-link">
        ‹ Notebooks
      </Link>
      <h1 id="settings-heading">Settings</h1>
      <p>Font, backup and about settings are coming soon.</p>
    </section>
  );
}
