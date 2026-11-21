/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IKaraokeMakerWhisperTranscript,
  IWhisperOutput,
  karaokeMakerWhisperTranscriptWords,
  TKaraokeMakerWhisperLogger,
} from './whisperProgress';
import {
  runKaraokeWhisperRequest,
  TKaraokeWhisperProgress,
} from './whisperRequest';

/** Download-on-demand Whisper transcription. Audio is processed locally. */
const transcribeKaraokeWithWhisper = async (
  file: File,
  onProgress: TKaraokeWhisperProgress,
  signal?: AbortSignal,
  onLog?: TKaraokeMakerWhisperLogger,
  language?: string,
  wantSegments = false,
): Promise<IKaraokeMakerWhisperTranscript> => {
  const { complete, segments, audioDurationSeconds, logWhisper } =
    await runKaraokeWhisperRequest(
      file,
      { type: 'transcribe', wantSegments },
      onProgress,
      signal,
      onLog,
      language,
    );
  const results = Array.isArray(complete.results)
    ? (
        complete.results as Array<{
          output: IWhisperOutput;
          approximateSegmentWords?: boolean;
        }>
      ).map((entry) => ({
        output: entry.output,
        approximateSegmentWords: entry.approximateSegmentWords === true,
      }))
    : [
        {
          output: complete.output as IWhisperOutput,
          approximateSegmentWords: complete.approximateSegmentWords === true,
        },
      ];
  const passWords = results
    .slice()
    .sort(
      (left, right) =>
        Number(left.approximateSegmentWords) -
        Number(right.approximateSegmentWords),
    )
    .map((entry) =>
      karaokeMakerWhisperTranscriptWords(
        entry.output,
        entry.approximateSegmentWords,
        audioDurationSeconds,
      ),
    );
  // The worker now returns one canonical chronological stream. Keep the
  // `passes` shape for backward-compatible project alignment without ever
  // constructing a contradictory merged transcript.
  const words = (passWords
    .slice()
    .sort((left, right) => right.length - left.length)[0]
    ?.map((word) => ({ ...word })) ?? []) as IKaraokeMakerWhisperTranscript;
  words.passes = passWords.map((pass) => pass.map((word) => ({ ...word })));
  if (segments.length) {
    words.segments = segments;
  }
  const usedApproximateTimestamps = results.some(
    (entry) => entry.approximateSegmentWords,
  );
  logWhisper(
    'info',
    'transcription.complete',
    'Local speech recognition completed.',
    'complete',
    {
      recognizedWords: words.length,
      recognitionPasses: results.length,
      wordsByPass: passWords.map((pass) => pass.length),
      timestamps: usedApproximateTimestamps ? 'segment-estimated' : 'word',
    },
  );
  onProgress(1, 'Transcription complete', undefined, 'complete');
  return words;
};

export default transcribeKaraokeWithWhisper;
