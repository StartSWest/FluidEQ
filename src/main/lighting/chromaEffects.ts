/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TChromaChannel } from '../../common/lighting/lampLayouts';

/**
 * The body of a per-lamp custom effect for each Razer Chroma channel.
 *
 * Every shape here was sent to Razer Chroma's local service (4.0.821) and
 * accepted, which matters because the REST reference is wrong about two of
 * them: it gives the mousepad fifteen lamps where the service wants twenty in
 * `CHROMA_CUSTOM2`, and its keyboard `CHROMA_CUSTOM2` example has the wrong
 * number of rows. A body the service refuses comes back as result 87 and
 * lights nothing, silently, so the shapes are pinned by
 * `chromaKeyboard.test.ts`.
 */

/** Razer's colour: 0x00BBGGRR. */
const bgr = (rgb: Uint8Array, lamp: number): number =>
  rgb[lamp * 3 + 2] * 65_536 + rgb[lamp * 3 + 1] * 256 + rgb[lamp * 3];

const row = (rgb: Uint8Array, start: number, count: number): number[] =>
  Array.from({ length: count }, (_, index) => bgr(rgb, start + index));

const grid = (rgb: Uint8Array, rows: number, columns: number): number[][] =>
  Array.from({ length: rows }, (_, index) =>
    row(rgb, index * columns, columns),
  );

const SHAPES: Record<
  TChromaChannel,
  { effect: string; param: (rgb: Uint8Array) => number[] | number[][] }
> = {
  keyboard: { effect: 'CHROMA_CUSTOM', param: (rgb) => grid(rgb, 6, 22) },
  mouse: { effect: 'CHROMA_CUSTOM2', param: (rgb) => grid(rgb, 9, 7) },
  mousepad: { effect: 'CHROMA_CUSTOM2', param: (rgb) => row(rgb, 0, 20) },
  headset: { effect: 'CHROMA_CUSTOM', param: (rgb) => row(rgb, 0, 5) },
  keypad: { effect: 'CHROMA_CUSTOM', param: (rgb) => grid(rgb, 4, 5) },
  chromalink: { effect: 'CHROMA_CUSTOM', param: (rgb) => row(rgb, 0, 5) },
};

/** `rgb` holds the channel's lamps in `CHROMA_CHANNEL_LAMPS` order. */
export const chromaEffectBody = (
  channel: TChromaChannel,
  rgb: Uint8Array,
  keys?: Uint32Array,
): string => {
  if (channel === 'keyboard' && keys) {
    return JSON.stringify({
      effect: 'CHROMA_CUSTOM_KEY',
      param: {
        color: grid(rgb, 6, 22),
        key: Array.from({ length: 6 }, (_, row) =>
          Array.from(keys.subarray(row * 22, row * 22 + 22)),
        ),
      },
    });
  }
  const shape = SHAPES[channel];
  return JSON.stringify({ effect: shape.effect, param: shape.param(rgb) });
};

/** Razer's result codes that change what the app does. */
export const CHROMA_RESULT = {
  success: 0,
  /** "Chroma Apps" is switched off in Razer Chroma. */
  resourceDisabled: 4309,
  deviceNotConnected: 1167,
} as const;
