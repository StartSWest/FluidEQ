/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The installed icon at the sizes the notification area and the taskbar ask
 * for (Ivan, 2026-11-25, beside FluidWallpapers: "the FluidEQ icon is too
 * small ... make sure the border is as visible"). One drawing scaled to 16px
 * left the tile 3.7% short of each edge and its edge a third of a pixel, a
 * smear; the small frame fills the canvas with a whole-pixel ring. Checked in
 * the files that ship, read as Windows reads them, against the large frame
 * as a control: its padding is still there, so "filled" is not "everything".
 */

import fs from 'fs';
import path from 'path';
import { appIconSvg } from '../../../../.erb/scripts/appIconArt';
import { APP_ICON_FRAMES, appIconFrameFor } from '../../../common/appIconFrame';

const ASSETS = path.join(__dirname, '..', '..', '..', '..', 'assets');
const ICO = fs.readFileSync(path.join(ASSETS, 'icon.ico'));

interface IFrame {
  size: number;
  data: Buffer;
}

const icoFrames = (ico: Buffer): IFrame[] =>
  Array.from({ length: ico.readUInt16LE(4) }, (_, index) => {
    const entry = 6 + index * 16;
    const size = ico.readUInt8(entry) || 256;
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    return { size, data: ico.subarray(offset, offset + length) };
  });

/** One pixel of a 32-bit DIB frame as [r, g, b, a]; rows are stored bottom-up. */
const pixel = ({ size, data }: IFrame, x: number, y: number) => {
  expect(data.readUInt16LE(14)).toBe(32);
  const at = 40 + ((size - 1 - y) * size + x) * 4;
  return [data[at + 2], data[at + 1], data[at], data[at + 3]];
};

const frameOf = (size: number) => {
  const found = icoFrames(ICO).find((frame) => frame.size === size);
  if (!found) {
    throw new Error(`icon.ico has no ${size}px frame`);
  }
  return found;
};

const brightness = ([red, green, blue]: number[]) => Math.max(red, green, blue);

describe('the app icon files', () => {
  it('are drawn from the frames: icon.svg is the large one, the others beside it', () => {
    const [small, mid, large] = APP_ICON_FRAMES;
    const read = (name: string) =>
      fs.readFileSync(path.join(ASSETS, name), 'utf8');
    expect(read('icon.svg')).toBe(appIconSvg(large));
    expect(read('icon-mid.svg')).toBe(appIconSvg(mid));
    expect(read('icon-small.svg')).toBe(appIconSvg(small));
  });

  it('carry a frame drawn for every size Windows asks a window and the tray for', () => {
    expect(icoFrames(ICO).map(({ size }) => size)).toEqual([
      16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96, 128, 256,
    ]);
  });

  it('fill the canvas at 16px with a one-pixel ring', () => {
    const tray = frameOf(16);
    expect(appIconFrameFor(16).name).toBe('small');
    // The top edge's middle: the ring, opaque and bright, right at the edge.
    const ring = pixel(tray, 8, 0);
    expect(ring[3]).toBe(255);
    expect(brightness(ring)).toBeGreaterThan(180);
    // One pixel in: the dark tile, so the ring is one crisp pixel, not a smear.
    expect(brightness(pixel(tray, 8, 1))).toBeLessThan(80);
  });

  it('give the ring two pixels at 32px', () => {
    const tray = frameOf(32);
    expect(brightness(pixel(tray, 16, 0))).toBeGreaterThan(180);
    expect(brightness(pixel(tray, 16, 1))).toBeGreaterThan(180);
    expect(brightness(pixel(tray, 16, 2))).toBeLessThan(80);
  });

  it('keep the large frame’s padding at 128px, the control', () => {
    const large = frameOf(128);
    expect(appIconFrameFor(128).name).toBe('large');
    // 20 of 512 is five pixels of nothing above the tile at 128.
    [0, 1, 2, 3, 4].forEach((row) => {
      expect(pixel(large, 64, row)[3]).toBe(0);
    });
    expect(pixel(large, 64, 5)[3]).toBeGreaterThan(245);
  });
});
