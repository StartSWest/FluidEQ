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
 * Bringing settings in from a file the user already has.
 *
 * Two entirely separate things live here because they arrive the same way and
 * fail the same way: an EQ, which is text, and a convolution, which is a WAV
 * that has to be copied next to the Equalizer APO config before APO can load
 * it. Both are read once, validated in full, and only then handed back — an
 * import that half-applies is worse than one that refuses.
 */

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import {
  AutoEqFormat,
  clampGain,
  clampQuality,
  IConvolutionProfile,
  IFiltersMap,
  IGraphicEqPoint,
  IPresetV1,
  IPresetV2,
} from '../common/constants';
import { parseEqText } from '../common/apoText';
import { validatePresetV1, validatePresetV2 } from '../common/validator';
import { PRODUCT_NAME } from '../common/branding';
import { analyzeConvolutionBuffer } from './convolutionAnalysis';

/** Big enough for a long impulse response, small enough to refuse a mistake. */
const MAX_WAV_BYTES = 128 * 1024 * 1024;
/** No EQ text file is anywhere near this. A GraphicEQ line is the longest. */
const MAX_TEXT_BYTES = 4 * 1024 * 1024;

/**
 * Rates Equalizer APO can convolve with.
 *
 * APO applies the impulse response at the device's own rate, so an IR recorded
 * at a rate the endpoint never runs at is silently useless. Rather than pin one
 * rate the way the AutoEq downloader does — it can, because it controls what it
 * downloads — this accepts the standard family and reports which one it found,
 * so the name in the UI says 44.1 kHz and the user can see why it did nothing.
 */
const SUPPORTED_SAMPLE_RATES = [
  44100, 48000, 88200, 96000, 176400, 192000,
] as const;

export interface IImportedEq {
  preAmp: number;
  filters: IFiltersMap;
  eqFormat: AutoEqFormat;
  graphicEq?: IGraphicEqPoint[];
  /** What the file was recognised as, for the confirmation message. */
  sourceLabel: string;
  /** Bands recognised but with no FluidEQ equivalent; 0 for a clean import. */
  unsupported: number;
}

/**
 * Read a WAV header far enough to know it is one, and at what rate.
 *
 * Deliberately structural rather than trusting the extension: a `.wav` that is
 * actually an MP3 would reach APO, fail there, and look like a FluidEQ bug.
 */
const readWavSampleRate = (buffer: Buffer): number => {
  if (
    buffer.length < 44 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    throw new Error('That file is not a WAV impulse response.');
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkEnd = offset + 8 + chunkSize;
    if (chunkEnd > buffer.length) {
      throw new Error('That WAV file is truncated.');
    }
    if (chunkId === 'fmt ' && chunkSize >= 16) {
      const audioFormat = buffer.readUInt16LE(offset + 8);
      const channels = buffer.readUInt16LE(offset + 10);
      const sampleRate = buffer.readUInt32LE(offset + 12);
      // 1 is PCM, 3 is IEEE float, 0xFFFE is WAVE_FORMAT_EXTENSIBLE — which is
      // what most 24-bit and multichannel IRs are actually tagged as.
      if (![1, 3, 0xfffe].includes(audioFormat) || channels < 1) {
        throw new Error('That WAV format is not supported by Equalizer APO.');
      }
      return sampleRate;
    }
    offset = chunkEnd + (chunkSize % 2);
  }
  throw new Error('That WAV file has no format chunk.');
};

/**
 * Copy a user's own impulse response next to the APO config and describe it.
 *
 * The file is copied rather than referenced in place: APO resolves Convolution
 * paths relative to its own config directory, and a path into the user's
 * Downloads folder would break the moment they tidied up.
 */
export const importConvolutionFile = (
  sourcePath: string,
  configDir: string,
): IConvolutionProfile => {
  const stat = fs.statSync(sourcePath);
  if (stat.size > MAX_WAV_BYTES) {
    throw new Error('That impulse response is too large to import safely.');
  }
  const buffer = fs.readFileSync(sourcePath);
  const sampleRate = readWavSampleRate(buffer);
  if (!SUPPORTED_SAMPLE_RATES.includes(sampleRate as never)) {
    throw new Error(
      `That impulse response is ${sampleRate} Hz. Equalizer APO needs one of ${SUPPORTED_SAMPLE_RATES.join(', ')} Hz.`,
    );
  }
  const analysis = analyzeConvolutionBuffer(buffer);

  const displayName = path.basename(sourcePath, path.extname(sourcePath));
  // Named from the content, not from the original filename: two different IRs
  // both called "left.wav" must not overwrite each other in the config folder.
  const fileName = `fluideq-ir-local-${createHash('sha1')
    .update(buffer)
    .digest('hex')
    .slice(0, 12)}.wav`;

  fs.mkdirSync(configDir, { recursive: true });
  const targetPath = path.join(configDir, fileName);
  const temporaryPath = `${targetPath}.importing`;
  fs.writeFileSync(temporaryPath, buffer);
  try {
    fs.renameSync(temporaryPath, targetPath);
  } finally {
    if (fs.existsSync(temporaryPath)) {
      fs.rmSync(temporaryPath);
    }
  }

  return {
    name: `${displayName} · imported · ${sampleRate / 1000} kHz`,
    // No companion ParametricEQ file exists for a user's own IR, so the graph
    // has nothing to draw for it. The WAV is still what APO applies.
    filters: {},
    fileName,
    response: analysis.response,
    peakGainDb: analysis.peakGainDb,
  };
};

/** Turn a stored v1 preset into the shape everything else expects. */
const fromPresetV1 = (preset: IPresetV1): IPresetV2 => {
  const filters: IFiltersMap = {};
  preset.filters.forEach((filter) => {
    filters[filter.id] = {
      ...filter,
      gain: clampGain(filter.gain),
      quality: clampQuality(filter.quality),
    };
  });
  return { preAmp: clampGain(preset.preAmp), filters };
};

/**
 * Read an EQ out of whatever the user picked.
 *
 * Three things count as "an EQ file" in practice, and the difference is not
 * something a user should have to think about before choosing one: a FluidEQ
 * profile they exported, an Equalizer APO config, and an AutoEQ-style
 * ParametricEQ or GraphicEQ text file. JSON is tried first because it is the
 * only one that can be identified with certainty.
 */
export const importEqFile = (sourcePath: string): IImportedEq => {
  const stat = fs.statSync(sourcePath);
  if (stat.size > MAX_TEXT_BYTES) {
    throw new Error('That file is too large to be an EQ setting.');
  }
  const content = fs.readFileSync(sourcePath, 'utf8');

  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    json = undefined;
  }

  if (json !== undefined) {
    let preset: IPresetV2 | undefined;
    if (validatePresetV2(json)) {
      preset = json as IPresetV2;
    } else if (validatePresetV1(json)) {
      preset = fromPresetV1(json as IPresetV1);
    }
    if (!preset) {
      throw new Error(`That JSON file is not a ${PRODUCT_NAME} profile.`);
    }
    return {
      preAmp: clampGain(preset.preAmp),
      filters: preset.filters,
      eqFormat: preset.eqFormat ?? AutoEqFormat.PARAMETRIC,
      graphicEq: preset.graphicEq,
      sourceLabel: `${PRODUCT_NAME} profile`,
      unsupported: 0,
    };
  }

  const parsed = parseEqText(content);
  if (parsed.isEmpty) {
    throw new Error(
      `No Equalizer APO filters were found in that file. Expected a ParametricEQ, GraphicEQ or ${PRODUCT_NAME} profile.`,
    );
  }

  return {
    preAmp: parsed.preAmp,
    filters: parsed.filters,
    eqFormat: parsed.eqFormat,
    graphicEq: parsed.graphicEq,
    sourceLabel:
      parsed.eqFormat === AutoEqFormat.GRAPHIC
        ? 'GraphicEQ file'
        : 'Equalizer APO ParametricEQ file',
    unsupported: parsed.unsupported,
  };
};
