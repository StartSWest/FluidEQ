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
  version: 1,
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
  analysis: { vocalFocus: true },
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

  it('uses a hashed filename and restores/deletes the validated draft', () => {
    saveKaraokeMakerDraft(directory, project());
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

    deleteKaraokeMakerDraft(directory, '../../cannot-escape');
    expect(
      loadKaraokeMakerDraft(directory, '../../cannot-escape'),
    ).toBeUndefined();
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
