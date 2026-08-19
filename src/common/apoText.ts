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
 * Reading Equalizer APO's ParametricEQ text back in.
 *
 * The existing AutoEQ reader only understands the three shapes AutoEQ emits
 * (PK, LS, HS). This one understands everything FluidEQ itself writes, which
 * matters twice over: importing a config the user exported from somewhere else,
 * and reading back a config FluidEQ produced. A parser that silently dropped
 * the pass and notch bands would quietly flatten half of an imported EQ.
 *
 * Deliberately lenient about everything it does not recognise. APO configs
 * routinely carry Device/Channel/Include/Copy lines and comments, and a file
 * being partly about something else is no reason to refuse the parts that are
 * about the EQ.
 */

import {
  AutoEqFormat,
  clampFrequency,
  clampGain,
  clampQuality,
  FilterTypeEnum,
  getDefaultFilterWithId,
  IFiltersMap,
  IGraphicEqPoint,
  MAX_FREQUENCY,
  MAX_NUM_FILTERS,
  MIN_FREQUENCY,
} from './constants';

/**
 * `Filter [n]: ON TYPE Fc x Hz [Gain y dB] [Q z]`.
 *
 * The index is optional because APO's own parser discards it — everything
 * before the colon is a label — and OPRA emits `Filter: ON PK …` with no number
 * at all where Squig.link emits `Filter 2: ON PK …`. Requiring it made every
 * OPRA-shaped paste import as a preamp and no bands: `hasPreAmp` kept `isEmpty`
 * false, so the import reported success and drew a flat curve. Order here comes
 * from the order the lines arrive, never from the number, so nothing downstream
 * misses it.
 *
 * Gain and Q are both optional because APO's grammar makes them so: the pass
 * and notch forms have no Gain token at all, and a fixed-band file may omit Q.
 * `BW Oct` is accepted in place of Q so Peace-style exports are not rejected
 * outright — the bandwidth is converted below.
 */
const FILTER_LINE =
  /^Filter(?:\s+\d+)?\s*:\s*(ON|OFF)\s+([A-Z]+)\s+Fc\s+(-?[\d.]+)\s*Hz(?:\s+Gain\s+(-?[\d.]+)\s*dB)?(?:\s+(?:Q\s+([\d.]+)|BW\s+Oct\s+([\d.]+)))?\s*$/i;

// The unit is optional. Equalizer APO writes `Preamp: -6.5 dB` and so does
// every exporter that copied it, but a bare number is a preamp line that a
// person plainly meant — and requiring `dB` did not reject it, it silently read
// 0 and reported a successful import. Losing 19 dB of attenuation without a
// word is the worst of the three possible outcomes.
const PREAMP_LINE = /^Preamp\s*:\s*(-?[\d.]+)\s*(?:dB)?\s*$/i;
const GRAPHIC_LINE = /^GraphicEQ\s*:\s*(.+)$/i;
const GRAPHIC_POINT = /^([\d.]+)\s+(-?[\d.]+)$/;
const CONVOLUTION_LINE = /^Convolution\s*:\s*(.+?)\s*$/i;

/**
 * APO filter keywords mapped onto the eight types FluidEQ can edit.
 *
 * The aliases matter: APO accepts LS and LSC for the same shelf, and a file
 * written by another tool will use whichever its author preferred. Anything
 * absent here (the Butterworth and Linkwitz-Riley pass forms) is a band
 * FluidEQ has no editor for, so it is dropped rather than mangled into the
 * nearest thing — see `unsupported` in the result.
 */
const TYPE_ALIASES: Record<string, FilterTypeEnum> = {
  PK: FilterTypeEnum.PK,
  PEQ: FilterTypeEnum.PK,
  MODAL: FilterTypeEnum.PK,
  LS: FilterTypeEnum.LSC,
  LSC: FilterTypeEnum.LSC,
  LSQ: FilterTypeEnum.LSC,
  HS: FilterTypeEnum.HSC,
  HSC: FilterTypeEnum.HSC,
  HSQ: FilterTypeEnum.HSC,
  LP: FilterTypeEnum.LPQ,
  LPQ: FilterTypeEnum.LPQ,
  HP: FilterTypeEnum.HPQ,
  HPQ: FilterTypeEnum.HPQ,
  BP: FilterTypeEnum.BP,
  NO: FilterTypeEnum.NO,
  NOTCH: FilterTypeEnum.NO,
  AP: FilterTypeEnum.AP,
};

/**
 * Bandwidth in octaves to Q, per the RBJ cookbook.
 *
 * Peace and a few AutoEQ exports state bandwidth instead of Q. Reading it as a
 * Q directly would be wrong by roughly a factor of two at typical values.
 */
const bandwidthToQ = (octaves: number) => {
  if (!Number.isFinite(octaves) || octaves <= 0) {
    return 1;
  }
  const factor = 2 ** (octaves / 2);
  return factor / (factor ** 2 - 1);
};

export interface IParsedEqText {
  preAmp: number;
  /**
   * Whether the text carried a `Preamp:` line of its own.
   *
   * Distinct from `preAmp` being 0, which is also what a file without one
   * yields. The importer needs the difference: a preamp somebody exported on
   * purpose should survive the import, and it cannot if automatic
   * normalization is left switched on to recompute over the top of it.
   */
  hasPreAmp: boolean;
  filters: IFiltersMap;
  eqFormat: AutoEqFormat;
  /** Present only when the file was a GraphicEQ one. */
  graphicEq?: IGraphicEqPoint[];
  /** Filename from a `Convolution:` line, if the file carried one. */
  convolutionFileName?: string;
  /** How many bands were recognised but had no FluidEQ equivalent. */
  unsupported: number;
  /** True when the file yielded no EQ content at all. */
  isEmpty: boolean;
}

/**
 * Parse an Equalizer APO ParametricEQ or GraphicEQ text file.
 *
 * Never throws: a file with nothing usable in it comes back with `isEmpty`,
 * which the caller turns into a message. Refusing at this level would mean
 * deciding on the caller's behalf that a half-recognised file is worthless.
 */
export const parseEqText = (text: string): IParsedEqText => {
  const filters: IFiltersMap = {};
  const graphicEq: IGraphicEqPoint[] = [];
  let preAmp = 0;
  let hasPreAmp = false;
  let convolutionFileName: string | undefined;
  let unsupported = 0;

  text.split(/\r?\n/).forEach((rawLine) => {
    // Everything after `#` is a comment in APO, and FluidEQ's own output is
    // full of them.
    const line = rawLine.split('#')[0].trim();
    if (!line) {
      return;
    }

    const preampMatch = line.match(PREAMP_LINE);
    if (preampMatch) {
      const parsed = Number(preampMatch[1]);
      if (Number.isFinite(parsed)) {
        // Last one wins. A FluidEQ config carries one preamp per device block,
        // and the active block is written last.
        preAmp = clampGain(parsed);
        hasPreAmp = true;
      }
      return;
    }

    const convolutionMatch = line.match(CONVOLUTION_LINE);
    if (convolutionMatch) {
      [, convolutionFileName] = convolutionMatch;
      return;
    }

    const graphicMatch = line.match(GRAPHIC_LINE);
    if (graphicMatch) {
      graphicMatch[1].split(';').forEach((point) => {
        const pointMatch = point.trim().match(GRAPHIC_POINT);
        if (!pointMatch) {
          return;
        }
        const frequency = Number(pointMatch[1]);
        const gain = Number(pointMatch[2]);
        if (
          Number.isFinite(frequency) &&
          Number.isFinite(gain) &&
          frequency >= MIN_FREQUENCY &&
          frequency <= MAX_FREQUENCY
        ) {
          graphicEq.push({ frequency, gain: clampGain(gain) });
        }
      });
      return;
    }

    const filterMatch = line.match(FILTER_LINE);
    if (!filterMatch) {
      return;
    }
    // A disabled band is not an error and not a band. APO ignores it and so
    // does the editor, which has no way to show a band that is off.
    if (filterMatch[1].toUpperCase() === 'OFF') {
      return;
    }
    const type = TYPE_ALIASES[filterMatch[2].toUpperCase()];
    if (!type) {
      unsupported += 1;
      return;
    }
    if (Object.keys(filters).length >= MAX_NUM_FILTERS) {
      unsupported += 1;
      return;
    }

    const frequency = Number(filterMatch[3]);
    if (!Number.isFinite(frequency)) {
      unsupported += 1;
      return;
    }

    const filter = getDefaultFilterWithId();
    filter.type = type;
    filter.frequency = clampFrequency(frequency);
    filter.gain = clampGain(Number(filterMatch[4] ?? 0));
    if (filterMatch[5] !== undefined) {
      filter.quality = clampQuality(Number(filterMatch[5]));
    } else if (filterMatch[6] !== undefined) {
      filter.quality = clampQuality(bandwidthToQ(Number(filterMatch[6])));
    } else {
      filter.quality = clampQuality(1);
    }
    filters[filter.id] = filter;
  });

  const eqFormat =
    graphicEq.length > 0 ? AutoEqFormat.GRAPHIC : AutoEqFormat.PARAMETRIC;

  // GraphicEQ reaches APO as one native command, but the editor still needs
  // something to draw and drag, so the points are projected onto peak bands
  // exactly as the AutoEQ reader does.
  if (eqFormat === AutoEqFormat.GRAPHIC && Object.keys(filters).length === 0) {
    graphicEq.slice(0, MAX_NUM_FILTERS).forEach((point) => {
      const filter = getDefaultFilterWithId();
      filter.type = FilterTypeEnum.PK;
      filter.frequency = clampFrequency(point.frequency);
      filter.gain = clampGain(point.gain);
      filter.quality = clampQuality(1.41);
      filters[filter.id] = filter;
    });
  }

  return {
    preAmp,
    hasPreAmp,
    filters,
    eqFormat,
    ...(eqFormat === AutoEqFormat.GRAPHIC ? { graphicEq } : {}),
    convolutionFileName,
    unsupported,
    // A file with only a preamp in it is still a file that said something.
    isEmpty:
      Object.keys(filters).length === 0 && graphicEq.length === 0 && !hasPreAmp,
  };
};
