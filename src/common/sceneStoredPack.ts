/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A built scene (`IScenePack`) in the layout it is stored and signed in: the
 * inverse of `normalizeScenePack`.
 *
 * Built, a scene keeps its palettes and single colours apart from `params`,
 * and a choice is a param that has `options`. Stored - in a pack file, in the
 * gallery, and in what the signing service reads (its `checkMemberPack`) -
 * every control is an entry of `params`: sliders and
 * choices in their own order, `"type": "choice"` on a choice, then the
 * palettes, then the colours, each with its `type`. The service reads
 * nothing else, so a built pack sent as it was lost every palette, colour and
 * choice option on its way to the gallery, and a preview clip stamped over
 * the built layout never matched the one the service rebuilt (2026-11-08:
 * Chrome refused as "changed after recording" on every press).
 *
 * Measured on Chrome's own project against the service's checker: this
 * layout comes back from it with the same preview payload, byte for byte. A
 * scene with none of the three is unchanged by it.
 */

import { CHOICE_TYPE } from './sceneChoice';
import { COLOUR_TYPE } from './sceneColourControl';
import { PALETTE_TYPE } from './scenePalette';
import type { IScenePack } from './scenePacks';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A scene record read from disk, in the stored layout whichever one it was
 * written in. Until 2026-11-11 the looks kept a member's own scene in the
 * built layout and read it back as the stored one, so every palette, colour
 * and choice option was lost and the graph compiled the shader without the
 * uniforms it names ("'uPalette_colours' : undeclared identifier"). Copies
 * written that way are moved into the stored layout here, so they play
 * again without being added again; a record already stored passes as it
 * was. What it holds is still checked by the reader after this.
 */
export const storedFormOf = (raw: unknown): unknown => {
  if (!isRecord(raw) || !Array.isArray(raw.params)) {
    return raw;
  }
  const { palettes, colours, ...rest } = raw;
  const original: unknown[] = raw.params;
  const built = Array.isArray(palettes) || Array.isArray(colours);
  const params = original.map((param) =>
    isRecord(param) && Array.isArray(param.options) && param.type === undefined
      ? { ...param, type: CHOICE_TYPE }
      : param,
  );
  if (!built && params.every((param, at) => param === original[at])) {
    return raw;
  }
  return {
    ...rest,
    params: [
      ...params,
      ...(Array.isArray(palettes) ? palettes : [])
        .filter(isRecord)
        .map((palette) => ({ type: PALETTE_TYPE, ...palette })),
      ...(Array.isArray(colours) ? colours : [])
        .filter(isRecord)
        .map((colour) => ({ type: COLOUR_TYPE, ...colour })),
    ],
  };
};

export default function storedScenePack(
  pack: IScenePack,
): Record<string, unknown> {
  const { palettes, colours, ...rest } = pack;
  return {
    ...rest,
    params: [
      ...pack.params.map((param) =>
        param.options ? { ...param, type: CHOICE_TYPE } : param,
      ),
      ...(palettes ?? []).map((palette) => ({
        type: PALETTE_TYPE,
        ...palette,
      })),
      ...(colours ?? []).map((colour) => ({ type: COLOUR_TYPE, ...colour })),
    ],
  };
}
