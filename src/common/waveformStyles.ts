/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * Ten ways to draw the same measurements.
 *
 * EVERY ONE IS A PATH, including the ones that look like bars or dots. That is
 * the whole design: a bar chart drawn as ninety-six rectangles is ninety-six
 * elements to create when the style is chosen and destroy when it is left, and
 * cycling through the styles would churn the DOM every time. Drawn as
 * subpaths, the picture changes while the element count never does — there is
 * nothing to clean up because nothing was ever added.
 *
 * The shapes are pure functions of the samples, so they can be tested without
 * a browser and reasoned about without one.
 */

export type WaveformStyle =
  | 'line'
  | 'filled'
  | 'bars'
  | 'mirror-bars'
  | 'dots'
  | 'ribbon'
  | 'spikes'
  | 'blocks'
  | 'outline'
  | 'lattice';

/** In cycle order, which is the order clicking walks them. */
export const WAVEFORM_STYLES: WaveformStyle[] = [
  'line',
  'filled',
  'bars',
  'mirror-bars',
  'dots',
  'ribbon',
  'spikes',
  'blocks',
  'outline',
  'lattice',
];

export const nextWaveformStyle = (style: WaveformStyle): WaveformStyle => {
  const index = WAVEFORM_STYLES.indexOf(style);
  // An unknown value — a stored style from a build that had different ones —
  // starts the cycle again rather than getting stuck outside it.
  return WAVEFORM_STYLES[(index + 1) % WAVEFORM_STYLES.length] ?? 'line';
};

/**
 * The three paths every style produces.
 *
 * Not every style uses all three; an unused one is an empty string, which
 * draws nothing and costs nothing. Keeping the shape of the result constant is
 * what lets the same three elements serve all ten.
 */
export interface IWaveformShape {
  /** The stroked figure. */
  line: string;
  /** A second stroked figure, for styles built from two halves. */
  mirror: string;
  /** The closed figure, for styles that are filled. */
  fill: string;
}

const EMPTY: IWaveformShape = { line: '', mirror: '', fill: '' };

/** A rectangle as a subpath, which is how the bar styles stay paths. */
const rect = (x: number, y: number, width: number, height: number) =>
  `M ${x.toFixed(1)},${y.toFixed(1)} h ${width.toFixed(1)} v ${height.toFixed(
    1,
  )} h ${(-width).toFixed(1)} Z`;

export const createWaveformShape = (
  samples: readonly number[],
  style: WaveformStyle,
  width: number,
  height: number,
  amplitude: number,
): IWaveformShape => {
  if (samples.length < 2) {
    return EMPTY;
  }
  const centre = height / 2;
  const step = width / (samples.length - 1);
  const at = (index: number) => samples[index] * amplitude;

  switch (style) {
    // The original: two mirrored strokes around a filled body.
    case 'line':
    case 'filled':
    case 'ribbon': {
      const upper: string[] = [];
      const lower: string[] = [];
      for (let index = 0; index < samples.length; index += 1) {
        const x = (index * step).toFixed(1);
        const offset = at(index);
        upper.push(`${x},${(centre - offset).toFixed(1)}`);
        lower.push(`${x},${(centre + offset).toFixed(1)}`);
      }
      const line = `M ${upper.join(' L ')}`;
      const mirror = `M ${lower.join(' L ')}`;
      const fill = `${line} L ${[...lower].reverse().join(' L ')} Z`;
      // Ribbon is the body with no edge; filled keeps both.
      if (style === 'ribbon') {
        return { line: '', mirror: '', fill };
      }
      if (style === 'filled') {
        return { line, mirror, fill };
      }
      return { line, mirror, fill: '' };
    }

    // Bars rising from the floor, the way a level meter reads.
    case 'bars': {
      const barWidth = Math.max(1, step * 0.6);
      let fill = '';
      for (let index = 0; index < samples.length; index += 1) {
        const magnitude = Math.abs(at(index)) * 2;
        fill += rect(
          index * step - barWidth / 2,
          height - magnitude,
          barWidth,
          magnitude,
        );
      }
      return { line: '', mirror: '', fill };
    }

    // The same, but growing both ways from the middle.
    case 'mirror-bars': {
      const barWidth = Math.max(1, step * 0.6);
      let fill = '';
      for (let index = 0; index < samples.length; index += 1) {
        const magnitude = Math.abs(at(index));
        fill += rect(
          index * step - barWidth / 2,
          centre - magnitude,
          barWidth,
          magnitude * 2,
        );
      }
      return { line: '', mirror: '', fill };
    }

    // A dot riding each peak, above and below.
    case 'dots': {
      const size = Math.max(1.4, step * 0.42);
      let fill = '';
      for (let index = 0; index < samples.length; index += 1) {
        const offset = Math.abs(at(index));
        const x = index * step - size / 2;
        fill += rect(x, centre - offset - size / 2, size, size);
        fill += rect(x, centre + offset - size / 2, size, size);
      }
      return { line: '', mirror: '', fill };
    }

    // Sharp triangles: every sample a peak with straight sides.
    case 'spikes': {
      let fill = '';
      for (let index = 0; index < samples.length; index += 1) {
        const magnitude = Math.abs(at(index));
        const x = index * step;
        const half = step * 0.5;
        fill += `M ${(x - half).toFixed(1)},${centre.toFixed(1)} L ${x.toFixed(
          1,
        )},${(centre - magnitude).toFixed(1)} L ${(x + half).toFixed(
          1,
        )},${centre.toFixed(1)} L ${x.toFixed(1)},${(
          centre + magnitude
        ).toFixed(1)} Z`;
      }
      return { line: '', mirror: '', fill };
    }

    // Stacked segments, lit up to the level — an LED ladder.
    case 'blocks': {
      const barWidth = Math.max(1, step * 0.62);
      const segment = Math.max(2, height / 9);
      let fill = '';
      for (let index = 0; index < samples.length; index += 1) {
        const magnitude = Math.abs(at(index)) * 2;
        const lit = Math.floor(magnitude / segment);
        for (let level = 0; level < lit; level += 1) {
          fill += rect(
            index * step - barWidth / 2,
            height - (level + 1) * segment + 1,
            barWidth,
            segment - 2,
          );
        }
      }
      return { line: '', mirror: '', fill };
    }

    // The top edge alone, like a horizon.
    case 'outline': {
      const points: string[] = [];
      for (let index = 0; index < samples.length; index += 1) {
        points.push(
          `${(index * step).toFixed(1)},${(
            centre - Math.abs(at(index))
          ).toFixed(1)}`,
        );
      }
      return { line: `M ${points.join(' L ')}`, mirror: '', fill: '' };
    }

    // Verticals from the centre to each peak: a comb rather than a curve.
    case 'lattice': {
      let line = '';
      for (let index = 0; index < samples.length; index += 1) {
        const magnitude = Math.abs(at(index));
        const x = (index * step).toFixed(1);
        line += `M ${x},${(centre - magnitude).toFixed(1)} L ${x},${(
          centre + magnitude
        ).toFixed(1)} `;
      }
      return { line: line.trim(), mirror: '', fill: '' };
    }

    default:
      return EMPTY;
  }
};
