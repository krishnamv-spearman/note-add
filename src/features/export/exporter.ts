/**
 * The lazily loaded export chunk (P5.8): pdf-lib, fontkit and both renderers load only when
 * the user first taps Export.
 */
import { db, getSettings, loadPages } from '@/db';
import { loadExportFonts, renderSlipCanvas, toJpeg } from './canvas';
import { loadFontBytes } from './fontUrls';
import { buildSlipModel, exportFileName } from './model';
import { renderSlipPdf } from './pdf';

export type ExportFormat = 'pdf' | 'jpg';

/** Builds the file for a page from what is stored (callers flush pending edits first). */
export async function buildExportFile(pageId: string, format: ExportFormat): Promise<File> {
  const page = await db.pages.get(pageId);
  if (!page) throw new Error('That page no longer exists.');
  const [notebook, pages, settings] = await Promise.all([
    db.notebooks.get(page.notebookId),
    loadPages(page.notebookId),
    getSettings(),
  ]);
  if (!notebook) throw new Error('That notebook no longer exists.');
  const model = buildSlipModel(page, notebook, pages.length, settings.font);
  const name = exportFileName(model, format);
  if (format === 'pdf') {
    const bytes = await renderSlipPdf(model, loadFontBytes);
    return new File([bytes.slice().buffer], name, { type: 'application/pdf' });
  }
  await loadExportFonts(model);
  const blob = await toJpeg(renderSlipCanvas(model));
  return new File([blob], name, { type: 'image/jpeg' });
}
