/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * pack_artwork records which picture each piece of the artwork came from
 * (Ivan, 2026-11-10: an animation the scene does not use deletes at once; a
 * used one asks the chat to take it out and fix the scene), so the
 * Animations tab can tell which animations the scene plays. The record is
 * an authoring file beside the animations' history, never pack.json, whose
 * regions the server holds to an id, a place and a size.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import type { TChatAsks } from '../../../main/studioChat/chatAsks';
import { pngHeader, webpHeader } from '../../utils/pictureHeaders';

jest.mock('electron', () => ({
  nativeImage: jest.requireActual('../../utils/fakePngImage').default,
}));

/* eslint-disable import/first -- the mock must be installed first */
import {
  ARTWORK_SOURCES_FILE,
  readArtworkSources,
} from '../../../main/memberScenes/artworkSources';
import { writeStarterArt } from '../../../main/memberScenes/starterArt';
import createPackArtworkTool from '../../../main/studioChat/packArtworkTool';
/* eslint-enable import/first */

const folders: string[] = [];

afterEach(() => {
  folders
    .splice(0)
    .forEach((folder) => fs.rmSync(folder, { recursive: true, force: true }));
});

const tempFolder = (name: string) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), name));
  folders.push(folder);
  return folder;
};

/** A scene with an aurora and a sloop in its artwork, and a bird in art/. */
const scene = () => {
  const folder = tempFolder('fluideq-sources-');
  fs.writeFileSync(
    path.join(folder, 'pack.json'),
    JSON.stringify({
      id: 'alpine',
      artworkFile: 'artwork.webp',
      artworkWidth: 4096,
      artworkHeight: 2048,
      artworkRegions: [
        { id: 'aurora', x: 32, y: 32, width: 1536, height: 383 },
        { id: 'sloop', x: 1736, y: 1129, width: 380, height: 468 },
      ],
    }),
  );
  fs.writeFileSync(path.join(folder, 'artwork.webp'), webpHeader(4096, 2048));
  fs.mkdirSync(path.join(folder, 'art'));
  fs.writeFileSync(path.join(folder, 'art', 'bird.png'), pngHeader(192, 192));
  return folder;
};

const writeRecord = (folder: string, record: unknown) => {
  fs.mkdirSync(path.dirname(path.join(folder, ARTWORK_SOURCES_FILE)), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(folder, ARTWORK_SOURCES_FILE),
    JSON.stringify(record),
  );
};

const pack = (folder: string, pieces: unknown[]) =>
  createPackArtworkTool({
    project: () => ({ ok: true, id: 'alpine', folder }),
    asks: {} as TChatAsks,
    signalOf: () => new AbortController().signal,
    packInWindow: async () => ({ ok: true, webp: webpHeader(1, 1) }),
  }).call({ pieces });

describe("the artwork's record of where each piece came from", () => {
  it('names a new piece by its picture and keeps what it knew of a kept piece, never in pack.json', async () => {
    const folder = scene();
    writeRecord(folder, { aurora: 'art/aurora.png' });

    const result = await pack(folder, [
      { id: 'bird', from: 'art/bird.png', kind: 'subject' },
      { id: 'aurora', from: 'artwork:aurora', kind: 'tile' },
      // The control: a kept piece the record never knew stays unknown.
      { id: 'boat', from: 'artwork:sloop', kind: 'subject' },
    ]);

    expect(result.isError).toBeUndefined();
    expect(readArtworkSources(folder)).toEqual({
      bird: 'art/bird.png',
      aurora: 'art/aurora.png',
    });
    const written = JSON.parse(
      fs.readFileSync(path.join(folder, 'pack.json'), 'utf8'),
    );
    expect(Object.keys(written.artworkRegions[0]).sort()).toEqual([
      'height',
      'id',
      'width',
      'x',
      'y',
    ]);
  });

  it('lets go of a piece left out of the artwork', async () => {
    const folder = scene();
    writeRecord(folder, { aurora: 'art/aurora.png', sloop: 'art/sloop.png' });
    await pack(folder, [{ id: 'bird', from: 'art/bird.png', kind: 'subject' }]);
    expect(readArtworkSources(folder)).toEqual({ bird: 'art/bird.png' });
  });

  it('reads only well-formed entries, and the proper ones beside them', () => {
    const folder = scene();
    writeRecord(folder, {
      bird: 'art/bird.png',
      Bad: 'art/bird.png',
      climb: '../outside.png',
      deep: 'art/sub/bird.png',
      count: 3,
    });
    expect(readArtworkSources(folder)).toEqual({ bird: 'art/bird.png' });
  });

  it('writes nothing through a history folder that is a link out of the project, and packs all the same', async () => {
    const folder = scene();
    const outside = tempFolder('fluideq-sources-out-');
    fs.symlinkSync(outside, path.join(folder, 'animation-history'), 'junction');
    const result = await pack(folder, [
      { id: 'bird', from: 'art/bird.png', kind: 'subject' },
    ]);
    expect(result.isError).toBeUndefined();
    expect(fs.readdirSync(outside)).toEqual([]);
    expect(readArtworkSources(folder)).toEqual({});
  });

  it("comes with the starter: its swallow is the swallow animation's sheet", async () => {
    const folder = tempFolder('fluideq-sources-starter-');
    await writeStarterArt(
      folder,
      path.join(__dirname, '../../../../assets/studio/starter'),
    );
    expect(readArtworkSources(folder)).toEqual({
      swallow: 'art/swallow-flight.png',
    });
  });
});
