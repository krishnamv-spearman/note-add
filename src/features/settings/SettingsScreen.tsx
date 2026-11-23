import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { addPaise, formatPaise, type Paise, parseAmount, ZERO } from '@/engine';
import { type FontId, getSettings, updateSettings } from '@/db';
import { SLIP_FONTS, slipFont } from '@/theme/fonts';
import { Slip } from '@/ui/Slip';
import { InstallButton } from '../pwa/InstallButton';
import { StorageStatusView, useStorageStatus } from '../pwa/StorageStatus';
import { BackupSection, useBackupData } from '../backup/BackupSection';

export const PRIVACY_STATEMENT =
  'Note-Add stores your notes only on your device. Nothing is sent to Spearman or anyone else. Backups and exports go only where you choose to send them.';

const LICENCES: [string, string][] = [
  ['Carlito-OFL.txt', 'Carlito'],
  ['AtkinsonHyperlegible-OFL.txt', 'Atkinson Hyperlegible'],
  ['Caladea-OFL.txt', 'Caladea'],
  ['Merriweather-OFL.txt', 'Merriweather'],
  ['WorkSans-OFL.txt', 'Work Sans'],
];

const SAMPLE: [string, string][] = [
  ['Taxi to airport', '450'],
  ['Hotel, 2 nights', '6,800.50'],
  ['Refund: cancelled tour', '-1,200'],
];

function FontPreview({ fontId }: { fontId: FontId }) {
  const font = slipFont(fontId);
  const amounts: Paise[] = SAMPLE.map(([, a]) => {
    const r = parseAmount(a);
    return r.kind === 'ok' ? r.paise : ZERO;
  });
  const total = amounts.reduce(addPaise, ZERO);
  return (
    <Slip colour="canary" className="font-preview">
      <div style={{ fontFamily: font.stack }} data-testid="font-preview">
        {SAMPLE.map(([d], i) => (
          <div key={d} className="row">
            <span>{d}</span>
            <span className="amount">{formatPaise(amounts[i] ?? ZERO)}</span>
          </div>
        ))}
        <div className="row total-row">
          <span>Total</span>
          <span className="amount">{formatPaise(total)}</span>
        </div>
      </div>
    </Slip>
  );
}

/** Spec §3.4: Font · Backup · Restore · About and privacy. */
export function SettingsScreen() {
  const settings = useLiveQuery(getSettings, []);
  const backup = useBackupData();
  const storage = useStorageStatus();
  const name = useId();
  // Optimistic: the radio follows the tap at once; the stored setting catches up.
  const [choice, setChoice] = useState<FontId | null>(null);

  const header = (
    <>
      <Link to="/" className="back-link">
        ‹ Notebooks
      </Link>
      <h1 id="settings-heading">Settings</h1>
    </>
  );
  // Show the page once everything it needs has been read, all at once: sections that pop in
  // one by one shift the layout (D73).
  if (!settings || !backup || storage === undefined) {
    return (
      <section className="settings" aria-labelledby="settings-heading">
        {header}
      </section>
    );
  }
  const current = choice ?? settings.font;

  return (
    <section className="settings" aria-labelledby="settings-heading">
      {header}

      <section aria-labelledby="font-heading">
        <h2 id="font-heading">Font</h2>
        <fieldset className="font-choices">
          <legend className="visually-hidden">Font for descriptions and amounts</legend>
          {SLIP_FONTS.map((f) => (
            <label key={f.id} className="font-choice">
              <input
                type="radio"
                name={name}
                value={f.id}
                checked={current === f.id}
                onChange={() => {
                  setChoice(f.id);
                  void updateSettings({ font: f.id });
                }}
              />
              <span className="font-choice-text">
                <span className="font-choice-label" style={{ fontFamily: f.stack }}>
                  {f.label}
                </span>
                <span className="font-choice-note">
                  {f.family}. {f.note}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <FontPreview fontId={current} />
      </section>

      <BackupSection data={backup} />

      <section aria-labelledby="about-heading">
        <h2 id="about-heading">About and privacy</h2>
        <InstallButton />
        <p>Note-Add version {__APP_VERSION__}</p>
        <StorageStatusView status={storage} />
        <p>
          Made by Spearman ·{' '}
          <a
            href="https://spearman.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-link"
          >
            spearman.in
          </a>
        </p>
        <p className="privacy">{PRIVACY_STATEMENT}</p>
        <h3>Font licences (SIL Open Font Licence)</h3>
        <ul className="licences">
          {LICENCES.map(([file, label]) => (
            <li key={file}>
              <a href={`${import.meta.env.BASE_URL}fonts/LICENSES/${file}`} className="text-link">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
