/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { toApoText } from '../../../../common/dsp/apoEqFormat';
import type { IEqSettings } from '../../../../common/dsp/chain';
import { dspPresetVoicing } from '../../../../common/dsp/presetVoicing';
import { getCurvePoints } from '../../../graph/curvePreview';

/**
 * A preset's curve as Equalizer APO's ParametricEQ text, for somebody on
 * another equaliser: the bands as the Preset layer plays them — each at its
 * curve's model Q, the subsonic high-pass included, a dynamic band left out
 * as the layer leaves it (`dspPresetVoicing`) — and a preamp that keeps the
 * loudest boost under 0 dBFS, as every correction database publishes one.
 * Undefined for a preset with no curve.
 */
const presetApoText = (curve: IEqSettings | undefined): string | undefined => {
  if (!curve) {
    return undefined;
  }
  const filters = dspPresetVoicing('export', curve).apoOverride?.filters ?? {};
  const played = Object.values(filters);
  if (played.length === 0) {
    return undefined;
  }
  const peak = getCurvePoints(0, undefined, undefined, filters).reduce(
    (loudest, point) => Math.max(loudest, point.y),
    0,
  );
  const bands = played.map((filter) => ({
    enabled: true,
    type: filter.type,
    frequency: filter.frequency,
    gainDb: filter.gain,
    quality: filter.quality,
    // Static, as the layer plays every band it plays (`dspVoicingCurve`).
    dynamic: false,
    thresholdDb: -24,
  }));
  const preamp = `Preamp: ${(-Math.ceil(peak * 10) / 10).toFixed(1)} dB`;
  return `${preamp}\n${toApoText({ ...curve, bands })}\n`;
};

export default presetApoText;
