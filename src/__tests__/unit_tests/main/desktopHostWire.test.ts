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
  encodeMonitorChoice,
  encodeMonitorClose,
  encodeMonitorOpen,
  encodeMonitorPause,
  encodeMonitorShow,
  type IMonitorDrawChoice,
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

/** The listener's defaults: the ladder decides, FSR, the best smoothing. */
const AUTO: IMonitorDrawChoice = {
  autoFloor: 0.35,
  fsr: true,
  smoothing: 'best',
  paceMs: 0,
};

/** A choice's five values, from `at`: pinned, floor, FSR, smoothing, pace. */
const choiceAt = (bytes: DataView, at: number) => [
  bytes.getFloat64(at, true),
  bytes.getFloat64(at + 8, true),
  bytes.getUint32(at + 16, true),
  bytes.getUint32(at + 20, true),
  bytes.getFloat64(at + 24, true),
];

describe('the desktop host wire', () => {
  it('opens a monitor left of the main one with its corner signed', () => {
    const open = view(
      encodeMonitorOpen(2, { x: -1920, y: 0, width: 1920, height: 1080 }, AUTO),
    );
    expect(open.getUint32(0, true)).toBe(SCENE_HOST_MAGIC);
    expect(open.getUint32(4, true)).toBe(DESKTOP_HOST_KIND.open);
    expect(open.getUint32(8, true)).toBe(52);
    expect(open.getUint32(12, true)).toBe(2);
    expect(open.getInt32(16, true)).toBe(-1920);
    expect(open.getUint32(24, true)).toBe(1920);
    expect(open.getUint32(28, true)).toBe(1080);
    // No pin: the ladder decides.
    expect(choiceAt(open, 32)).toEqual([-1, 0.35, 1, 2, 0]);
  });

  it("shows a scene as the lamps' show, with no swatch, after its maker", () => {
    const shown = encodeMonitorShow(4, 9, SCENE, true);
    const lamps = encodeShow(9, [], SCENE);
    expect(view(shown).getUint32(4, true)).toBe(DESKTOP_HOST_KIND.show);
    expect(view(shown).getUint32(12, true)).toBe(4);
    expect(view(shown).getUint32(16, true)).toBe(1);
    expect([...shown.subarray(20)]).toEqual([...lamps.subarray(12)]);
    expect(
      view(encodeMonitorShow(4, 9, SCENE, false)).getUint32(16, true),
    ).toBe(0);
  });

  it('says a choice, a pause and a close in their own kinds', () => {
    const chosen = view(
      encodeMonitorChoice(1, {
        pinned: 0.67,
        autoFloor: 0.5,
        fsr: false,
        smoothing: 'off',
        paceMs: 1000 / 30,
      }),
    );
    expect([chosen.getUint32(4, true), chosen.getUint32(12, true)]).toEqual([
      DESKTOP_HOST_KIND.choice,
      1,
    ]);
    expect(choiceAt(chosen, 16)).toEqual([0.67, 0.5, 0, 0, 1000 / 30]);
    expect(
      choiceAt(
        view(encodeMonitorChoice(1, { ...AUTO, smoothing: 'fast' })),
        16,
      )[3],
    ).toBe(1);
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
