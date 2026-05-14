// SPDX-License-Identifier: Apache-2.0

// Configure Monaco workers before any monaco-editor import.
// The ?worker suffix tells Vite to bundle each file as a separate Worker chunk
// and return a constructor — this is the only reliable way to load Monaco
// workers in a Vite dev server (import.meta.url string approach returns HTML).
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';

(self as unknown as Record<string, unknown>).MonacoEnvironment = {
  getWorker(_moduleId: string, label: string): Worker {
    if (label === 'json') return new JsonWorker();
    return new EditorWorker();
  },
};

export { PlaygroundApp } from './app.js';
