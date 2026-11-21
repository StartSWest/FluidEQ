/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IForcedAlignmentLine,
  IForcedAlignmentLineResult,
} from './forcedAlignment';
import { TKaraokeMakerWhisperLogger } from './whisperProgress';
import {
  runKaraokeWhisperRequest,
  TKaraokeWhisperProgress,
} from './whisperRequest';

const isLineResult = (value: unknown): value is IForcedAlignmentLineResult => {
  const candidate = value as Partial<IForcedAlignmentLineResult> | null;
  return (
    typeof candidate?.id === 'string' &&
    typeof candidate.confidence === 'number' &&
    typeof candidate.stacked === 'number' &&
    typeof candidate.astray === 'number' &&
    Array.isArray(candidate.words)
  );
};

/**
 * Time words the song already has, each inside its own line.
 *
 * The same model and the same worker as a transcription, asked a narrower
 * question: nothing is transcribed, so nothing can be respelt or invented.
 * A line missing from the answer was not one the model could be run on.
 */
const alignKaraokeLinesWithWhisper = async (
  file: File,
  lines: readonly IForcedAlignmentLine[],
  onProgress: TKaraokeWhisperProgress,
  signal?: AbortSignal,
  onLog?: TKaraokeMakerWhisperLogger,
  language?: string,
): Promise<IForcedAlignmentLineResult[]> => {
  const { complete, logWhisper } = await runKaraokeWhisperRequest(
    file,
    { type: 'align', lines },
    onProgress,
    signal,
    onLog,
    language,
  );
  const results = Array.isArray(complete.lines)
    ? complete.lines.filter(isLineResult)
    : [];
  logWhisper(
    'info',
    'alignment.complete',
    'The given lyrics were timed inside their own lines.',
    'complete',
    {
      lines: lines.length,
      answered: results.length,
      meanConfidence: results.length
        ? Number(
            (
              results.reduce((total, line) => total + line.confidence, 0) /
              results.length
            ).toFixed(3),
          )
        : 0,
    },
  );
  onProgress(1, 'Timing complete', undefined, 'complete');
  return results;
};

export default alignKaraokeLinesWithWhisper;
