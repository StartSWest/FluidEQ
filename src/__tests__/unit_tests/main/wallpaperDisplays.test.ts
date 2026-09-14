/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Display, Rectangle } from 'electron';
import createWallpaperAudioRelay from '../../../main/wallpaper/audioRelay';
import {
  physicalLength,
  toWallpaperDisplays,
} from '../../../main/wallpaper/displays';

describe('monitors in physical pixels', () => {
  // Chromium rounds 2560 × 1600 at 150% to 1707 × 1067 DIPs; multiplying back
  // gave a "2561 × 1601" monitor.
  it('recovers the mode Windows reports from a rounded DIP length', () => {
    expect(physicalLength(1707, 1.5)).toBe(2560);
    expect(physicalLength(1067, 1.5)).toBe(1600);
    expect(physicalLength(2560, 1)).toBe(2560);
  });

  // `nativeOrigin` put a 150% monitor at -1707, half over its neighbour.
  it('places each monitor where Windows’ display settings put it', () => {
    const displays = [
      {
        id: 1,
        label: '',
        bounds: { x: -1707, y: 0, width: 1707, height: 1067 },
        size: { width: 1707, height: 1067 },
        scaleFactor: 1.5,
      },
      {
        id: 2,
        label: 'Y27qf-30',
        bounds: { x: 0, y: 0, width: 2560, height: 1440 },
        size: { width: 2560, height: 1440 },
        scaleFactor: 1,
      },
    ] as unknown as Display[];
    const physical = (rect: Rectangle): Rectangle =>
      rect.x < 0 ? { ...rect, x: -2560 } : rect;
    expect(toWallpaperDisplays(displays, 2, physical)).toEqual([
      {
        id: 1,
        label: '',
        x: -2560,
        y: 0,
        width: 2560,
        height: 1600,
        primary: false,
      },
      {
        id: 2,
        label: 'Y27qf-30',
        x: 0,
        y: 0,
        width: 2560,
        height: 1440,
        primary: true,
      },
    ]);
  });
});

describe('the music relayed to the desktop', () => {
  const owner = () => {
    const sent: number[] = [];
    return {
      sent,
      contents: {
        isDestroyed: () => false,
        send: (_channel: string, id: number) => sent.push(id),
      } as never,
    };
  };

  it('keeps one read outstanding, which every monitor asking shares', async () => {
    const relay = createWallpaperAudioRelay();
    const window = owner();
    const first = relay.request(window.contents);
    const second = relay.request(window.contents);
    expect(second).toBe(first);
    expect(window.sent).toHaveLength(1);
    relay.accept({
      requestId: window.sent[0],
      frame: { points: [{ x: 60, y: -12 }], waveform: [0.2] },
    });
    await expect(first).resolves.toEqual({
      points: [{ x: 60, y: -12 }],
      waveform: [0.2],
    });
  });

  it('ignores a late reply to a read that was let go, and a reply of the wrong shape', async () => {
    const relay = createWallpaperAudioRelay();
    const window = owner();
    const stale = relay.request(window.contents);
    relay.cancel();
    await expect(stale).resolves.toBeUndefined();

    const fresh = relay.request(window.contents);
    relay.accept({
      requestId: window.sent[0],
      frame: { points: [], waveform: [] },
    });
    relay.accept({ requestId: window.sent[1], frame: { points: 'loud' } });
    await expect(fresh).resolves.toBeUndefined();
  });
});
