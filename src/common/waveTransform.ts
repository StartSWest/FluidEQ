/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** What decides where a live curve stands: the graph's View menu. */
export interface IWaveShape {
  isFlipped?: boolean;
  isHalfHeight?: boolean;
  isFromCentre?: boolean;
  heightScale?: number;
  verticalPosition?: number;
}

/**
 * Which way up a live curve is drawn, as a translate and a vertical scale.
 *
 * Mirrored as a drawing, not as data.
 *
 * Negating the gain was the first attempt and it gives the *negative* of the
 * wave: every style draws upward from a baseline at the bottom of the plot, so
 * a negated value makes a tall bar short rather than making it hang. The shape
 * inverts instead of the picture.
 *
 * Reflecting the rendered geometry about the plot keeps the shape exactly and
 * turns it upside down, which is what hanging from the ceiling means. Translate
 * then scale, because a bare flip would send it off the top of the viewport.
 *
 * Half height anchors at the middle instead of at an edge, so the two copies of
 * a mirrored wave grow away from each other rather than both taking the whole
 * plot and crossing through one another.
 */
export interface IWaveTransform {
  translateY: number;
  scaleY: number;
}

export const getWaveTransform = (
  curve: IWaveShape,
  plotBottom: number,
  plotTop = 0,
): IWaveTransform => {
  /**
   * Height and position are separate on purpose. The three-stop control this
   * replaces coupled a half-height drawing to an edge-to-edge plot, which made
   * a short centred wave impossible. Height scales around the baseline; the
   * position then moves that baseline from its edge to the middle.
   *
   * Values are clamped here as well as in the settings store because this is a
   * rendering boundary. A custom caller or stale stored value must not hand
   * canvas a negative or non-finite transform and make the last valid frame
   * remain frozen on screen.
   */
  const requestedScale = curve.heightScale ?? 1;
  const scale = Number.isFinite(requestedScale)
    ? Math.max(0, Math.min(1, requestedScale))
    : 1;
  const requestedPosition = curve.verticalPosition ?? 0;
  const position = Number.isFinite(requestedPosition)
    ? Math.max(0, Math.min(1, requestedPosition))
    : 0;
  const depth = Math.max(0, plotBottom - plotTop);
  const centre = plotTop + depth / 2;

  if (!curve.isFlipped && !curve.isHalfHeight) {
    // Standing up: the baseline walks from the bottom to the centre. Its
    // maximum available height follows it, so 100% always reaches the opposite
    // plot edge rather than being clipped when the baseline moves.
    const baseline = plotBottom - (position * depth) / 2;
    const available = Math.max(0, baseline - plotTop);
    const placedScale = scale * (available / Math.max(1, depth));
    return {
      translateY: baseline - placedScale * plotBottom,
      scaleY: placedScale,
    };
  }
  if (!curve.isHalfHeight) {
    // Hanging down makes the symmetric move from the top to the centre.
    const baseline = plotTop + (position * depth) / 2;
    const available = Math.max(0, plotBottom - baseline);
    const placedScale = scale * (available / Math.max(1, depth));
    return {
      translateY: baseline + placedScale * plotBottom,
      scaleY: -placedScale,
    };
  }
  if (curve.isFromCentre) {
    // Baseline at the middle, peaks reaching the edges. The upper copy is a
    // plain half-scale — its baseline already lands on the centre line — and
    // the lower one is that reflected about the bottom. Both scale about the
    // centre, which is the row they share.
    return curve.isFlipped
      ? {
          translateY: centre - (scale * plotBottom) / 2,
          scaleY: 0.5 * scale,
        }
      : {
          translateY: centre + (scale * plotBottom) / 2,
          scaleY: -0.5 * scale,
        };
  }
  // Baselines start at the two edges and walk toward each other. At the centre
  // this becomes the familiar two-sided wave without making the position
  // slider silently stop at the mirrored orientation.
  return curve.isFlipped
    ? {
        translateY: plotTop + (position * depth) / 2 + (scale * plotBottom) / 2,
        scaleY: -0.5 * scale,
      }
    : {
        translateY:
          plotBottom - (position * depth) / 2 - (scale * plotBottom) / 2,
        scaleY: 0.5 * scale,
      };
};
