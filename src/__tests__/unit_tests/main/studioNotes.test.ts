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
import {
  registerStudioNotesIpc,
  stripStoredBrief,
} from '../../../main/ipc/studioNotes';
/* eslint-enable import/first */

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-notes-'));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const call = (channel: string, ...args: unknown[]) =>
  handlers.get(channel)?.({}, ...args);
const fileOf = (folder: string) => path.join(folder, 'studio-notes.json');

it('keeps notes with the correct project and refuses unknown paths, invalid data and lapsed access', () => {
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
    writableFolderFor: (id) =>
      usable ? folders[id as keyof typeof folders] : undefined,
  });
  const notes = { description: 'A musical lake', source: 'ignored' };
  try {
    expect(call('studio-notes-save', 'first', notes)).toBe(true);
    expect(call('studio-notes-read', 'first')).toEqual({
      description: notes.description,
    });
    expect(call('studio-notes-read', 'second')).toBeUndefined();
    expect(call('studio-notes-save', root, notes)).toBe(false);
    expect(call('studio-notes-save', '../outside', notes)).toBe(false);
    const saved = fs.readFileSync(fileOf(folders.first), 'utf8');
    expect(saved).not.toContain('source');
    usable = false;
    expect(call('studio-notes-save', 'first', notes)).toBe(false);
    expect(call('studio-notes-read', 'first')).toBeUndefined();
    expect(fs.readFileSync(fileOf(folders.first), 'utf8')).toBe(saved);
  } finally {
    dispose();
  }
});

// Ivan, 2026-11-09: "lets not have that there because updating it on each
// release not good since the scene has the old prompt".
it('never writes a brief into a project, and takes back one an earlier FluidEQ wrote', () => {
  const folder = path.join(root, 'ridgeline');
  fs.mkdirSync(folder);
  const dispose = registerStudioNotesIpc({
    folderFor: () => folder,
    writableFolderFor: () => folder,
  });
  try {
    // A save from a page that still sends one keeps none of it.
    expect(
      call('studio-notes-save', 'p', {
        description: 'A lake',
        prompt:
          'You are a senior real-time graphics artist ... MY IDEA: A lake',
      }),
    ).toBe(true);
    expect(fs.readFileSync(fileOf(folder), 'utf8')).not.toContain('prompt');

    // Notes an earlier FluidEQ wrote, its brief carrying an older idea.
    fs.writeFileSync(
      fileOf(folder),
      JSON.stringify({
        schema: 1,
        description: 'A pro 3D spectrum analyser.',
        prompt:
          'You are a senior ...\n\nMY IDEA: Ridgeline, the last eight seconds as ridges.',
        whatsNew: 'Taller peaks.',
      }),
    );
    expect(call('studio-notes-read', 'p')).toEqual({
      description: 'A pro 3D spectrum analyser.',
      whatsNew: 'Taller peaks.',
      earlierIdea: 'Ridgeline, the last eight seconds as ridges.',
    });
    const after = JSON.parse(fs.readFileSync(fileOf(folder), 'utf8')) as Record<
      string,
      unknown
    >;
    expect(after).not.toHaveProperty('prompt');
    expect(after.earlierIdea).toBe(
      'Ridgeline, the last eight seconds as ridges.',
    );

    // A later save from the page, which never names it, keeps it.
    call('studio-notes-save', 'p', { description: 'A pro analyser, 3D.' });
    expect(call('studio-notes-read', 'p')).toEqual({
      description: 'A pro analyser, 3D.',
      earlierIdea: 'Ridgeline, the last eight seconds as ridges.',
    });
  } finally {
    dispose();
  }
});

it('leaves notes alone that hold no brief, or cannot be read as notes', () => {
  const folder = path.join(root, 'plain');
  fs.mkdirSync(folder);
  fs.writeFileSync(fileOf(folder), '{"description":"A lake"}');
  expect(stripStoredBrief(folder)).toBe(false);
  expect(fs.readFileSync(fileOf(folder), 'utf8')).toBe(
    '{"description":"A lake"}',
  );
  // A description past the limit: rewriting would lose it, so nothing moves.
  const odd = JSON.stringify({ description: 'x'.repeat(2000), prompt: 'b' });
  fs.writeFileSync(fileOf(folder), odd);
  expect(stripStoredBrief(folder)).toBe(false);
  expect(fs.readFileSync(fileOf(folder), 'utf8')).toBe(odd);
});

// Ivan, 2026-11-11: notes are editable in the Code tab, but never those of a
// scene opened only to look inside - one of FluidEQ's own, or another
// member's copy.
it("reads a look-inside scene's notes and never writes them", () => {
  const folder = path.join(root, 'official');
  fs.mkdirSync(folder);
  const kept = JSON.stringify({ schema: 1, description: 'FluidEQ’s own' });
  fs.writeFileSync(fileOf(folder), kept);
  const dispose = registerStudioNotesIpc({
    folderFor: () => folder,
    writableFolderFor: () => undefined,
  });
  try {
    expect(call('studio-notes-read', 'official')).toEqual({
      description: 'FluidEQ’s own',
    });
    expect(
      call('studio-notes-save', 'official', { description: 'changed' }),
    ).toBe(false);
    expect(fs.readFileSync(fileOf(folder), 'utf8')).toBe(kept);
  } finally {
    dispose();
  }
});
