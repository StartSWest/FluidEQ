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

import { IPresetV2 } from './constants';
import { validatePresetV2 } from './validator';
import { PRODUCT_NAME } from './branding';

/**
 * One output's whole chain, as a single file somebody can send to somebody
 * else.
 *
 * THE PROFILE, NOT THE FILES. It is tempting to bundle up the Equalizer APO
 * files themselves — the panel is showing them, they are right there, and they
 * are literally what the chain is. They are also the wrong thing to move: their
 * names carry a hash of the device they belong to, so importing them onto
 * another output would write files nothing includes, and importing them onto
 * another machine would write files for a device that does not exist there.
 *
 * The profile has neither problem. Every one of those files is generated from
 * it, so writing the profile to a different output regenerates the whole chain
 * correctly named for that output, on any machine.
 *
 * The custom file is the exception and travels literally, because it is the one
 * file FluidEQ does not generate: it is whatever the user wrote by hand, and
 * there is nothing in the profile it could be derived from.
 */
export interface IChainBundle {
  version: 1;
  /**
   * Which output it came off, for the person reading the file rather than for
   * the importer — a chain is imported onto whichever output is chosen, and
   * this is deliberately not consulted when deciding where it goes.
   */
  exportedFrom?: string;
  exportedAt?: string;
  /** The tuning: bands, preamp, voicing, driver, Smart EQ, convolution. */
  preset: IPresetV2;
  /** The user's own include, verbatim, when the output has one. */
  custom?: string;
}

/**
 * Spelled out rather than built from the product name: it is the extension on
 * files people have already saved and already sent each other, and a rebrand
 * that changed it would stop the app opening its own exports.
 */
export const CHAIN_BUNDLE_EXTENSION = 'fluideq';

/**
 * Read a bundle from whatever was in the file.
 *
 * Everything here arrives from disk, which means it arrives from anywhere: a
 * file somebody was sent, a file half-written by a crash, a file that is not a
 * bundle at all. The preset goes through the same schema a preset file does,
 * because it IS a preset file's worth of trust — and a bundle that fails is
 * refused whole rather than applied in part, since half a chain reaching
 * Equalizer APO is worse than none of it.
 *
 * Refusing rather than repairing is deliberate. The caller can say "that is not
 * a FluidEQ chain"; it cannot say anything useful about a chain that was
 * quietly mended into something the sender never had.
 */
export const parseChainBundle = (input: unknown): IChainBundle | undefined => {
  if (!input || typeof input !== 'object') {
    return undefined;
  }
  const candidate = input as Partial<IChainBundle>;
  if (candidate.version !== 1 || !validatePresetV2(candidate.preset)) {
    return undefined;
  }
  const preset = candidate.preset as IPresetV2;
  return {
    version: 1,
    exportedFrom:
      typeof candidate.exportedFrom === 'string'
        ? candidate.exportedFrom
        : undefined,
    exportedAt:
      typeof candidate.exportedAt === 'string'
        ? candidate.exportedAt
        : undefined,
    preset,
    custom: typeof candidate.custom === 'string' ? candidate.custom : undefined,
  };
};

export const serializeChainBundle = (bundle: IChainBundle): string =>
  `${JSON.stringify(bundle, null, 2)}\n`;

/**
 * A file name somebody can find again, from the output's own name.
 *
 * Windows refuses a handful of characters outright and a device name is full of
 * them — "Speakers (Realtek(R) Audio)" has brackets, and plenty have a slash.
 */
export const chainBundleFileName = (label: string): string => {
  const cleaned = label
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${cleaned || `${PRODUCT_NAME} chain`}.${CHAIN_BUNDLE_EXTENSION}`;
};
