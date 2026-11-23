/** Route paths (arch §7.1), in a tiny module so screens can link without importing each other. */
export const notebookPath = (id: string): string => `/n/${id}`;

export const editorPath = (notebookId: string, pageNumber: number): string =>
  `/n/${notebookId}/p/${pageNumber}`;
