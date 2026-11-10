/**
 * @jest-environment node
 */

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The sheet tools keep to the scene's project (`chatSandbox.ts`: the
 * Studio's agents work inside the scene's folder): they read a picture only
 * from inside it, write only `art/<name>.png` and its animation under a name
 * they check, never over a picture of the member's, decode nothing past the
 * sheet's bounds, stop when the member stops, and build so many sheets a
 * reply. Each refusal beside the case it must still allow.
 */

jest.mock('electron', () => ({ nativeImage: {} }));

/* eslint-disable import/first -- the mock above must be installed first */
import fs from 'fs';
import path from 'path';
import { readProjectAnimation } from '../../../main/memberScenes/projectAnimations';
import { MAX_SHEETS_PER_REPLY } from '../../../main/studioChat/sheetFiles';
import { pngHeader, webpHeader } from '../../utils/pictureHeaders';
import {
  createSheetProject,
  DIVE,
  encode,
  whale,
  words,
} from '../../utils/sheetFixtures';
/* eslint-enable import/first */

const sheets = createSheetProject();
const { tool, write, decode } = sheets;

beforeEach(sheets.setUp);
afterEach(sheets.tearDown);

const inProject = (relative: string) =>
  path.join(sheets.state.project, relative);

const refused = async (name: string, args: Record<string, unknown>) => {
  const result = await tool(name).call(args);
  expect(result.isError).toBe(true);
  expect(fs.existsSync(inProject('art/whale-dive.png'))).toBe(false);
  return words(result);
};

it('reads a picture inside the project and nothing that climbs out of it', async () => {
  const away = path.join(sheets.state.outside, 'whale.png');
  fs.writeFileSync(away, encode(whale()));
  const climbing = path.relative(sheets.state.project, away);
  expect(await refused('pose_sheet', { ...DIVE, from: climbing })).toContain(
    'not inside',
  );
  expect(await refused('pose_sheet', { ...DIVE, from: away })).toContain(
    'not inside',
  );
  expect(
    await refused('build_sheet', {
      name: 'whale-dive',
      columns: 1,
      frames: [{ from: climbing }],
    }),
  ).toContain('not inside');
  // The positive control: the same picture inside the project is read.
  expect((await tool('pose_sheet').call(DIVE)).isError).toBeUndefined();
});

it('follows a junction to where it really leads, and refuses it there', async () => {
  fs.writeFileSync(
    path.join(sheets.state.outside, 'whale.png'),
    encode(whale()),
  );
  fs.symlinkSync(sheets.state.outside, inProject('linked'), 'junction');
  expect(
    await refused('pose_sheet', { ...DIVE, from: 'linked/whale.png' }),
  ).toContain('not inside');
});

it('writes only under a name it checks, never a path', async () => {
  await Promise.all(
    ['../escape', 'a/b', 'a\\b', 'Whale', '', 'x'.repeat(41)].map((name) =>
      refused('pose_sheet', { ...DIVE, name }),
    ),
  );
  expect(fs.readdirSync(sheets.state.outside)).toEqual([]);
});

it('refuses counts, grids and cells past their bounds before decoding anything', async () => {
  await refused('pose_sheet', { ...DIVE, count: 49 });
  await refused('pose_sheet', { ...DIVE, columns: 17, count: 40 });
  await refused('pose_sheet', { ...DIVE, cell: 1024 });
  await refused('pose_sheet', {
    ...DIVE,
    keys: Array.from({ length: 25 }, (_, at) => ({ at: at / 25 })),
  });
  await refused('build_sheet', {
    name: 'whale-dive',
    columns: 4,
    frames: Array.from({ length: 49 }, () => ({
      from: 'art/whale-rig-cut.png',
    })),
  });
  expect(decode).not.toHaveBeenCalled();
});

it("judges a picture's size by its own header, and never decodes one past the sheet's bounds", async () => {
  write('art/bomb.png', Buffer.from(pngHeader(40000, 40000)));
  expect(
    await refused('pose_sheet', { ...DIVE, from: 'art/bomb.png' }),
  ).toContain('megapixels');
  expect(decode).not.toHaveBeenCalled();
});

it('says a WebP is one main cannot decode, rather than calling it unreadable', async () => {
  write('art/whale.webp', Buffer.from(webpHeader(200, 80)));
  expect(
    await refused('pose_sheet', { ...DIVE, from: 'art/whale.webp' }),
  ).toContain('WebP');
  expect(decode).not.toHaveBeenCalled();
});

it("never writes over the member's own picture, and still over a sheet of its own", async () => {
  const source = fs.readFileSync(inProject('art/whale-rig-cut.png'));
  expect(
    (await tool('pose_sheet').call({ ...DIVE, name: 'whale-rig-cut' })).isError,
  ).toBe(true);
  expect(
    fs.readFileSync(inProject('art/whale-rig-cut.png')).equals(source),
  ).toBe(true);
  // A picture of theirs that only shares the name is theirs as well.
  write('art/sunset.png', encode(whale()));
  const theirs = fs.readFileSync(inProject('art/sunset.png'));
  expect(
    (await tool('pose_sheet').call({ ...DIVE, name: 'sunset' })).isError,
  ).toBe(true);
  expect(fs.readFileSync(inProject('art/sunset.png')).equals(theirs)).toBe(
    true,
  );
  // The control: the tools' own sheet is made again under its name.
  expect((await tool('pose_sheet').call(DIVE)).isError).toBeUndefined();
  expect(
    (await tool('pose_sheet').call({ ...DIVE, count: 4 })).isError,
  ).toBeUndefined();
  expect(
    (await readProjectAnimation(sheets.state.project, 'whale-dive'))?.animation
      .count,
  ).toBe(4);
});

it('writes neither file when the animations folder cannot take one', async () => {
  write('animations', 'a file where the folder should be');
  expect(await refused('pose_sheet', DIVE)).toContain('animations folder');
});

it('stops when the member stops the reply, and writes nothing', async () => {
  sheets.state.controller.abort();
  expect(await refused('pose_sheet', DIVE)).toContain('stopped');
});

it('builds at most so many sheets in one reply, counted by FluidEQ', async () => {
  const small = { ...DIVE, count: 2, columns: 2, cell: 32 };
  for (let made = 0; made < MAX_SHEETS_PER_REPLY; made += 1) {
    // eslint-disable-next-line no-await-in-loop -- the budget is spent one call at a time
    expect((await tool('pose_sheet').call(small)).isError).toBeUndefined();
  }
  const spent = await tool('pose_sheet').call(small);
  expect(spent.isError).toBe(true);
  expect(words(spent)).toContain(String(MAX_SHEETS_PER_REPLY));
  // The next reply has a budget of its own.
  sheets.nextReply();
  expect((await tool('pose_sheet').call(small)).isError).toBeUndefined();
});
