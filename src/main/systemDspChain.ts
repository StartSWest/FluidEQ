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
import { scheduleWrite } from './asyncWriter';

/** CRLF, like every other file in the config directory. */
const CRLF = '\r\n';

/**
 * Names the format so a later version can change the line without the DLL
 * guessing which one it is holding.
 */
export const SYSTEM_DSP_CHAIN_HEADER = '# FluidEQ Engine DSP chain v1';

export const formatSystemDspChain = (values: number[]): string =>
  [
    SYSTEM_DSP_CHAIN_HEADER,
    values.map((value) => String(value)).join(' '),
    '',
  ].join(CRLF);

/**
 * Ask for the rack file to hold `values`.
 *
 * Through the coalescing writer, because this is rewritten on every rack
 * change and a rack change is a slider being dragged. The engine reloads on
 * every write it sees in this directory, so a write per drag frame would
 * reconfigure the chain per frame on every output on the machine.
 */
export const writeSystemDspChain = (
  configDirPath: string,
  values: number[],
): Promise<void> =>
  scheduleWrite(
    path.join(configDirPath, FLUID_ENGINE_DSP_FILENAME),
    formatSystemDspChain(values),
  );
