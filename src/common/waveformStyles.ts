/*
<FluidEQ: System-wide parametric audio equalizer interface>
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
  | 'lattice'
  | 'fluid';

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
  'fluid',
];

export const nextWaveformStyle = (style: WaveformStyle): WaveformStyle => {
  const index = WAVEFORM_STYLES.indexOf(style);
  // An unknown value — a stored style from a build that had different ones —
  // starts the cycle again rather than getting stuck outside it.
  return WAVEFORM_STYLES[(index + 1) % WAVEFORM_STYLES.length] ?? 'line';
};

/**
 * The previous style in the cycle — reached with Ctrl+click, so somebody
 * who went one too far can walk back without cycling the whole way round.
 * Unknown value resolves to the last style rather than the first, so the
 * pair with `nextWaveformStyle` stays symmetric.
 */
export const previousWaveformStyle = (style: WaveformStyle): WaveformStyle => {
  const index = WAVEFORM_STYLES.indexOf(style);
  if (index < 0) {
    return WAVEFORM_STYLES[WAVEFORM_STYLES.length - 1] ?? 'line';
  }
  const previous =
    (index - 1 + WAVEFORM_STYLES.length) % WAVEFORM_STYLES.length;
  return WAVEFORM_STYLES[previous] ?? 'line';
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

/**
 * A circle as a subpath: two half-turn arcs back to the start.
 *
 * `Path2D` has an `arc()` method, but every shape in this file is SVG
 * path data — that is what the whole module returns and what the renderer
 * bakes through its projection matrix — so a circle has to be expressible
 * in `d` syntax like everything else. Two `a` commands sweeping 180° each
 * is the standard way to write one.
 */
const circle = (cx: number, cy: number, r: number) => {
  const radius = r.toFixed(2);
  const diameter = (r * 2).toFixed(2);
  return `M ${(cx - r).toFixed(2)},${cy.toFixed(2)} a ${radius},${radius} 0 1,0 ${diameter},0 a ${radius},${radius} 0 1,0 -${diameter},0 Z`;
};

/** A magnitude fraction, guarded so a bad band cannot leave the box. */
const bandHeight = (value: number, height: number) =>
  Math.max(0, Math.min(1, value)) * height;

/**
 * A smooth curve through a list of points, as quadratic Beziers between
 * their midpoints — each point becomes the control point of a segment
 * whose endpoints are the midpoints to its neighbours, so the curve
 * visits those midpoints and the polyline's per-point corners round away.
 *
 * Shared by every style that draws a continuous figure over discrete
 * readings, which is how the spectrum's own wave is built.
 */
const smoothCurve = (points: readonly [number, number][]) => {
  if (points.length < 2) {
    return '';
  }
  const [firstX, firstY] = points[0];
  if (points.length < 3) {
    const [lastX, lastY] = points[points.length - 1];
    return `M ${firstX.toFixed(1)},${firstY.toFixed(1)} L ${lastX.toFixed(1)},${lastY.toFixed(1)}`;
  }
  let d = `M ${firstX.toFixed(1)},${firstY.toFixed(1)}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const [px, py] = points[index];
    const [nx, ny] = points[index + 1];
    const midX = (px + nx) / 2;
    const midY = (py + ny) / 2;
    d += ` Q ${px.toFixed(1)},${py.toFixed(1)} ${midX.toFixed(1)},${midY.toFixed(1)}`;
  }
  const [lastX, lastY] = points[points.length - 1];
  d += ` L ${lastX.toFixed(1)},${lastY.toFixed(1)}`;
  return d;
};

/**
 * The optional freq-domain magnitudes the `spectrum` style consumes for its
 * bars, as fractions in [0, 1]. Kept separate from `samples` because the
 * spectrum's bars are a real frequency reading and the wave over them is
 * the time-domain waveform — two independent readings of the same sound,
 * where every other style draws from `samples` alone.
 */
export const createWaveformShape = (
  samples: readonly number[],
  style: WaveformStyle,
  width: number,
  height: number,
  amplitude: number,
  spectrumMagnitudes?: readonly number[],
): IWaveformShape => {
  if (samples.length < 2) {
    return EMPTY;
  }
  const centre = height / 2;
  const step = width / (samples.length - 1);
  const at = (index: number) => samples[index] * amplitude;

  switch (style) {
    // Two mirrored curves around a filled body. Smoothed through the
    // sample midpoints rather than joined corner to corner: at this
    // pane's width there are several samples per pixel column, and a
    // polyline through them reads as a rasp of hard little angles where
    // the sound is a continuous thing. The curve is the same reading,
    // drawn as what it is.
    case 'line':
    case 'filled':
    case 'ribbon': {
      const upper: [number, number][] = [];
      const lower: [number, number][] = [];
      for (let index = 0; index < samples.length; index += 1) {
        const x = index * step;
        const offset = at(index);
        upper.push([x, centre - offset]);
        lower.push([x, centre + offset]);
      }
      const line = smoothCurve(upper);
      const mirror = smoothCurve(lower);
      // Closed by walking the lower edge back the way it came, so the
      // body is bounded by the same two curves that are stroked over it
      // and no seam can open between fill and edge.
      const lowerBack = smoothCurve([...lower].reverse());
      const fill = `${line} L ${lowerBack.slice(2)} Z`;
      // Ribbon is the body with no edge; filled keeps both.
      if (style === 'ribbon') {
        return { line: '', mirror: '', fill };
      }
      if (style === 'filled') {
        return { line, mirror, fill };
      }
      return { line, mirror, fill: '' };
    }

    // Bars rising from the floor, one per frequency band — a real
    // spectrum when the caller passes the FFT magnitudes in, and a
    // fallback to the time-domain envelope of the samples otherwise so
    // the style still draws when there is no analyser hooked up. Using
    // the freq bands makes the name honest: `bars` reads what somebody
    // seeing a bar-per-band expects.
    case 'bars': {
      const bandCount = spectrumMagnitudes?.length ?? 0;
      let fill = '';
      if (bandCount >= 2) {
        const barStep = width / bandCount;
        const barWidth = Math.max(1, barStep * 0.6);
        for (let index = 0; index < bandCount; index += 1) {
          const magnitude =
            Math.max(0, Math.min(1, spectrumMagnitudes![index])) * height;
          fill += rect(
            index * barStep + (barStep - barWidth) / 2,
            height - magnitude,
            barWidth,
            magnitude,
          );
        }
      } else {
        const barWidth = Math.max(1, step * 0.6);
        for (let index = 0; index < samples.length; index += 1) {
          const magnitude = Math.abs(at(index)) * 2;
          fill += rect(
            index * step - barWidth / 2,
            height - magnitude,
            barWidth,
            magnitude,
          );
        }
      }
      return { line: '', mirror: '', fill };
    }

    // The same spectrum, growing both ways from the middle rather than
    // from the floor — a mirrored bar chart of the FFT bands.
    case 'mirror-bars': {
      const bandCount = spectrumMagnitudes?.length ?? 0;
      let fill = '';
      if (bandCount >= 2) {
        const barStep = width / bandCount;
        const barWidth = Math.max(1, barStep * 0.6);
        for (let index = 0; index < bandCount; index += 1) {
          const magnitude =
            Math.max(0, Math.min(1, spectrumMagnitudes![index])) * (height / 2);
          fill += rect(
            index * barStep + (barStep - barWidth) / 2,
            centre - magnitude,
            barWidth,
            magnitude * 2,
          );
        }
      } else {
        const barWidth = Math.max(1, step * 0.6);
        for (let index = 0; index < samples.length; index += 1) {
          const magnitude = Math.abs(at(index));
          fill += rect(
            index * step - barWidth / 2,
            centre - magnitude,
            barWidth,
            magnitude * 2,
          );
        }
      }
      return { line: '', mirror: '', fill };
    }

    // A dot-matrix: a column of round beads per band, lit from the
    // centre line outward to that band's peak and mirrored above and
    // below it.
    //
    // It used to be two squares per column riding the peak, which read
    // as a dashed outline of the wave rather than as dots — the shape
    // was carried by where the marks were, so the eye followed the gap
    // between them instead of the marks themselves. Lighting the whole
    // column up to the peak makes the mark itself the reading, the way
    // an LED ladder does, and the density then says loudness on its own.
    //
    // The samples are bucketed down to about forty columns so the beads
    // have room to be round; each column takes the loudest sample in its
    // bucket, so a transient still lifts the column it landed in rather
    // than being averaged away.
    case 'dots': {
      const bands = spectrumMagnitudes ?? [];
      if (bands.length >= 2) {
        // A bead column per frequency band, lit from the floor up — the
        // same reading the bars give, in a dot matrix. Standing on the
        // floor rather than growing from a centre line, because that is
        // what a spectrum does and it is what makes this read as the
        // same instrument as the bars beside it in the cycle.
        const bandStep = width / bands.length;
        const radius = Math.max(1, Math.min(bandStep * 0.3, 2.6));
        const pitch = radius * 2.7;
        let fill = '';
        for (let index = 0; index < bands.length; index += 1) {
          const magnitude = bandHeight(bands[index], height);
          const cx = (index + 0.5) * bandStep;
          const lit = Math.floor(magnitude / pitch);
          // The bottom bead is always drawn, so silence is a row of
          // beads at rest rather than an empty pane.
          for (let level = 0; level <= lit; level += 1) {
            fill += circle(cx, height - radius - level * pitch, radius);
          }
        }
        return { line: '', mirror: '', fill };
      }
      const targetColumns = 40;
      const stride = Math.max(1, Math.floor(samples.length / targetColumns));
      const columnStep = step * stride;
      // Round, and small enough that neighbouring columns keep a gap:
      // beads that touch read as a solid bar and the style stops being
      // dots at all.
      const radius = Math.max(1, Math.min(columnStep * 0.28, 2.6));
      // Pitch is what makes the column read as separate beads rather
      // than as a dotted line — a little over a diameter, so there is
      // always dark between one and the next.
      const pitch = radius * 2.7;
      let fill = '';
      for (let start = 0; start < samples.length; start += stride) {
        const end = Math.min(samples.length, start + stride);
        let peak = 0;
        for (let index = start; index < end; index += 1) {
          const magnitude = Math.abs(at(index));
          if (magnitude > peak) {
            peak = magnitude;
          }
        }
        const cx = ((start + end - 1) / 2) * step;
        const lit = Math.floor(peak / pitch);
        // Level zero sits on the centre line and is always drawn, so a
        // silent pane is a row of beads at rest rather than nothing at
        // all — the meter reads as present and quiet, not as switched
        // off. Every level above it is mirrored.
        fill += circle(cx, centre, radius);
        for (let level = 1; level <= lit; level += 1) {
          const offset = level * pitch;
          fill += circle(cx, centre - offset, radius);
          fill += circle(cx, centre + offset, radius);
        }
      }
      return { line: '', mirror: '', fill };
    }

    // A blade per frequency band, standing on the floor — the spectrum
    // read as a row of peaks rather than as a row of bars. Falls back to
    // the old time-domain diamonds when no analyser is hooked up.
    case 'spikes': {
      const bands = spectrumMagnitudes ?? [];
      let fill = '';
      if (bands.length >= 2) {
        const bandStep = width / bands.length;
        // Just under half the band either side, so neighbouring blades
        // meet at their feet without overlapping into each other.
        const half = bandStep * 0.46;
        for (let index = 0; index < bands.length; index += 1) {
          const magnitude = bandHeight(bands[index], height);
          const cx = (index + 0.5) * bandStep;
          fill += `M ${(cx - half).toFixed(1)},${height.toFixed(1)} L ${cx.toFixed(1)},${(height - magnitude).toFixed(1)} L ${(cx + half).toFixed(1)},${height.toFixed(1)} Z`;
        }
        return { line: '', mirror: '', fill };
      }
      for (let index = 0; index < samples.length; index += 1) {
        const magnitude = Math.abs(at(index));
        const x = index * step;
        const halfStep = step * 0.5;
        fill += `M ${(x - halfStep).toFixed(1)},${centre.toFixed(1)} L ${x.toFixed(
          1,
        )},${(centre - magnitude).toFixed(1)} L ${(x + halfStep).toFixed(
          1,
        )},${centre.toFixed(1)} L ${x.toFixed(1)},${(
          centre + magnitude
        ).toFixed(1)} Z`;
      }
      return { line: '', mirror: '', fill };
    }

    // An LED ladder per frequency band: stacked segments lit up to that
    // band's level. Eight rungs rather than six — a real spectrum has
    // enough columns that the ladder reads as a matrix, and at eight the
    // rungs are still about seven pixels on this pane. Falls back to the
    // time-domain envelope when no analyser is hooked up.
    case 'blocks': {
      const bands = spectrumMagnitudes ?? [];
      let fill = '';
      if (bands.length >= 2) {
        const bandStep = width / bands.length;
        const barWidth = Math.max(1, bandStep * 0.66);
        const segment = Math.max(3, height / 8);
        for (let index = 0; index < bands.length; index += 1) {
          const magnitude = bandHeight(bands[index], height);
          // Always at least the bottom rung, so a quiet band reads as a
          // band at rest rather than as a hole in the ladder.
          const lit = Math.max(1, Math.floor(magnitude / segment));
          for (let level = 0; level < lit; level += 1) {
            fill += rect(
              index * bandStep + (bandStep - barWidth) / 2,
              height - (level + 1) * segment + 1,
              barWidth,
              segment - 2,
            );
          }
        }
        return { line: '', mirror: '', fill };
      }
      const barWidth = Math.max(1, step * 0.62);
      const segment = Math.max(3, height / 6);
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

    // A single smooth line pinned to the 0 dB baseline — the same signed
    // samples the `line` style draws, but as a continuous curve rather
    // than a polyline and without a mirror underneath. Quadratic Beziers
    // through the sample midpoints round the corners: each sample is the
    // control point of a segment whose endpoints are the midpoints to
    // its neighbours, so the curve visits those midpoints and the
    // polyline's per-sample corners disappear.
    case 'outline': {
      const bands = spectrumMagnitudes ?? [];
      if (bands.length >= 2) {
        // The spectrum's own silhouette: one smooth curve riding the top
        // of every band, with nothing under it. The same figure the
        // bars draw, stated as a line — which is what makes it read as a
        // frequency response rather than as a waveform, and puts it in
        // the same family as the spectrum and bars either side of it.
        const bandStep = width / bands.length;
        const points: [number, number][] = [];
        for (let index = 0; index < bands.length; index += 1) {
          points.push([
            (index + 0.5) * bandStep,
            height - bandHeight(bands[index], height),
          ]);
        }
        return { line: smoothCurve(points), mirror: '', fill: '' };
      }
      const points: [number, number][] = [];
      for (let index = 0; index < samples.length; index += 1) {
        points.push([index * step, centre - at(index)]);
      }
      return { line: smoothCurve(points), mirror: '', fill: '' };
    }

    // A comb of verticals, one per frequency band, standing on the floor
    // — the spectrum drawn as lines rather than as bars. Falls back to
    // centre-out verticals over the samples when no analyser is running.
    case 'lattice': {
      const bands = spectrumMagnitudes ?? [];
      let line = '';
      if (bands.length >= 2) {
        const bandStep = width / bands.length;
        for (let index = 0; index < bands.length; index += 1) {
          const magnitude = bandHeight(bands[index], height);
          const x = ((index + 0.5) * bandStep).toFixed(1);
          line += `M ${x},${height.toFixed(1)} L ${x},${(height - magnitude).toFixed(1)} `;
        }
        return { line: line.trim(), mirror: '', fill: '' };
      }
      for (let index = 0; index < samples.length; index += 1) {
        const magnitude = Math.abs(at(index));
        const x = (index * step).toFixed(1);
        line += `M ${x},${(centre - magnitude).toFixed(1)} L ${x},${(
          centre + magnitude
        ).toFixed(1)} `;
      }
      return { line: line.trim(), mirror: '', fill: '' };
    }

    // A single smooth waveform curve — the top half only, not mirrored —
    // over spectrum bars drawn imperatively by the renderer with per-bar
    // gradients that a single shared fillStyle cannot express. The
    // renderer paints the bars directly and this returns only the curve,
    // so the shape stays a value even though the drawing does not. The
    // curve is smoothed with quadratic Beziers through the sample
    // midpoints: each sample is the control point of a quadratic segment
    // whose endpoints are the midpoints to its neighbours, so the curve
    // passes through those midpoints, and every corner the polyline had
    // is rounded away.
    //
    // The site's `Math.sin(Math.PI * x) ** 0.7` envelope is applied to the
    // sample amplitude so the wave arches — tallest in the middle, tapered
    // at the edges — the way the nav-signal wave does. Applied here rather
    // than in the renderer so the shape carries the whole geometry.
    case 'fluid': {
      // Only the trace is a path. The bars behind it are painted in the
      // renderer, because a shared Path2D cannot carry a gradient per bar
      // and that gradient is what the form is for.
      const lastIndex = Math.max(1, samples.length - 1);
      const points: [number, number][] = [];
      for (let index = 0; index < samples.length; index += 1) {
        const x = index / lastIndex;
        const envelope = Math.sin(Math.PI * x) ** 0.7;
        points.push([index * step, centre - at(index) * envelope]);
      }
      return { line: smoothCurve(points), mirror: '', fill: '' };
    }

    default:
      return EMPTY;
  }
};
