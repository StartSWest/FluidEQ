/* FluidEQ Karaoke Maker storage tests. GPL-3.0-or-later. */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  deleteKaraokeMakerDraft,
  loadKaraokeMakerDraft,
  normalizeKaraokeMakerExport,
  saveKaraokeMakerDraft,
} from '../../../main/karaokeMakerStorage';
import { IKaraokeMakerProject } from '../../../common/karaoke/makerProject';

const project = (): IKaraokeMakerProject => ({
  version: 2,
  id: '../../cannot-escape',
  title: 'Draft',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  audio: {
    name: 'song.mp3',
    relativePath: 'song.mp3',
    size: 10,
    lastModified: 1,
    durationMs: 2_000,
  },
  lyrics: { source: 'manual', lines: [] },
  melody: { source: 'manual', octavePolicy: 'nearest-target', notes: [] },
  meta: { gapMs: 0, rightsConfirmed: false },
  analysis: {},
  provenance: [],
});

describe('Karaoke Maker draft and export storage', () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-maker-'));
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('uses a hashed filename and restores/deletes the validated draft', async () => {
    await saveKaraokeMakerDraft(directory, project());
    const draftDirectory = path.join(directory, 'karaoke-maker');
    const files = fs.readdirSync(draftDirectory);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^[a-f0-9]{64}\.json$/);
    expect(
      loadKaraokeMakerDraft(directory, '../../cannot-escape'),
    ).toMatchObject({
      id: '../../cannot-escape',
      title: 'Draft',
    });

    await deleteKaraokeMakerDraft(directory, '../../cannot-escape');
    expect(
      loadKaraokeMakerDraft(directory, '../../cannot-escape'),
    ).toBeUndefined();
  });

  it('lands a save and a delete asked in a row in that order', async () => {
    // Not waited for between them, as the window does not wait: a save still
    // on its way must not land after the delete and bring the draft back.
    const saved = saveKaraokeMakerDraft(directory, project());
    const deleted = deleteKaraokeMakerDraft(directory, '../../cannot-escape');
    await Promise.all([saved, deleted]);

    expect(
      loadKaraokeMakerDraft(directory, '../../cannot-escape'),
    ).toBeUndefined();
    // Nothing half-written is left beside it either. The delete may have
    // superseded the save before it started, in which case there is no
    // folder at all.
    const folder = path.join(directory, 'karaoke-maker');
    expect(fs.existsSync(folder) ? fs.readdirSync(folder) : []).toEqual([]);
  });

  it('normalizes an export without allowing path traversal or bad extensions', () => {
    expect(
      normalizeKaraokeMakerExport({
        fileName: '../../unsafe/song.txt',
        contents: 'E\n',
        formatName: 'UltraStar',
        extensions: ['txt', '../exe', 'lrc'],
      }),
    ).toEqual({
      fileName: 'song.txt',
      contents: 'E\n',
      formatName: 'UltraStar',
      extensions: ['txt', 'lrc'],
    });
  });
});
