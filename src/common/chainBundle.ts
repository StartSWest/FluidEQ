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
 * there is nothing in the profile it could be derived from. Literally in one
 * direction only — see `isSafeImportedCustomBlock` for what a bundle arriving
 * from somebody else is not allowed to bring with it.
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
  /**
   * The user's own include, verbatim, when the output has one.
   *
   * Verbatim on the way out. On the way in it is a stranger's text bound for a
   * file Equalizer APO includes unconditionally, so nothing writes this to
   * disk without asking `isSafeImportedCustomBlock` first.
   */
  custom?: string;
}

/**
 * What an import came to, for the one line the panel shows afterwards.
 *
 * A flag rather than a sentence, because the main process has no dictionary:
 * every translated string in FluidEQ is looked up in the renderer, so the only
 * thing worth sending across is the fact that it happened.
 */
export interface IChainImport {
  /** What to say about it. Empty when the dialog was cancelled. */
  note: string;
  /**
   * Whether the sender's custom block was left out — see
   * `isSafeImportedCustomBlock`. The rest of the chain arrived either way.
   */
  isCustomSkipped: boolean;
}

/**
 * The two commands an imported custom block may not carry.
 *
 * MATCHED THE WAY EQUALIZER APO MATCHES. `FilterEngine::loadConfigFile` reads a
 * line, cuts it at the FIRST colon, trims the key — "allow to use indentation"
 * is the comment sitting on that very line — and compares what is left to a
 * command name. So `\tinclude :` is the same command as `Include:`, and a check
 * anchored to column zero would be one space wide.
 *
 * Case is the one place this is deliberately stricter than APO, which compares
 * with `command == L"Include"` and therefore ignores a lower-case `include:`
 * outright. Matching case-sensitively here would make the check bypassable by
 * typing the command in lower case the day APO relaxes that comparison, and
 * refusing a spelling APO already ignores costs a sender nothing.
 *
 * `VSTPlugin` is the spelling that actually loads the DLL —
 * `VSTPluginFilterFactory` tests `command == L"VSTPlugin"`, and there is no
 * `Plugin` command in 1.4.2 at all — while `Plugin:` is what this codebase has
 * always called it, including in the template it writes into every custom file.
 * Both are refused: the first because it is the real hole, the second because
 * it is one alternation away and is what the next APO version might name it.
 */
const REFUSED_COMMAND = /^\s*(?:include|(?:vst)?plugin)\s*:/i;

/**
 * Every control character except the three a config file is made of.
 *
 * The same reason `isSafeConvolutionFileName` refuses them: what APO's parser
 * does with a NUL or an escape is not this file's to reason about. CR and LF
 * are the line breaks and tab is documented indentation, and none of the three
 * can smuggle a command past the pattern above — its `\s` covers all of them.
 */
// eslint-disable-next-line no-control-regex -- the characters are the point
const CONTROL_CHARACTER = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;

/**
 * Whether a custom block that arrived in a bundle may be written to disk.
 *
 * A `.fluideq` is a file a stranger can send, and its custom block is copied
 * verbatim into the one file the generated device file `Include:`s
 * unconditionally — which reaches Equalizer APO's `config.txt`. That makes it
 * not a settings blob but an APO program, delivered into a system audio
 * component by email. Two commands make it arbitrary: `Plugin:` loads a DLL
 * into the Windows audio pipeline, and `Include:` pulls in any other file on
 * disk. A block carrying either is not written at all.
 *
 * Everything else in the grammar stays. `Filter`, `Preamp`, `Copy`, `Delay`,
 * `Stage`, `Channel`, `GraphicEQ` and the rest are arithmetic on the audio and
 * reach nothing outside themselves, and sharing a whole chain is the entire
 * point of the format.
 *
 * THIS IS ABOUT IMPORTS AND NOTHING ELSE. The custom file an owner writes by
 * hand in their own config directory never passes through here and keeps
 * working exactly as `deviceProfiles.ts` promises it does, `Plugin:` included.
 * It is their machine and their file; what changed is only that a file which
 * arrived from somebody else does not get to write it.
 */
export const isSafeImportedCustomBlock = (custom: string): boolean =>
  !CONTROL_CHARACTER.test(custom) &&
  !custom.split(/\r\n|[\r\n]/).some((line) => REFUSED_COMMAND.test(line));

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
