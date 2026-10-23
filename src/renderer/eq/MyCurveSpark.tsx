/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useId, useMemo } from 'react';
import { readCurveText } from 'common/myCurves';
import { curveScales, getCurvePoints, makePath } from '../graph/curvePreview';

/** The drawing's box, in its own units: a small screen beside the name. */
export const SPARK_BOX = {
  width: 132,
  height: 40,
  padding: { top: 5, right: 4, bottom: 5, left: 4 },
};

/**
 * The least the scale reaches either side of 0 dB. Under it a gentle curve
 * of two or three decibels drew as a flat line; over it, the scale widens to
 * whatever the curve itself reaches, in 3 dB steps, so no curve runs off the
 * box.
 */
const SPARK_FLOOR_DB = 6;

/** The audible span the drawing covers, as every curve preview does. */
const LOW_HZ = 20;
const HIGH_HZ = 20000;

/**
 * A curve's shape at a glance, on a row of My curves or of an import: its
 * response from 20 Hz to 20 kHz around a dashed 0 dB line, with a soft glow
 * between the two.
 *
 * Drawn without the preamp, which moves a whole curve up or down and says
 * nothing about its shape. With it, and on a fixed ±12 dB, a correction at
 * -9.9 dB sank ten decibels and ran out of the bottom of the box (Ivan,
 * 2026-10-20: "not good").
 */
export default function MyCurveSpark({ text }: { text: string }) {
  const glowId = useId();
  const drawing = useMemo(() => {
    const parsed = readCurveText(text);
    if (!parsed) {
      return undefined;
    }
    const points = getCurvePoints(
      0,
      parsed.eqFormat,
      parsed.graphicEq,
      parsed.filters,
    );
    const reach = points
      .filter((point) => point.x >= LOW_HZ && point.x <= HIGH_HZ)
      .reduce(
        (widest, point) =>
          Math.max(widest, Math.ceil(Math.abs(point.y) / 3) * 3),
        SPARK_FLOOR_DB,
      );
    const bounds = { min: -reach, max: reach };
    const { path } = makePath(points, SPARK_BOX, bounds);
    if (!path) {
      return undefined;
    }
    const zero = curveScales(SPARK_BOX, bounds).y(0);
    const { left } = SPARK_BOX.padding;
    const right = SPARK_BOX.width - SPARK_BOX.padding.right;
    return {
      line: path,
      // The same line closed along 0 dB: what the glow fills.
      area: `${path} L${right},${zero.toFixed(2)} L${left},${zero.toFixed(2)} Z`,
      zero,
    };
  }, [text]);

  return (
    <svg
      className="my-curve__spark"
      viewBox={`0 0 ${SPARK_BOX.width} ${SPARK_BOX.height}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Brightest at the box's edges and gone at 0 dB, so a boost glows
            above the line and a cut below it, each fading toward flat. */}
        <linearGradient
          id={glowId}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1={SPARK_BOX.padding.top}
          x2="0"
          y2={SPARK_BOX.height - SPARK_BOX.padding.bottom}
        >
          <stop offset="0" stopColor="currentColor" stopOpacity="0.38" />
          <stop offset="0.5" stopColor="currentColor" stopOpacity="0.02" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.38" />
        </linearGradient>
      </defs>
      {drawing && (
        <>
          <line
            className="my-curve__zero"
            x1={SPARK_BOX.padding.left}
            x2={SPARK_BOX.width - SPARK_BOX.padding.right}
            y1={drawing.zero}
            y2={drawing.zero}
          />
          <path
            className="my-curve__glow"
            d={drawing.area}
            fill={`url(#${glowId})`}
          />
          <path className="my-curve__line" d={drawing.line} />
        </>
      )}
    </svg>
  );
}
