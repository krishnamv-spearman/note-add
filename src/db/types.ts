import type { IsoDate, Line, Paise, PageStatus } from '@/engine';

export type ColourId = 'canary' | 'mint' | 'blush' | 'lavender' | 'sky' | 'peach' | 'grey';
export type FontId = 'carlito' | 'atkinson' | 'caladea' | 'merriweather';
/** ms since epoch, for timestamps and ordering. */
export type Epoch = number;

export const COLOUR_IDS: readonly ColourId[] = [
  'canary',
  'mint',
  'blush',
  'lavender',
  'sky',
  'peach',
  'grey',
];
export const FONT_IDS: readonly FontId[] = ['carlito', 'atkinson', 'caladea', 'merriweather'];
export const DEFAULT_COLOUR: ColourId = 'canary';
export const DEFAULT_FONT: FontId = 'carlito';

export const NOTEBOOK_NAME_MAX = 60;
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 120;
export const AMOUNT_TEXT_MAX = 20;

export interface Notebook {
  id: string;
  name: string;
  colour: ColourId;
  createdAt: Epoch;
  updatedAt: Epoch;
}

export interface Page {
  id: string;
  notebookId: string;
  number: number;
  date: IsoDate;
  title: string | null;
  colour: ColourId | null;
  lines: Line[];
  status: PageStatus;
  finalisedOn: IsoDate | null;
  reopenedOn: IsoDate[];
  totalUpdatedOn: IsoDate | null;
  broughtForwardPaise: Paise;
  totalPaise: Paise;
  createdAt: Epoch;
  updatedAt: Epoch;
}

export type ActivityKind =
  | 'notebook-created'
  | 'notebook-renamed'
  | 'page-created'
  | 'page-finalised'
  | 'page-reopened'
  | 'page-deleted'
  | 'restore'
  | 'backup';

export interface ActivityEntry {
  id?: number;
  at: Epoch;
  kind: ActivityKind;
  notebookId: string | null;
  pageId: string | null;
  text: string;
}

export interface Settings {
  font: FontId;
  lastBackupAt: Epoch | null;
  backupReminderDismissedAt: Epoch | null;
  installHintDismissedAt: Epoch | null;
  lastOpenedNotebookId: string | null;
}

export interface SettingsRow extends Settings {
  key: 'settings';
}

export interface SafetyBackup {
  id?: number;
  createdAt: Epoch;
  json: string;
}

export const DEFAULT_SETTINGS: Settings = {
  font: DEFAULT_FONT,
  lastBackupAt: null,
  backupReminderDismissedAt: null,
  installHintDismissedAt: null,
  lastOpenedNotebookId: null,
};
