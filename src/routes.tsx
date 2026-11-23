import { Navigate, type RouteObject } from 'react-router';
import { LibraryScreen } from './features/library/LibraryScreen';
import { Layout } from './Layout';

/**
 * Arch §7.1. The library (the screen every visit starts on) is in the first
 * chunk; the editor, the pages list and Settings load on demand to keep the initial JS under budget (D37).
 */
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    HydrateFallback: () => <p className="loading">Loading…</p>,
    children: [
      { path: '/', element: <LibraryScreen /> },
      {
        path: '/n/:notebookId',
        lazy: async () => ({
          Component: (await import('./features/notebook/NotebookScreen')).NotebookScreen,
        }),
      },
      {
        path: '/n/:notebookId/p/:pageNumber',
        lazy: async () => ({
          Component: (await import('./features/editor/EditorRoute')).EditorRoute,
        }),
      },
      {
        path: '/settings',
        lazy: async () => ({
          Component: (await import('./features/settings/SettingsScreen')).SettingsScreen,
        }),
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
