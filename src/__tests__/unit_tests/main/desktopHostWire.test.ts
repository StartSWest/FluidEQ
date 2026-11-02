/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Main's words to the desktop backgrounds' C++ host and its answers, laid
 * out as `scene_wire.h` says and `desktop_messages_test.cpp` reads them.
 */

import {
  createDesktopHostReader,
  DESKTOP_HOST_KIND,
  encodeMonitorClose,
  encodeMonitorOpen,
  encodeMonitorPause,
  encodeMonitorScale,
  encodeMonitorShow,
} from '../../../main/wallpaper/desktopHostWire';
import {
  encodeShow,
  messageWriter,
  SCENE_HOST_MAGIC,
} from '../../../main/lighting/sceneHostWire';

const view = (bytes: Uint8Array) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

const SCENE = {
  guarded: true,
  response: { sensitivity: 1, threshold: 0.1, attack: 20, release: 200 },
  params: [{ id: 'glow', value: 0.5, min: 0, max: 1 }],
  vertexSource: 'v',
  fragmentSource: 'f',
  view: [0, 0, 1, 1] as const,
  spectrumRect: [0, 0.8, 1, 0.2] as const,
};

describe('the desktop host wire', () => {
  it('opens a monitor left of the main one with its corner signed', () => {
    const open = view(
      encodeMonitorOpen(2, { x: -1920, y: 0, width: 1920, height: 1080 }, 0.75),
    );
    expect(open.getUint32(0, true)).toBe(SCENE_HOST_MAGIC);
    expect(open.getUint32(4, true)).toBe(DESKTOP_HOST_KIND.open);
    expect(open.getUint32(8, true)).toBe(28);
    expect(open.getUint32(12, true)).toBe(2);
    expect(open.getInt32(16, true)).toBe(-1920);
    expect(open.getUint32(24, true)).toBe(1920);
    expect(open.getUint32(28, true)).toBe(1080);
    expect(open.getFloat64(32, true)).toBe(0.75);
  });

  it("shows a scene as the lamps' show, with no swatch, after its monitor", () => {
    const shown = encodeMonitorShow(4, 9, SCENE);
    const lamps = encodeShow(9, [], SCENE);
    expect(view(shown).getUint32(4, true)).toBe(DESKTOP_HOST_KIND.show);
    expect(view(shown).getUint32(12, true)).toBe(4);
    expect([...shown.subarray(16)]).toEqual([...lamps.subarray(12)]);
  });

  it('says a share, a pause and a close in their own kinds', () => {
    const scale = view(encodeMonitorScale(1, 0.5));
    expect([scale.getUint32(4, true), scale.getUint32(12, true)]).toEqual([
      DESKTOP_HOST_KIND.scale,
      1,
    ]);
    expect(scale.getFloat64(16, true)).toBe(0.5);
    const pause = view(encodeMonitorPause(1, true));
    expect([pause.getUint32(4, true), pause.getUint32(16, true)]).toEqual([
      DESKTOP_HOST_KIND.pause,
      1,
    ]);
    const close = encodeMonitorClose(6);
    expect(close.length).toBe(16);
    expect(view(close).getUint32(12, true)).toBe(6);
  });

  it('reads the window, a load, a first frame and a failure, in pieces', () => {
    const heard: string[] = [];
    const read = createDesktopHostReader({
      window: (monitor, hwnd) => heard.push(`window ${monitor} ${hwnd}`),
      loaded: (monitor, id) => heard.push(`loaded ${monitor} ${id}`),
      drawn: (monitor, id) => heard.push(`drawn ${monitor} ${id}`),
      failed: (monitor, id, reason, words) =>
        heard.push(`failed ${monitor} ${id} ${reason} ${words}`),
      invalid: (why) => heard.push(`invalid ${why}`),
    });
    const window = messageWriter(DESKTOP_HOST_KIND.window)
      .u32(4)
      .u32(0x00a0b0c0)
      .u32(1)
      .finish();
    const loaded = messageWriter(DESKTOP_HOST_KIND.loaded)
      .u32(4)
      .u32(9)
      .finish();
    const drawn = messageWriter(DESKTOP_HOST_KIND.drawn).u32(4).u32(9).finish();
    const failed = messageWriter(DESKTOP_HOST_KIND.failed)
      .u32(4)
      .u32(9)
      .u32(2)
      .text('no')
      .finish();
    const all = new Uint8Array(
      window.length + loaded.length + drawn.length + failed.length,
    );
    all.set(window);
    all.set(loaded, window.length);
    all.set(drawn, window.length + loaded.length);
    all.set(failed, window.length + loaded.length + drawn.length);
    read(all.subarray(0, 7));
    read(all.subarray(7));
    expect(heard).toEqual([
      `window 4 ${BigInt(0x1_00a0b0c0)}`,
      'loaded 4 9',
      'drawn 4 9',
      'failed 4 9 compile no',
    ]);
  });

  it('stops reading at an answer that is not one', () => {
    const invalid = jest.fn();
    const read = createDesktopHostReader({
      window: jest.fn(),
      loaded: jest.fn(),
      drawn: jest.fn(),
      failed: jest.fn(),
      invalid,
    });
    read(messageWriter(DESKTOP_HOST_KIND.drawn).u32(4).finish());
    expect(invalid).toHaveBeenCalledTimes(1);
  });
});
