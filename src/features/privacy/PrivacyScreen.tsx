import { Link } from 'react-router';
import { PRIVACY_STATEMENT } from '../settings/privacyStatement';

/** Spec §7 and P8: the privacy statement as its own page, so spearman.in can link to it. It
 *  makes no request and needs no data, so it works offline like every other screen. */
export function PrivacyScreen() {
  return (
    <section className="settings privacy-page" aria-labelledby="privacy-heading">
      <Link to="/settings" className="back-link">
        ‹ Settings
      </Link>
      <h1 id="privacy-heading">Privacy</h1>
      <p className="privacy" data-testid="privacy-statement">
        {PRIVACY_STATEMENT}
      </p>

      <h2>What is stored, and where</h2>
      <ul>
        <li>
          Your notebooks, pages, lines, amounts and settings are stored in your browser&apos;s
          database (IndexedDB) on this device. They are not uploaded anywhere.
        </li>
        <li>
          The app files and fonts are cached on this device so Note-Add works without a network
          connection.
        </li>
        <li>
          If you clear this site&apos;s data, or your phone removes it, your notes go with it. Make
          a backup from Settings to keep a copy.
        </li>
      </ul>

      <h2>What Note-Add does not do</h2>
      <ul>
        <li>No accounts and no sign-in.</li>
        <li>No server of ours receives your notes, and none is needed to use the app.</li>
        <li>No cookies and no analytics or tracking of any kind.</li>
        <li>No requests to other websites, no third-party scripts, and no web fonts from a CDN.</li>
        <li>No adverts.</li>
      </ul>

      <h2>When something leaves your device</h2>
      <p>
        Only when you choose it: a backup file you save or share, or a PDF or image of a page you
        export or send. Where it goes then is up to you and the app you share it with; Note-Add
        cannot see or control that.
      </p>

      <h2>Hosting</h2>
      <p>
        The app is delivered as static files from Vercel. Like any web host, the host can see that
        your browser asked for the app files (for example your IP address and the time), but never
        your notes, which are not sent. After the first visit, the app only checks the host now and
        then for a newer version of itself. That check carries no notes.
      </p>

      <h2>Contact</h2>
      <p data-testid="privacy-contact">
        Note-Add is made by Spearman (
        <a
          href="https://spearman.in/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-link"
        >
          spearman.in
        </a>
        ). Questions about privacy:{' '}
        <a href="mailto:hello@spearman.in" className="text-link">
          hello@spearman.in
        </a>
      </p>
    </section>
  );
}
