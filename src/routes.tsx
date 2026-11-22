import { Navigate, type RouteObject } from 'react-router';
import { EditorRoute } from './features/editor/EditorRoute';
import { LibraryScreen } from './features/library/LibraryScreen';
import { NotebookScreen } from './features/notebook/NotebookScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { Layout } from './Layout';

/** Arch §7.1. */
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <LibraryScreen /> },
      { path: '/n/:notebookId', element: <NotebookScreen /> },
      { path: '/n/:notebookId/p/:pageNumber', element: <EditorRoute /> },
      { path: '/settings', element: <SettingsScreen /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
