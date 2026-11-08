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
