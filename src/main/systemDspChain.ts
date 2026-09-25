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
 * The DSP rack, written where the engine DLL can read it.
 *
 * The rack is already one flat array of doubles — `encodeChainSettings` in
 * `common/dsp/chainWire.ts`, decoded on the other side by
 * `feq_chain_settings_decode` — so the file is that array and nothing else:
 * a header line naming the format, then one line of numbers. The DLL reads
 * it with `std::from_chars`, which is locale-free by definition and rejects
 * anything that is not a plain decimal, and it fails quietly: an unparsable
 * line bypasses the rack, leaving the EQ audible and no error anywhere.
 *
 * `String(n)` rather than `toLocaleString` or `toFixed` for exactly that
 * reason — a comma decimal separator from a German machine and a rounded
 * value are both silently wrong on the far side.
 */

import path from 'path';
import { FLUID_ENGINE_DSP_FILENAME } from '../common/audioEngine';
import {
  gameModeOnWire,
  hasPresetTone,
  hasRoomTrailer,
  roomHeadOnWire,
} from '../common/dsp/chainWire';
import { scheduleWrite } from './asyncWriter';
import { writeRoomHead } from './roomHead';
import { readEngineHealth } from './engineHealth';

/** CRLF, like every other file in the config directory. */
const CRLF = '\r\n';

/**
 * Names the format so a later version can change the line without the DLL
 * guessing which one it is holding.
 */
export const SYSTEM_DSP_CHAIN_HEADER = '# FluidEQ Engine DSP chain v1';

export const formatSystemDspChain = (
  values: number[],
  acceptsGameWord = false,
): string => {
  // Older installed engines reject an extra numeric word and bypass the rack.
  // A comment carries the new mode without changing the sound they can decode.
  const gaming = gameModeOnWire(values);
  // A Room-capable engine requires the fixed Game word before its trailer,
  // and so does one that reads the preset's curve (only ever sent to one,
  // `SET_SYSTEM_DSP_CHAIN`). Only the legacy optional word may be removed for
  // old engines.
  const compatible =
    gaming &&
    !acceptsGameWord &&
    !hasRoomTrailer(values) &&
    !hasPresetTone(values)
      ? values.slice(0, -1)
      : values;
  return [
    SYSTEM_DSP_CHAIN_HEADER,
    ...(gaming ? ['# FluidEQLowLatency: ON'] : []),
    compatible.map((value) => String(value)).join(' '),
    '',
  ].join(CRLF);
};

/**
 * Ask for the rack file to hold `values`.
 *
 * Through the coalescing writer, because this is rewritten on every rack
 * change and a rack change is a slider being dragged. The engine reloads on
 * every write it sees in this directory, so a write per drag frame would
 * reconfigure the chain per frame on every output on the machine.
 *
 * The room's head goes beside it, from the same message: the rack names
 * which head it wants, and the engine reads both on the same notification.
 * The head is written only when it changes (`roomHead.ts`).
 */
const pendingWrites = new Map<string, object>();

export const writeSystemDspChain = async (
  configDirPath: string,
  values: number[],
): Promise<void> => {
  const request = {};
  pendingWrites.set(configDirPath, request);
  try {
    const [, health] = await Promise.all([
      writeRoomHead(configDirPath, roomHeadOnWire(values)),
      gameModeOnWire(values)
        ? readEngineHealth(path.dirname(configDirPath))
        : Promise.resolve(undefined),
    ]);
    // A mode change that arrived while the capability read was pending owns
    // the file. Never let the slower previous request replace that newer sound.
    if (pendingWrites.get(configDirPath) !== request) {
      return;
    }
    // Early development DLLs understand the numeric word but predate metadata.
    // A live process reporting the field is proof, even under version 1.9.
    const acceptsGameWord =
      health?.outputs.some(
        (output) => output.locked && typeof output.gameMode === 'boolean',
      ) ?? false;
    await scheduleWrite(
      path.join(configDirPath, FLUID_ENGINE_DSP_FILENAME),
      formatSystemDspChain(values, acceptsGameWord),
    );
  } finally {
    if (pendingWrites.get(configDirPath) === request) {
      pendingWrites.delete(configDirPath);
    }
  }
};
