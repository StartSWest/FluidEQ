/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The chat's write_whats_new tool against a real project folder: the line
 * goes where the Publish dialog reads it, in the shape it reads, with every
 * other key of the notes kept exactly - the member's description above all,
 * whatever its length - and an unusable line refused with the reason, never
 * written as something the dialog would show as empty.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { VERSION_NOTE_LOCALES } from '../../../common/sceneVersionNote';
import { readStudioNotes } from '../../../main/ipc/studioNotes';
import createWhatsNewTool from '../../../main/studioChat/whatsNewTool';

const LINE = 'A black hole bends the starlight with the bass';
const EVERY = Object.fromEntries(
  VERSION_NOTE_LOCALES.map((locale) => [locale, `${LINE} (${locale})`]),
);

let folder: string;
beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'whats-new-'));
});
afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

const toolHere = () =>
  createWhatsNewTool({
    project: () => ({ ok: true, id: 'black-hole', folder }),
  });
const said = (result: { content: Array<{ type: string; text?: string }> }) =>
  result.content.map((part) => part.text ?? '').join(' ');
const notesFile = () => path.join(folder, 'studio-notes.json');

it('writes the line where the Publish dialog reads it, in every language', async () => {
  const result = await toolHere().call({ whatsNew: EVERY });
  expect(result.isError).toBeUndefined();
  expect(said(result)).toContain(JSON.stringify(EVERY.en));
  expect(readStudioNotes(folder)).toEqual({
    description: '',
    whatsNew: EVERY.en,
    whatsNewLines: EVERY,
  });
});

it('keeps every other key, a description longer than the editor allows included', async () => {
  const description = 'd'.repeat(5000);
  fs.writeFileSync(
    notesFile(),
    JSON.stringify({
      description,
      earlierIdea: 'an idea',
      published: 7,
      release_notes: 'a line an AI left under another name',
    }),
  );
  await toolHere().call({ whatsNew: { en: LINE } });
  const written = JSON.parse(fs.readFileSync(notesFile(), 'utf8'));
  expect(written).toEqual({
    description,
    earlierIdea: 'an idea',
    published: 7,
    whatsNew: { en: LINE },
  });
  // No temporary left beside it.
  expect(fs.readdirSync(folder)).toEqual(['studio-notes.json']);
});

it('says which languages are still to write', async () => {
  const result = await toolHere().call({
    whatsNew: { en: LINE, es: 'Un agujero' },
  });
  expect(said(result)).toMatch(/still to write in de, fr/);
  expect(said(result)).not.toMatch(/nothing else is needed/);
  // The control: every language written, nothing left to say.
  expect(said(await toolHere().call({ whatsNew: EVERY }))).not.toMatch(
    /still to write/,
  );
});

// The member waits on the Publish dialog while the chat finishes its reply
// (Ivan, 2026-11-23: "it continues thinking"): a whole line says it is done.
it('tells the chat a line in every language is all it needs', async () => {
  expect(said(await toolHere().call({ whatsNew: EVERY }))).toMatch(
    /nothing else is needed.*no further checks or tools/,
  );
});

it('refuses a line nothing in which can be kept, and writes nothing', async () => {
  const result = await toolHere().call({
    whatsNew: { es: 'Un agujero negro' },
  });
  expect(result.isError).toBe(true);
  expect(said(result)).toMatch(/"en"/);
  expect(fs.existsSync(notesFile())).toBe(false);
});

// Alpine's folder is in OneDrive, whose sync and the virus scanner hold its
// files open, and a bare rename was refused there (2026-11-25): the chat was
// told only "could not be written" and wrote the file by hand.
it('writes the line while another program holds the notes open', async () => {
  fs.writeFileSync(notesFile(), JSON.stringify({ description: 'A lake' }));
  jest.spyOn(fs, 'renameSync').mockImplementation(() => {
    throw Object.assign(new Error('EPERM: operation not permitted'), {
      code: 'EPERM',
    });
  });
  try {
    const result = await toolHere().call({ whatsNew: EVERY });
    expect(result.isError).toBeUndefined();
  } finally {
    jest.restoreAllMocks();
  }
  expect(readStudioNotes(folder)).toEqual({
    description: 'A lake',
    whatsNew: EVERY.en,
    whatsNewLines: EVERY,
  });
  expect(fs.readdirSync(folder)).toEqual(['studio-notes.json']);
});

it('says why the notes could not be written, and not to write them by hand', async () => {
  // Nothing can replace a folder standing where the notes go.
  fs.mkdirSync(notesFile());
  const result = await toolHere().call({ whatsNew: EVERY });
  expect(result.isError).toBe(true);
  expect(said(result)).toMatch(
    /could not be written in the project folder \(E[A-Z]+\)/,
  );
  expect(said(result)).toMatch(/Call write_whats_new once more/);
  expect(said(result)).toMatch(/do not write studio-notes\.json yourself/);
});

it('writes nothing for a project that is no longer the chat’s', async () => {
  const tool = createWhatsNewTool({
    project: () => ({ ok: false, reason: 'not-a-project' }),
  });
  const result = await tool.call({ whatsNew: EVERY });
  expect(result.isError).toBe(true);
  expect(fs.existsSync(notesFile())).toBe(false);
});
