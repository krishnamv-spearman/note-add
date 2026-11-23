import { expect, test } from '@playwright/test';
import {
  activateServiceWorker,
  amount,
  createNotebookViaUi,
  description,
  downloadVia,
  editor,
  withoutShare,
} from './helpers';

test.use({ serviceWorkers: 'allow' });

test.beforeEach(({ browserName: _b }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'chromium only (test-plan §7.1)');
});

test('SEC-02 / SEC-03 / SEC-04: no CSP violation anywhere in a full journey with the service worker', async ({
  page,
}) => {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to|unsafe-eval/i.test(m.text())) problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()}`));
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { __csp: string[] }).__csp.push(
        `${e.violatedDirective} ${e.blockedURI}`,
      ),
    );
  });
  await withoutShare(page);

  await activateServiceWorker(page); // registration from a script file (script-src 'self')
  await createNotebookViaUi(page, 'CSP check');
  await description(page, 1).fill('Taxi');
  await amount(page, 1).fill('450');
  await amount(page, 1).blur();
  // pdf-lib, the TrueType subsetter and Zod (jitless) all run under the real CSP.
  await downloadVia(page, () => editor(page).getByRole('button', { name: 'Export PDF' }).click());
  await downloadVia(page, () => editor(page).getByRole('button', { name: 'Export JPEG' }).click());
  await page.goto('/settings');
  const backup = await downloadVia(page, () =>
    page.getByRole('button', { name: 'Back up', exact: true }).click(),
  );
  await page.getByLabel('Restore from a backup file').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup.bytes),
  });
  await expect(page.getByTestId('restore-summary')).toBeVisible(); // Zod validated the file

  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
  expect(problems).toEqual([]);
});
