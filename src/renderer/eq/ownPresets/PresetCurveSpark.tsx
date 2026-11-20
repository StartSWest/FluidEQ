/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, useMemo } from 'react';
import type { IEqSettings } from '../../../common/dsp/chain';
import { dspPresetVoicing } from '../../../common/dsp/presetVoicing';
import {
  curveScales,
  getCurvePoints,
  makePath,
  type ICurveBox,
} from '../../graph/curvePreview';

/** A tile's, a dialog's and the notes' sizes: each drawn at its own aspect. */
export const SPARK_BOXES = {
  tile: {
    width: 44,
    height: 20,
    padding: { top: 3, right: 2, bottom: 3, left: 2 },
  },
  wide: {
    width: 260,
    height: 56,
    padding: { top: 6, right: 4, bottom: 6, left: 4 },
  },
} as const satisfies Record<string, ICurveBox>;

/** The scale never closes in past ±6 dB, so a gentle curve looks gentle. */
const FLOOR_DB = 6;
const LOW_HZ = 20;
const HIGH_HZ = 20_000;

/**
 * A preset's curve as it plays — its bands at the Q its model builds them
 * with (`dspPresetVoicing`) — drawn small in the preset's amber, glowing
 * above the line for a boost and below it for a cut. Nothing for no curve.
 */
const PresetCurveSpark = ({
  curve,
  size,
}: {
  curve: IEqSettings | undefined;
  size: keyof typeof SPARK_BOXES;
}) => {
  const glowId = useId();
  const box = SPARK_BOXES[size];
  const drawing = useMemo(() => {
    if (!curve) {
      return undefined;
    }
    const filters = dspPresetVoicing('spark', curve).apoOverride?.filters ?? {};
    if (Object.keys(filters).length === 0) {
      return undefined;
    }
    const points = getCurvePoints(0, undefined, undefined, filters);
    const reach = points
      .filter((point) => point.x >= LOW_HZ && point.x <= HIGH_HZ)
      .reduce(
        (widest, point) =>
          Math.max(widest, Math.ceil(Math.abs(point.y) / 3) * 3),
        FLOOR_DB,
      );
    const bounds = { min: -reach, max: reach };
    const { path } = makePath(points, box, bounds);
    if (!path) {
      return undefined;
    }
    const zero = curveScales(box, bounds).y(0);
    const { left } = box.padding;
    const right = box.width - box.padding.right;
    return {
      line: path,
      area: `${path} L${right},${zero.toFixed(2)} L${left},${zero.toFixed(2)} Z`,
      zero,
    };
  }, [box, curve]);

  return (
    <svg
      className={`own-preset-spark own-preset-spark--${size}`}
      viewBox={`0 0 ${box.width} ${box.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id={glowId}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1={box.padding.top}
          x2="0"
          y2={box.height - box.padding.bottom}
        >
          <stop offset="0" stopColor="currentColor" stopOpacity="0.34" />
          <stop offset="0.5" stopColor="currentColor" stopOpacity="0.02" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.34" />
        </linearGradient>
      </defs>
      <line
        className="own-preset-spark__zero"
        x1={box.padding.left}
        x2={box.width - box.padding.right}
        y1={drawing?.zero ?? box.height / 2}
        y2={drawing?.zero ?? box.height / 2}
      />
      {drawing && (
        <>
          <path d={drawing.area} fill={`url(#${glowId})`} />
          <path className="own-preset-spark__line" d={drawing.line} />
        </>
      )}
    </svg>
  );
};

export default PresetCurveSpark;
