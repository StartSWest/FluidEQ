/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ILamp, TLightingKind } from './lightingModel';

/**
 * Where each lamp of a device sits on the scene's picture.
 *
 * The rule is the same for every device: the whole scene is laid over the
 * device's own shape. A keyboard shows the skyline across its keys, a mouse
 * the same skyline down its body, a mousepad's edge the edge of the picture —
 * so the desk reads as one scene seen through several windows, and every
 * device keeps the scene's colours even when it has three lamps.
 */

/** A rows × columns grid of lamps, row by row from the top-left. */
export const gridLamps = (rows: number, columns: number): ILamp[] => {
  const reach = 0.6 / Math.max(rows, columns);
  const lamps: ILamp[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      lamps.push({
        u: (column + 0.5) / columns,
        v: (row + 0.5) / rows,
        reach,
      });
    }
  }
  return lamps;
};

/** A few lamps in a row across the picture, each seeing a wide slice of it. */
export const stripLamps = (count: number, reach = 0.3): ILamp[] =>
  Array.from({ length: count }, (_, index) => ({
    u: (index + 0.5) / count,
    v: 0.55,
    reach,
  }));

/**
 * Lamps around the edge of a rectangle, clockwise from the top-left corner,
 * each seeing the part of the picture's rim nearest it.
 */
export const rimLamps = (count: number): ILamp[] =>
  Array.from({ length: count }, (_, index) => {
    const t = (index + 0.5) / count;
    // Perimeter of a 16:9 frame, walked clockwise.
    const width = 16;
    const height = 9;
    const distance = t * 2 * (width + height);
    if (distance < width) {
      return { u: distance / width, v: 0.06, reach: 0.12 };
    }
    if (distance < width + height) {
      return { u: 0.94, v: (distance - width) / height, reach: 0.12 };
    }
    if (distance < 2 * width + height) {
      return {
        u: 1 - (distance - width - height) / width,
        v: 0.94,
        reach: 0.12,
      };
    }
    return {
      u: 0.06,
      v: 1 - (distance - 2 * width - height) / height,
      reach: 0.12,
    };
  });

/**
 * A Windows Dynamic Lighting device, from the positions its descriptor gives:
 * metres from the top-left of its bounding box. A device whose lamps all sit
 * at one point — some headsets report that — falls back to a strip.
 */
export const lampArrayLamps = (
  positions: readonly number[],
  width: number,
  height: number,
): ILamp[] => {
  const count = Math.floor(positions.length / 3);
  if (count === 0) {
    return [];
  }
  const xs: number[] = [];
  const ys: number[] = [];
  for (let index = 0; index < count; index += 1) {
    xs.push(positions[index * 3]);
    ys.push(positions[index * 3 + 1]);
  }
  // The descriptor's box, or the lamps' own extent where the box is missing
  // or smaller than the lamps inside it. Positions are measured from the
  // box's top-left corner, so nothing is below zero to account for.
  const spanX = Math.max(width, ...xs, 1e-6);
  const spanY = Math.max(height, ...ys, 1e-6);
  const distinct = new Set(xs.map((x, index) => `${x}:${ys[index]}`));
  if (distinct.size === 1) {
    return stripLamps(count);
  }
  // Lamps spread over the device: each sees a patch the size of the gap to
  // its neighbours, so a dense keyboard shows detail and a four-lamp bar
  // shows broad colour.
  const reach = Math.min(0.35, Math.max(0.03, 0.55 / Math.sqrt(count)));
  return xs.map((x, index) => ({
    u: Math.min(1, Math.max(0, x / spanX)),
    v: Math.min(1, Math.max(0, ys[index] / spanY)),
    reach,
  }));
};

/** What Razer Synapse's local service lights: a kind of device, never one. */
export type TChromaChannel =
  'keyboard' | 'mouse' | 'mousepad' | 'headset' | 'keypad' | 'chromalink';

export const CHROMA_CHANNELS: readonly TChromaChannel[] = [
  'keyboard',
  'mouse',
  'mousepad',
  'headset',
  'keypad',
  'chromalink',
];

/**
 * The mousepad channel's twenty zones, in Razer's order: down the right side
 * from the top (0–4), right to left along the bottom (5–9), up the left side
 * (10–14), then left to right along the top (15–19). Measured against Razer
 * Chroma's own mapper, not the REST page, which draws fifteen.
 *
 * It lights more than mousepads. On the machine this was built on, a Base
 * Station V2 Chroma and a Kraken V4 Pro both take their colours from subsets
 * of these zones, so the rim is the picture's rim and every one of them shows
 * the edge of the scene.
 */
const mousepadZones = (): ILamp[] => {
  const zones: ILamp[] = [];
  const edge = 0.08;
  for (let index = 0; index < 5; index += 1) {
    zones.push({ u: 1 - edge, v: 0.1 + (index / 4) * 0.8, reach: 0.14 });
  }
  for (let index = 0; index < 5; index += 1) {
    zones.push({ u: 0.9 - (index / 4) * 0.8, v: 1 - edge, reach: 0.14 });
  }
  for (let index = 0; index < 5; index += 1) {
    zones.push({ u: edge, v: 0.9 - (index / 4) * 0.8, reach: 0.14 });
  }
  for (let index = 0; index < 5; index += 1) {
    zones.push({ u: 0.1 + (index / 4) * 0.8, v: edge, reach: 0.14 });
  }
  return zones;
};

/**
 * Each channel's lamps, in the order its custom effect lists them:
 * keyboard 6 × 22 and keypad 4 × 5 row by row, the mouse's 9 × 7 grid row by
 * row, the mousepad's twenty zones, and five for a headset and for Chroma
 * Link. (Razer's REST reference, checked against what the local service
 * accepted on Razer Chroma 4.0.)
 */
export const CHROMA_CHANNEL_LAMPS: Readonly<
  Record<TChromaChannel, readonly ILamp[]>
> = {
  keyboard: gridLamps(6, 22),
  mouse: gridLamps(9, 7),
  mousepad: mousepadZones(),
  headset: stripLamps(5),
  keypad: gridLamps(4, 5),
  chromalink: stripLamps(5),
};

/**
 * The lamps a device is drawn with on the page when its route does not say
 * where they are — Synapse never does. Close to the real hardware: a
 * keyboard's key grid, a mousepad's rim, a stand's ring.
 */
export const KIND_PREVIEW_LAMPS: Readonly<
  Record<TLightingKind, readonly ILamp[]>
> = {
  keyboard: gridLamps(6, 22),
  // The scroll wheel, the logo, and a strip down each side — where a gaming
  // mouse's lights are, rather than a grid of sixty-three over its body.
  mouse: [
    { u: 0.5, v: 0.2, reach: 0.12 },
    { u: 0.5, v: 0.72, reach: 0.16 },
    ...[0.3, 0.42, 0.54, 0.66, 0.78].map((v) => ({ u: 0.08, v, reach: 0.1 })),
    ...[0.3, 0.42, 0.54, 0.66, 0.78].map((v) => ({ u: 0.92, v, reach: 0.1 })),
  ],
  mousepad: CHROMA_CHANNEL_LAMPS.mousepad,
  // Two glows on each ear cup.
  headset: [
    { u: 0.12, v: 0.55, reach: 0.22 },
    { u: 0.14, v: 0.72, reach: 0.22 },
    { u: 0.86, v: 0.55, reach: 0.22 },
    { u: 0.88, v: 0.72, reach: 0.22 },
  ],
  keypad: gridLamps(4, 5),
  stand: rimLamps(8),
  speaker: Array.from({ length: 6 }, (_, index) => ({
    u: 0.5,
    v: 0.15 + (index / 5) * 0.7,
    reach: 0.2,
  })),
  accessory: stripLamps(5),
};
