/** @jest-environment node */
import fs from 'fs';
import os from 'os';
import path from 'path';

const handlers = new Map<string, (...args: unknown[]) => unknown>();
jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}));
/* eslint-disable import/first -- install the Electron mock first */
import { registerStudioNotesIpc } from '../../../main/ipc/studioNotes';
/* eslint-enable import/first */

it('keeps notes with the correct project and refuses unknown paths, invalid data and lapsed access', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-notes-'));
  const folders = {
    first: path.join(root, 'first'),
    second: path.join(root, 'second'),
  };
  Object.values(folders).forEach((folder) => fs.mkdirSync(folder));
  // The resolver is the gate: a project the member may not use has no folder.
  let usable = true;
  const dispose = registerStudioNotesIpc({
    folderFor: (id) =>
      usable ? folders[id as keyof typeof folders] : undefined,
  });
  const call = (channel: string, ...args: unknown[]) =>
    handlers.get(channel)?.({}, ...args);
  const notes = {
    description: 'A musical lake',
    prompt: 'Preserve the lanterns',
    source: 'ignored',
  };
  try {
    expect(call('studio-notes-save', 'first', notes)).toBe(true);
    expect(call('studio-notes-read', 'first')).toEqual({
      description: notes.description,
      prompt: notes.prompt,
    });
    expect(call('studio-notes-read', 'second')).toBeUndefined();
    expect(call('studio-notes-save', root, notes)).toBe(false);
    expect(call('studio-notes-save', '../outside', notes)).toBe(false);
    // A prompt past the limit is no reason to lose the description saved
    // beside it: the description is kept and the prompt left out, since the
    // Studio writes the prompt again every time the scene opens
    // (`useProjectIdea`, `parseStudioNotes`).
    expect(
      call('studio-notes-save', 'first', {
        ...notes,
        prompt: 'x'.repeat(64001),
      }),
    ).toBe(true);
    expect(call('studio-notes-read', 'first')).toEqual({
      description: notes.description,
    });
    const saved = fs.readFileSync(
      path.join(folders.first, 'studio-notes.json'),
      'utf8',
    );
    expect(saved).not.toContain('source');
    expect(saved).not.toContain('x'.repeat(100));
    usable = false;
    expect(call('studio-notes-save', 'first', notes)).toBe(false);
    expect(call('studio-notes-read', 'first')).toBeUndefined();
    expect(
      fs.readFileSync(path.join(folders.first, 'studio-notes.json'), 'utf8'),
    ).toBe(saved);
  } finally {
    dispose();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
