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
 * Treating the Equalizer APO config as the thing that is actually true.
 *
 * FluidEQ has always kept its own state.txt and written the config from it.
 * That is backwards whenever anything else touches the config — another tool,
 * a hand edit, an APO reinstall, a restore from backup — because the file is
 * what you are hearing and state.txt is only what FluidEQ last believed.
 *
 * So: on startup the config wins for everything it can express.
 *
 * It cannot express everything, and pretending otherwise would lose more than
 * it gained. A voicing, a driver correction and a measured Smart EQ curve are
 * all written as ordinary `Filter N:` lines, indistinguishable from bands the
 * user placed by hand. Reading the config back as the sole truth would turn
 * every one of them into ordinary EQ bands: the pickers would read "none" while
 * the sound was unchanged, and the next edit would write the layers in *again*,
 * on top of their own flattened copies. So the split is:
 *
 *   the config      -> bands, preamp, GraphicEQ points, which impulse response
 *   the local files -> which voicing, which driver profile, what Smart EQ
 *                      measured, which headphone reference, what the profile is
 *                      called
 *
 * Nothing in the second list is audible on its own — each is a *description* of
 * a layer, from which the audible lines are regenerated. Everything in the
 * first list is audible in itself.
 */

import { parseEqText } from './apoText';
import { AutoEqFormat, IFiltersMap, IGraphicEqPoint } from './constants';

/** One `Device:`-scoped section of a generated config. */
export interface IApoBlock {
  /** The `Device:` argument — a GUID, a device name, or `all`. */
  devicePattern: string;
  /** Every line of the block including its own Device/Channel header. */
  text: string;
}

/**
 * Split a config into its Device blocks.
 *
 * Equalizer APO has no block terminator: a `Device:` line simply changes the
 * scope of everything after it until the next one. So a block runs from its
 * Device line to the next Device line or the end of the file. Anything before
 * the first Device line applies globally and is returned under `all`, which is
 * what APO itself does with it.
 */
export const splitConfigBlocks = (text: string): IApoBlock[] => {
  const blocks: IApoBlock[] = [];
  let current: IApoBlock | undefined;

  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.split('#')[0].trim();
    const deviceMatch = line.match(/^Device\s*:\s*(.+?)\s*$/i);
    if (deviceMatch) {
      if (current) {
        blocks.push(current);
      }
      current = { devicePattern: deviceMatch[1], text: rawLine };
      return;
    }
    if (!current) {
      if (!line) {
        return;
      }
      current = { devicePattern: 'all', text: rawLine };
      return;
    }
    current.text += `\n${rawLine}`;
  });

  if (current) {
    blocks.push(current);
  }
  return blocks;
};

/**
 * The block that governs a given endpoint.
 *
 * Later blocks win, because APO applies them in order and a device-specific
 * block written after a broad one is the more specific instruction. A `Device:
 * all` block is the fallback and is only used when nothing names the endpoint.
 */
export const findBlockForDevice = (
  blocks: IApoBlock[],
  devicePattern: string,
): IApoBlock | undefined => {
  const wanted = devicePattern.trim().toLowerCase();
  let specific: IApoBlock | undefined;
  let fallback: IApoBlock | undefined;

  blocks.forEach((block) => {
    const pattern = block.devicePattern.trim().toLowerCase();
    if (pattern === 'all') {
      fallback = block;
      return;
    }
    if (wanted && pattern === wanted) {
      specific = block;
    }
  });

  return specific ?? fallback;
};

/**
 * The audible content of a chain, as a comparable string.
 *
 * Deliberately not a diff of the file text. The generated config carries
 * comments, block order and a device pattern that all change for reasons that
 * have nothing to do with what you hear, and comparing those would report
 * drift on every startup. This is the part that matters: which filters, at
 * what settings, with what preamp and which impulse response.
 *
 * Filters are sorted by frequency because APO applies biquads in series and
 * their order does not change the magnitude response — two configs listing the
 * same bands in a different order sound identical and must compare equal.
 */
export const describeAudibleChain = (input: {
  preAmp: number;
  filters: IFiltersMap;
  eqFormat?: AutoEqFormat;
  graphicEq?: IGraphicEqPoint[];
  convolutionFileName?: string;
}): string => {
  const parts: string[] = [`preamp=${Math.round(input.preAmp * 10) / 10}`];

  if (input.convolutionFileName) {
    parts.push(`ir=${input.convolutionFileName}`);
  }

  if (input.eqFormat === AutoEqFormat.GRAPHIC && input.graphicEq?.length) {
    parts.push(
      `graphic=${input.graphicEq
        .map(
          (point) => `${point.frequency}:${Math.round(point.gain * 10) / 10}`,
        )
        .join(',')}`,
    );
    return parts.join('|');
  }

  const bands = Object.values(input.filters)
    .filter(
      (filter) =>
        Number.isFinite(filter.frequency) &&
        Number.isFinite(filter.gain) &&
        Number.isFinite(filter.quality),
    )
    .map(
      (filter) =>
        `${filter.type}@${Math.round(filter.frequency)}` +
        `/${Math.round(filter.gain * 10) / 10}` +
        `/${Math.round(filter.quality * 100) / 100}`,
    )
    .sort();

  parts.push(`bands=${bands.join(',')}`);
  return parts.join('|');
};

export interface IAdoptedChain {
  preAmp: number;
  filters: IFiltersMap;
  eqFormat: AutoEqFormat;
  graphicEq?: IGraphicEqPoint[];
  convolutionFileName?: string;
  /** How many bands the block had that FluidEQ has no editor for. */
  unsupported: number;
}

/**
 * Read one device block back into something that can be applied to the state.
 *
 * Returns undefined when the block says nothing about the EQ — a bare
 * `Device: all` / `Channel: all` pair, which is exactly what FluidEQ writes as
 * its neutral fallback and must not be mistaken for "the user cleared
 * everything".
 */
export const adoptBlock = (block: IApoBlock): IAdoptedChain | undefined => {
  const parsed = parseEqText(block.text);
  if (parsed.isEmpty) {
    return undefined;
  }
  return {
    preAmp: parsed.preAmp,
    filters: parsed.filters,
    eqFormat: parsed.eqFormat,
    graphicEq: parsed.graphicEq,
    convolutionFileName: parsed.convolutionFileName,
    unsupported: parsed.unsupported,
  };
};

const describeAdopted = (adopted: IAdoptedChain) =>
  describeAudibleChain({
    preAmp: adopted.preAmp,
    filters: adopted.filters,
    eqFormat: adopted.eqFormat,
    graphicEq: adopted.graphicEq,
    convolutionFileName: adopted.convolutionFileName,
  });

/**
 * Whether the config on disk says something different from what we would write.
 *
 * Deliberately compares two blocks of config text rather than a block against
 * the live state. The writer does not emit the state verbatim: the preamp is
 * derived from the whole chain when auto-normalise is on, zero-gain peaks are
 * dropped as inert, the voicing, driver and Smart EQ layers are appended, and
 * everything is clamped on the way out. Comparing against `state.preAmp`
 * therefore reported drift on the app's own output — which would have meant
 * FluidEQ adopting its own config on every single launch.
 *
 * Running both sides through the same reader makes the comparison immune to
 * all of that: whatever stateToString does, it does to both.
 */
export const hasChainDrifted = (
  expectedBlockText: string,
  adopted: IAdoptedChain,
): boolean => {
  const expectedBlock = splitConfigBlocks(expectedBlockText)[0];
  const expected = expectedBlock ? adoptBlock(expectedBlock) : undefined;
  if (!expected) {
    // We would write nothing audible, and the file has something. That is a
    // difference — and the file wins, which is the point.
    return true;
  }
  return describeAdopted(expected) !== describeAdopted(adopted);
};
