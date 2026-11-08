/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IScenePack } from 'common/scenePacks';
import {
  paletteKey,
  paletteLinear,
  paletteTexels,
  PALETTE_TEXELS,
  type IScenePaletteValue,
} from 'common/scenePalette';

/**
 * A scene's palettes as its program holds them (contract 9): the texels the
 * GPU is handed and the same colours as numbers, for a world's colour
 * formulas. Both are made again only when a palette's colours change - a
 * member dragging a stop, a preset picked, a save - never every frame,
 * though every frame carries the palettes: a frame is a message to the
 * scene's worker, and a key of the colours is what tells it nothing moved.
 */

export interface IScenePaletteSlot {
  id: string;
  /** RGBA, sRGB-encoded, `PALETTE_TEXELS` wide: an `SRGB8_ALPHA8` row. */
  texels: Uint8Array;
  /** The same in linear light, three floats a texel. */
  linear: Float32Array;
}

export interface IScenePaletteSlots {
  slots: readonly IScenePaletteSlot[];
  /**
   * Takes this frame's palettes, the pack's own where the frame says
   * nothing, and answers the slots whose colours changed.
   */
  update(
    given: Readonly<Record<string, IScenePaletteValue>> | undefined,
  ): IScenePaletteSlot[];
  /** The colour at `t` of palette `id`, in linear light, into `out`. */
  colourAt(id: string, t: number, out: [number, number, number]): boolean;
}

export const createScenePaletteSlots = (
  pack: IScenePack,
): IScenePaletteSlots => {
  const own = pack.palettes ?? [];
  const keys = own.map((palette) => paletteKey(palette));
  const slots: IScenePaletteSlot[] = own.map((palette) => ({
    id: palette.id,
    texels: paletteTexels(palette),
    linear: paletteLinear(palette),
  }));
  const byId = new Map(slots.map((slot) => [slot.id, slot]));
  return {
    slots,
    update: (given) => {
      const changed: IScenePaletteSlot[] = [];
      own.forEach((palette, index) => {
        const value = given?.[palette.id] ?? palette;
        const key = paletteKey(value);
        if (key === keys[index]) {
          return;
        }
        keys[index] = key;
        const slot = slots[index];
        slot.texels.set(paletteTexels(value));
        slot.linear.set(paletteLinear(value));
        changed.push(slot);
      });
      return changed;
    },
    colourAt: (id, t, out) => {
      const slot = byId.get(id);
      if (!slot) {
        return false;
      }
      // Linear between texels, as the sampler reads them.
      const at =
        Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0)) *
        (PALETTE_TEXELS - 1);
      const low = Math.floor(at);
      const high = Math.min(PALETTE_TEXELS - 1, low + 1);
      const k = at - low;
      for (let c = 0; c < 3; c += 1) {
        const a = slot.linear[low * 3 + c];
        out[c] = a + (slot.linear[high * 3 + c] - a) * k;
      }
      return true;
    },
  };
};
