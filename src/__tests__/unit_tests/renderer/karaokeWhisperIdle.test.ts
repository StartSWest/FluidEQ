/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * When the speech model's memory is given back: the moment nothing needs it.
 *
 * It was a timer of five, ten or thirty minutes, which asked in the middle of
 * an editing session and held the gigabyte for the whole wait after the Maker
 * had closed. The model is idle now when the last Maker closes with nothing
 * transcribing, and the setting decides what that moment does.
 */

import {
  beginWhisperRecognition,
  finishWhisperRecognition,
  getKaraokeWhisperSessionSnapshot,
  holdKaraokeWhisperModel,
  keepKaraokeWhisperModelForNow,
  setWhisperWorker,
  writeKaraokeWhisperMemorySettings,
} from '../../../renderer/karaoke/makerAi/whisperSession';

const loadModel = () => {
  const worker = { terminate: jest.fn() } as unknown as Worker;
  setWhisperWorker(worker);
  return worker;
};

describe('the speech model once idle', () => {
  let timers: jest.SpyInstance;

  beforeEach(() => {
    timers = jest.spyOn(window, 'setTimeout');
  });

  afterEach(() => {
    timers.mockRestore();
    setWhisperWorker(undefined);
    keepKaraokeWhisperModelForNow();
  });

  it('asks when the Maker closes, and not while it is open', () => {
    writeKaraokeWhisperMemorySettings({ policy: 'ask' });
    loadModel();
    const letGo = holdKaraokeWhisperModel();
    beginWhisperRecognition();
    finishWhisperRecognition();
    // Finished, but the Maker is open: the next run is one press away.
    expect(getKaraokeWhisperSessionSnapshot().releasePrompt).toBe(false);

    letGo();
    expect(getKaraokeWhisperSessionSnapshot().releasePrompt).toBe(true);

    // Reopened: the question is withdrawn, the model is needed again.
    const again = holdKaraokeWhisperModel();
    expect(getKaraokeWhisperSessionSnapshot().releasePrompt).toBe(false);
    again();
    // Nothing waited on a clock.
    expect(timers).not.toHaveBeenCalled();
  });

  it('frees it outright under "release automatically", once nothing is transcribing', () => {
    writeKaraokeWhisperMemorySettings({ policy: 'auto' });
    const worker = loadModel();
    const letGo = holdKaraokeWhisperModel();
    beginWhisperRecognition();
    letGo();
    // Closed mid-transcription: freed when the run ends, not under it.
    expect(worker.terminate).not.toHaveBeenCalled();

    finishWhisperRecognition();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(getKaraokeWhisperSessionSnapshot().inMemory).toBe(false);
    expect(timers).not.toHaveBeenCalled();
  });

  it('keeps it under "keep loaded"', () => {
    writeKaraokeWhisperMemorySettings({ policy: 'keep' });
    const worker = loadModel();
    holdKaraokeWhisperModel()();
    expect(worker.terminate).not.toHaveBeenCalled();
    expect(getKaraokeWhisperSessionSnapshot().releasePrompt).toBe(false);
    expect(timers).not.toHaveBeenCalled();
  });
});
