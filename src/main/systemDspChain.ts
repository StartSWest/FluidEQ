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
import { engineAtLeast } from '../common/engineHealth';
import {
  engineTakesOutputConfig,
  outputConfigFileName,
  outputConfigGuid,
} from '../common/outputConfigFiles';
import {
  gameModeOnWire,
  hasFootsteps,
  hasPresetTone,
  hasRoomTrailer,
  roomHeadOnWire,
  withoutFootsteps,
} from '../common/dsp/chainWire';
import { scheduleWrite, scheduleWriteOperation } from './asyncWriter';
import { writeRoomHead, writeLegacyRoomHead } from './roomHead';
import { readEngineHealth } from './engineHealth';
import {
  IOutputDesigns,
  outputDesignsOf,
  writeOutputDesigns,
} from './outputDesigns';

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
  // `SET_SYSTEM_DSP_CHAIN`) or Footsteps. Only the legacy optional word may
  // be removed for old engines: with a trailer behind it, the last value is
  // the trailer's, and cutting it made a line the engine refuses whole.
  const compatible =
    gaming &&
    !acceptsGameWord &&
    !hasRoomTrailer(values) &&
    !hasFootsteps(values) &&
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
 * The room's head goes beside it, from the same message. An output's whole
 * snapshot is serialized, including its asynchronous asset/capability reads,
 * so a slower earlier request cannot replace either half of a newer one.
 * `keepFootsteps` is one of those reads: asked inside the operation, after
 * the request is registered, never before the call — a flush that waited on
 * it first could register after a newer one and write over it. It must not
 * reject; a line without the trailer is the answer when nothing is known.
 */
const pendingWrites = new Map<string, object>();

const writeChainFile = async (
  configDirPath: string,
  filename: string,
  values: number[],
  writeHead: () => Promise<void>,
  endpoint?: string,
  keepFootsteps?: () => Promise<boolean>,
): Promise<void> => {
  const target = path.resolve(configDirPath, filename);
  const filePath = process.platform === 'win32' ? target.toLowerCase() : target;
  const request = {};
  const snapshot = [...values];
  pendingWrites.set(filePath, request);
  try {
    await scheduleWriteOperation(filePath, async () => {
      if (pendingWrites.get(filePath) !== request) {
        return;
      }
      const [, health, footsteps] = await Promise.all([
        writeHead(),
        gameModeOnWire(snapshot)
          ? readEngineHealth(path.dirname(configDirPath))
          : Promise.resolve(undefined),
        keepFootsteps && hasFootsteps(snapshot)
          ? keepFootsteps()
          : Promise.resolve(true),
      ]);
      if (pendingWrites.get(filePath) !== request) {
        return;
      }
      // Early development DLLs understand the numeric word but predate
      // metadata. Only this output's live answer proves that for its rack.
      const acceptsGameWord =
        health?.outputs.some(
          (output) =>
            (endpoint === undefined ||
              outputConfigGuid(output.endpoint) === endpoint) &&
            output.locked &&
            typeof output.gameMode === 'boolean',
        ) ?? false;
      await scheduleWrite(
        filePath,
        formatSystemDspChain(
          footsteps ? snapshot : withoutFootsteps(snapshot),
          acceptsGameWord,
        ),
      );
    });
  } finally {
    if (pendingWrites.get(filePath) === request) {
      pendingWrites.delete(filePath);
    }
  }
};

/**
 * `keepFootsteps` decides, in the write's own turn, whether the installed
 * engine takes Footsteps' trailer (`writeChainFile`); without it the line
 * is written as given.
 */
export const writeSystemDspChain = async (
  configDirPath: string,
  values: number[],
  endpoint?: string,
  designs?: IOutputDesigns,
  keepFootsteps?: () => Promise<boolean>,
): Promise<void> => {
  const guid = outputConfigGuid(endpoint ?? '');
  const filename = outputConfigFileName('dsp', endpoint ?? '');
  if (!guid || !filename) {
    throw new TypeError('The DSP rack needs a valid output GUID');
  }
  const head = roomHeadOnWire(values);
  const snapshot = designs ? outputDesignsOf(designs) : undefined;
  await writeChainFile(
    configDirPath,
    filename,
    values,
    async () => {
      await Promise.all([
        writeRoomHead(configDirPath, head, guid),
        snapshot
          ? writeOutputDesigns(configDirPath, guid, snapshot)
          : Promise.resolve(),
      ]);
    },
    guid,
    keepFootsteps,
  );
};

/** Kept only until an older installed engine is upgraded to endpoint files. */
export const writeLegacySystemDspChain = async (
  configDirPath: string,
  values: number[],
  dllVersion: string,
): Promise<void> => {
  if (
    !engineAtLeast(dllVersion, [1, 0]) ||
    engineTakesOutputConfig(dllVersion)
  ) {
    throw new TypeError(
      'A legacy DSP write requires an engine older than 1.19',
    );
  }
  const head = roomHeadOnWire(values);
  await writeChainFile(configDirPath, FLUID_ENGINE_DSP_FILENAME, values, () =>
    writeLegacyRoomHead(configDirPath, head),
  );
};
