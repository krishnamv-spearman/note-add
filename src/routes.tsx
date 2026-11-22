import { Navigate, type RouteObject } from 'react-router';
import { EditorRoute } from './features/editor/EditorRoute';
import { StartScreen } from './features/start/StartScreen';
import { Layout } from './Layout';

/** Arch §7.1. Phase 2: temporary start screen at `/` (replaced by the library in phase 3). */
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <StartScreen /> },
      { path: '/n/:notebookId/p/:pageNumber', element: <EditorRoute /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
