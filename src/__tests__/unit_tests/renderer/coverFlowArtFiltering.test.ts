/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';
import {
  type IArtEntry,
  artAnisotropy,
  createCoverFlowArtCache,
} from '../../../renderer/library/coverFlow/coverFlowArtCache';

jest.mock('../../../renderer/library/coverFlow/coverFlowArt', () => ({
  loadCoverFlowArt: jest.fn(),
  releaseCoverFlowArt: jest.fn(),
}));

/**
 * The Cover Flow's pictures are filtered so a turned or distant cover
 * neither shimmers nor goes soft as the row moves (Ivan, 2026-11-24: "make
 * sure the cover art has a nice very cheap and fast antialiasing"):
 * mipmapped and trilinear, with 4 anisotropic taps where the card has them.
 */

const landed = (): IArtEntry => ({
  request: { artId: 'a', label: 'A', isFolder: false, isPending: false },
  ready: {
    art: {
      source: { width: 224, height: 224 } as unknown as ImageBitmap,
      glow: [0.5, 0.5, 0.5],
    },
    size: 'far',
  },
});

const cacheWith = (anisotropy: number) =>
  createCoverFlowArtCache({
    anisotropy,
    colours: { folderTop: '#000', folderBottom: '#000' },
    onReady: () => undefined,
  });

describe('Cover Flow picture filtering', () => {
  it('asks for 4 anisotropic taps, fewer where the card has fewer', () => {
    expect(artAnisotropy(16)).toBe(4);
    expect(artAnisotropy(8)).toBe(4);
    expect(artAnisotropy(4)).toBe(4);
    expect(artAnisotropy(2)).toBe(2);
    // A card with no anisotropic filtering reports 0: plain sampling.
    expect(artAnisotropy(0)).toBe(1);
  });

  it('mipmaps every landed picture and samples it trilinear, in sRGB', () => {
    const entry = landed();
    cacheWith(artAnisotropy(16)).upload(entry);
    const { texture } = entry;
    expect(texture).toBeDefined();
    expect(texture?.generateMipmaps).toBe(true);
    expect(texture?.minFilter).toBe(LinearMipmapLinearFilter);
    expect(texture?.magFilter).toBe(LinearFilter);
    expect(texture?.anisotropy).toBe(4);
    expect(texture?.colorSpace).toBe(SRGBColorSpace);
    // Uploaded the right way up: the bitmaps arrive already flipped.
    expect(texture?.flipY).toBe(false);
  });

  it('passes on the anisotropy the scene chose', () => {
    const entry = landed();
    cacheWith(2).upload(entry);
    expect(entry.texture?.anisotropy).toBe(2);
  });
});
