/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The one thing the drawings ask of main: the demo song's bytes
 * (`readDemoMusic`), here the file main ships, which the generator serves
 * beside the page (`DEMO_FILE` in `generate.ts`). Imported ahead of
 * everything else, so the bridge stands before any module reads it.
 */
Object.assign(window, {
  electron: {
    ipcRenderer: {
      readStudioDemoMusic: async (): Promise<Uint8Array> =>
        new Uint8Array(await (await fetch('./demo.m4a')).arrayBuffer()),
    },
  },
});
