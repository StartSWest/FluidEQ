/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { memo, useId, useMemo } from 'react';
import type { IEqSettings } from '../../../common/dsp/chain';
import {
  CARD_CURVE_BOX,
  presetCardCurve,
  type IPresetCurveDesign,
} from './presetCardDrawing';

/**
 * The card's ink: the accent on the preset that plays, the Preset layer's
 * violet on one of the listener's own, a quiet one on the rest.
 */
export type TPresetCardCurveTone = 'playing' | 'own' | 'plain';

interface IPresetCardCurveProps {
  curve: IEqSettings | undefined;
  design: IPresetCurveDesign;
  tone: TPresetCardCurveTone;
}

/**
 * A preset's tone drawn along the foot of its card on the Preset tab (Ivan,
 * 2026-11-20: "I want to show the curves on each preset card"): 20 Hz to
 * 20 kHz, a faint 0 dB hairline, and the line with a soft glow between it
 * and the hairline — above it for a boost, below it for a cut. Nothing at
 * all for a preset with no curve, never a flat line that would say it has
 * one and does nothing.
 *
 * Memoised on its three props, each of which keeps its identity while it
 * means the same: the tab renders again on every tile the pointer crosses,
 * and eighty cards drawing their SVG again each time is what made a grid
 * feel heavy under the pointer.
 */
const PresetCardCurve = ({ curve, design, tone }: IPresetCardCurveProps) => {
  const glowId = useId();
  const drawing = useMemo(
    () => presetCardCurve(curve, design),
    [curve, design],
  );
  if (!drawing) {
    return null;
  }
  const { padding, width, height } = CARD_CURVE_BOX;
  return (
    <svg
      className={`preset-card-curve preset-card-curve--${tone}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Brightest at the strip's edges and gone at 0 dB, so the glow
            follows the line away from flat and fades toward it. */}
        <linearGradient
          id={glowId}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1={padding.top}
          x2="0"
          y2={height - padding.bottom}
        >
          <stop offset="0" stopColor="currentColor" stopOpacity="0.32" />
          <stop offset="0.5" stopColor="currentColor" stopOpacity="0" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.32" />
        </linearGradient>
      </defs>
      <line
        className="preset-card-curve__zero"
        x1="0"
        x2={width}
        y1={drawing.zero}
        y2={drawing.zero}
      />
      <path
        className="preset-card-curve__glow"
        d={drawing.area}
        fill={`url(#${glowId})`}
      />
      <path className="preset-card-curve__line" d={drawing.line} />
    </svg>
  );
};

export default memo(PresetCardCurve);
