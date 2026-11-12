/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * pack_artwork on a scene whose pack.json lists one region it cannot read
 * (2026-11-09). The alpine scene listed 41 pieces, three in camelCase from
 * an earlier pack made by hand; the region reader then answered none of
 * them, the tool took the whole 4096 x 2048 artwork for one of the member's
 * photo places, kept whole, and refused even one small bird - and every
 * kept piece by name ("the artwork has no piece aurora").
 *
 * The window that lays the artwork out and encodes it is played by the test.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IStudioChatPackAsk } from '../../../common/studioChat';
import { pngHeader, webpHeader } from '../../utils/pictureHeaders';

jest.mock('electron', () => ({
  nativeImage: jest.requireActual('../../utils/fakePngImage').default,
}));

// eslint-disable-next-line import/first -- the mock must be installed first
import createPackArtworkTool from '../../../main/studioChat/packArtworkTool';

const folders: string[] = [];

afterEach(() => {
  folders
    .splice(0)
    .forEach((folder) => fs.rmSync(folder, { recursive: true, force: true }));
});

/** A project with a full-size artwork, a bird in art/ and `manifest`. */
const projectWith = (manifest: Record<string, unknown>) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-pack-'));
  folders.push(folder);
  fs.writeFileSync(
    path.join(folder, 'pack.json'),
    JSON.stringify({
      id: 'alpine',
      artworkFile: 'artwork.webp',
      artworkWidth: 4096,
      artworkHeight: 2048,
      ...manifest,
    }),
  );
  fs.writeFileSync(path.join(folder, 'artwork.webp'), webpHeader(4096, 2048));
  fs.mkdirSync(path.join(folder, 'art'));
  fs.writeFileSync(path.join(folder, 'art', 'bird.png'), pngHeader(192, 192));
  return folder;
};

const pack = async (folder: string, pieces: unknown[]) => {
  const asks: Omit<IStudioChatPackAsk, 'id'>[] = [];
  const tool = createPackArtworkTool({
    project: () => ({ ok: true, id: 'alpine', folder }),
    packInWindow: async (ask) => {
      asks.push(ask);
      return { ok: true, webp: webpHeader(1, 1) };
    },
  });
  const result = await tool.call({ pieces });
  return { result, asks };
};

const BIRD = { id: 'bird', from: 'art/bird.png', kind: 'subject' };
const AURORA = { id: 'aurora', x: 32, y: 32, width: 1536, height: 383 };

describe('pack_artwork beside a region it cannot read', () => {
  it('packs a small bird and keeps a piece by name, the whole artwork no photo place', async () => {
    const folder = projectWith({
      artworkRegions: [
        AURORA,
        // As the alpine scene's earlier pack by hand wrote three of them.
        { id: 'boatSloop', x: 1736, y: 1129, width: 380, height: 468 },
        // And one no reader can take: past the artwork's edge.
        { id: 'stray', x: 4000, y: 0, width: 512, height: 64 },
      ],
    });

    const { result, asks } = await pack(folder, [
      BIRD,
      { id: 'aurora', from: 'artwork:aurora', kind: 'tile' },
      { id: 'boat-sloop', from: 'artwork:boatSloop', kind: 'subject' },
    ]);

    expect(result.isError).toBeUndefined();
    expect(asks).toHaveLength(1);
    expect(asks[0].keep).toEqual([]);
    expect(asks[0].pieces.map((piece) => piece.fromArtwork)).toContainEqual({
      x: 32,
      y: 32,
      width: 1536,
      height: 383,
    });
    const written = JSON.parse(
      fs.readFileSync(path.join(folder, 'pack.json'), 'utf8'),
    );
    expect(
      written.artworkRegions.map(({ id }: { id: string }) => id).sort(),
    ).toEqual(['aurora', 'bird', 'boat-sloop']);
  });

  it('packs the bird beside an artwork whose every listed region is unreadable', async () => {
    const folder = projectWith({
      artworkRegions: [{ id: 'stray', x: 4000, y: 0, width: 512, height: 64 }],
    });

    const { result, asks } = await pack(folder, [BIRD]);

    expect(result.isError).toBeUndefined();
    expect(asks[0]?.keep).toEqual([]);
  });

  // The control: an older artwork that is one photo of the member's and
  // nothing else lists no regions, and stays one place, kept whole - so the
  // same bird has no room beside it, and the refusal is what this test sees.
  it('keeps an artwork that lists no pieces of its own as one photo place, with no room beside it', async () => {
    const folder = projectWith({});

    const { result, asks } = await pack(folder, [BIRD]);

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('do not fit');
    expect(asks).toHaveLength(0);
  });
});
