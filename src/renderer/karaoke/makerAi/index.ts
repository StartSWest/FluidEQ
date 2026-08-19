/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
*/

/**
 * The Maker's automatic detection: hearing a song and proposing an edit.
 *
 * 2,743 lines in one file, holding two entirely separate models and everything
 * around them. Whisper hears words, Basic Pitch hears notes, and neither knows
 * the other exists — but they sat interleaved, so the worker lifecycle for one
 * lived four hundred lines from the pitch tracing for the other.
 *
 * A directory, so the import path every caller already uses still resolves.
 *
 * Speech, in the order the work happens:
 *
 * - `whisperSession`    the worker's lifetime: loading it, and letting it go
 * - `whisperProgress`   what a download and a transcription report while running
 * - `whisperTranscribe` the transcription itself
 * - `wordMatching`      how close two words are, and which one was meant
 * - `sentenceAlignment` fitting a transcript onto lyrics the user already wrote
 *
 * Pitch:
 *
 * - `analysisWindows` the vocal phrases a detector is asked about, merged out
 *                     of timed lyric words. It was `basicPitch`, and held that
 *                     model too; the model is gone and the windows outlived it
 * - `pitchRuns`   a continuous pitch trace, cut into runs
 * - `guideNotes`  those runs turned into notes a singer can follow
 *
 * Shared:
 *
 * - `audio`  decoding and resampling, since both models want a mono signal at
 *            their own rate and neither should have to know how to get one
 * - `apply`  writing either model's answer back into the project
 */
export * from './audio';
export * from './analysisWindows';
export * from './whisperSession';
export * from './whisperProgress';
export * from './whisperTranscribe';
export * from './wordMatching';
export * from './vocalRests';
export * from './voiceOnsets';
export * from './lyricRepetition';
export * from './sentenceAlignment';
export * from './apply';
export * from './pitchRuns';
export * from './guideNotes';
