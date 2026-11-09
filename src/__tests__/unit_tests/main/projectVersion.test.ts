/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * The version a publication writes into the project (`projectVersion.ts`):
 * one above the gallery's, whatever the file said (Ivan, 2026-11-09: "Only
 * when publishing").
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { setPublishedVersion } from '../../../main/memberScenes/projectVersion';

let project: string;

const writePack = (pack: Record<string, unknown>) =>
  fs.writeFileSync(
    path.join(project, 'pack.json'),
    `${JSON.stringify(pack, null, 2)}\n`,
  );
const readPack = () =>
  JSON.parse(fs.readFileSync(path.join(project, 'pack.json'), 'utf8'));

beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-version-'));
});

afterEach(() => {
  fs.rmSync(project, { recursive: true, force: true });
});

describe("a publication's version in the project", () => {
  // A maker's AI used to raise the number for every change: the gallery had
  // v10 and the project said v23.
  it('is one above the gallery even when the project ran ahead of it', async () => {
    writePack({ id: 'alpine', version: 23, names: { en: 'Alpine' } });
    expect(await setPublishedVersion(project, 10)).toBe('written');
    expect(readPack()).toEqual({
      id: 'alpine',
      version: 11,
      names: { en: 'Alpine' },
    });
  });

  it('is 1 for a first publication, whatever the project said', async () => {
    writePack({ id: 'alpine', version: 23 });
    expect(await setPublishedVersion(project, undefined)).toBe('written');
    expect(readPack().version).toBe(1);
  });

  it('leaves a project already at that number as it was', async () => {
    writePack({ id: 'alpine', version: 4 });
    const before = fs.readFileSync(path.join(project, 'pack.json'), 'utf8');
    expect(await setPublishedVersion(project, 3)).toBe('unchanged');
    expect(fs.readFileSync(path.join(project, 'pack.json'), 'utf8')).toBe(
      before,
    );
  });
});
