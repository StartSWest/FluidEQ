/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How wide a scale's figure is drawn, in CSS pixels: the graph's axes set
 * their text at 0.75rem (`Axis.tsx`) in the window's own face, which they
 * take from the stylesheet (`_graphThemeChart.scss`), so the width is read
 * in that font from the document rather than estimated. It decides which
 * frequency names fit along the foot beside the side scales' corner figures
 * (`frequencyLabelTicksFor`), and a guess wrong by a few pixels in one
 * language was the "16k Hz" that ran into "−80 dB".
 *
 * A canvas measures, never draws: the width of a run of text is the same on
 * either path, which is all that is asked of it here.
 */
const AXIS_TEXT_REM = 0.75;

let measurer: CanvasRenderingContext2D | null | undefined;
const widths = new Map<string, number>();

const axisFont = (): string => {
  const root = getComputedStyle(document.documentElement);
  const size = parseFloat(root.fontSize) * AXIS_TEXT_REM;
  return `${size}px ${getComputedStyle(document.body).fontFamily}`;
};

const axisLabelWidth = (text: string): number => {
  measurer ??= document.createElement('canvas').getContext('2d');
  if (!measurer) {
    // No 2D context to measure with: the old estimate, a figure 40px wide.
    return 40;
  }
  const font = axisFont();
  const key = `${font}\u0000${text}`;
  const known = widths.get(key);
  if (known !== undefined) {
    return known;
  }
  measurer.font = font;
  const { width } = measurer.measureText(text);
  widths.set(key, width);
  return width;
};

export default axisLabelWidth;
