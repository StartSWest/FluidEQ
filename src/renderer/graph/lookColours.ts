import {
  DEFAULT_LEVEL_COLOURS,
  DEFAULT_SIGNAL_COLOUR,
} from 'common/customLooks';
import type { GraphPalette } from 'common/graphStyles';
import { BAND_SPECTRUM_HEX } from '../utils/bandColors';
import type { SpectrumBarPaint } from '../waveformPaint';

type Rgb = readonly [number, number, number];

const readHex = (colour: string): Rgb => {
  const digits = colour.slice(1);
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : digits;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
};

const sampleRamp = (ramp: readonly Rgb[], level: number): Rgb => {
  const at = Math.max(0, Math.min(1, level)) * (ramp.length - 1);
  const from = ramp[Math.floor(at)];
  const to = ramp[Math.min(ramp.length - 1, Math.floor(at) + 1)];
  const blend = at - Math.floor(at);
  return [
    Math.round(from[0] + (to[0] - from[0]) * blend),
    Math.round(from[1] + (to[1] - from[1]) * blend),
    Math.round(from[2] + (to[2] - from[2]) * blend),
  ];
};

export const heatColour = (
  colours: readonly string[],
  level: number,
): string => {
  // Nearest-stop selection made Heat jump between swatches on small level
  // changes. Interpolate the user's colours for both whole figures and bars.
  const ramp = (colours.length ? colours : DEFAULT_LEVEL_COLOURS).map(readHex);
  return `rgb(${sampleRamp(ramp, level).join(', ')})`;
};

export const createFluidBarPaint = (
  context: CanvasRenderingContext2D,
  palette: GraphPalette,
  colours: readonly string[],
  top: number,
  bottom: number,
): SpectrumBarPaint => {
  const defaults = {
    signal: [DEFAULT_SIGNAL_COLOUR],
    rainbow: BAND_SPECTRUM_HEX,
    level: DEFAULT_LEVEL_COLOURS,
    heat: DEFAULT_LEVEL_COLOURS,
    // Never reached: auto is resolved to a form's own palette before paint.
    auto: [DEFAULT_SIGNAL_COLOUR],
  };
  const ramp = (colours.length ? colours : defaults[palette]).map(readHex);
  return (across, energy, y, height, topAlpha) => {
    const gradient = context.createLinearGradient(0, y, 0, y + height);
    // Combining colour and alpha in this bar's gradient avoids erasing a
    // previously drawn mirror, as destination-out did on the shared canvas.
    const divisions = palette === 'level' ? 16 : 1;
    for (let index = 0; index <= divisions; index += 1) {
      const fraction = index / divisions;
      let position = 0;
      if (palette === 'heat') {
        position = energy;
      } else if (palette === 'rainbow') {
        position = across;
      } else if (palette === 'level') {
        position = (bottom - y - fraction * height) / Math.max(1, bottom - top);
      }
      const rgb = sampleRamp(ramp, position);
      const alpha = topAlpha + (0.06 - topAlpha) * fraction;
      gradient.addColorStop(fraction, `rgba(${rgb.join(', ')}, ${alpha})`);
    }
    return gradient;
  };
};
