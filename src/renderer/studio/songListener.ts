/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISongJournal } from 'common/songJournal';
import { soundHistorySamples } from 'common/soundHops';
import { CAPTURE_PROCESSOR } from '../audio/outputMirror';
import { createSoundHearing } from '../graph/liveSound';
import type { ICaptureGraph } from '../graph/useLiveOutputSpectrum';
import workletUrl from '../remoteAudio/workletUrl';

/**
 * The song heard for the member's AI, every sample of it, into `journal`
 * (`useSongListening.ts`, `songJournal.ts`).
 *
 * The audio thread hands each block of the capture over as it plays - the
 * processor the output mirror and the LAN sender tap with
 * (`pcmCapture.worklet.ts`) - and every block is heard when it arrives, in
 * order. A clock telling the page when to read its analysers was the first
 * way, and lost the song whenever FluidEQ was minimised or behind another
 * window: Chromium holds a hidden page's tasks back, and in an Electron window
 * hidden as a minimised FluidEQ is, throttled as the main window is, the
 * clock's messages came in bursts up to 7.7 s apart while an analyser holds
 * its last third of a second. Blocks handed over are only ever late.
 *
 * Its own hearing of the song, apart from the drawings' (`liveSound.ts`): one
 * that only hears while something is drawn cannot keep a song whole, and two
 * feeding one journal would count every moment twice.
 */

export interface ISongListener {
  close(): void;
}

interface IBlock {
  channels: number;
  frames: number;
  pcm: Float32Array;
}

/** The processor's block, as `pcmCapture.worklet.ts` posts it; or nothing. */
const readBlock = (data: unknown): IBlock | undefined => {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }
  const { channels, frames, pcm } = data as Record<string, unknown>;
  if (
    (channels !== 1 && channels !== 2) ||
    typeof frames !== 'number' ||
    !Number.isInteger(frames) ||
    frames <= 0 ||
    !(pcm instanceof ArrayBuffer) ||
    pcm.byteLength !== channels * frames * Float32Array.BYTES_PER_ELEMENT
  ) {
    return undefined;
  }
  return { channels, frames, pcm: new Float32Array(pcm) };
};

/**
 * Starts hearing `capture` into `journal`. Refuses, as an AbortError, a
 * capture that was replaced or closed while the processor loaded.
 */
export const startSongListener = async (
  capture: ICaptureGraph,
  journal: ISongJournal,
  signal: AbortSignal,
): Promise<ISongListener> => {
  const { context } = capture;
  const assertCurrent = () => {
    signal.throwIfAborted();
    if (context.state === 'closed') {
      throw new DOMException('The capture was closed', 'AbortError');
    }
  };
  assertCurrent();
  // A context that already has the bundle (the mirror, the lamps) has it at once.
  await context.audioWorklet.addModule(workletUrl().href);
  assertCurrent();

  // Two channels always, as the drawings hear them (`connectSoundAnalysers`):
  // a single one spread to both, more than two folded down as speakers fold
  // them. From a source of its own on the capture's stream, because the
  // capture takes its own source down before it publishes a replacement, and
  // must not take this branch with it (the mirror's reason).
  const source = context.createMediaStreamSource(capture.source.mediaStream);
  const input = context.createGain();
  input.channelCount = 2;
  input.channelCountMode = 'explicit';
  input.channelInterpretation = 'speakers';
  const tap = new AudioWorkletNode(context, CAPTURE_PROCESSOR, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  // Silent, and pulled by the destination: a branch nothing downstream asks
  // for is never run.
  const mute = context.createGain();
  mute.gain.value = 0;
  source.connect(input);
  input.connect(tap);
  tap.connect(mute);
  mute.connect(context.destination);

  const rate = context.sampleRate;
  const size = soundHistorySamples(rate);
  const left = new Float32Array(size);
  const right = new Float32Array(size);
  const hearing = createSoundHearing(rate, journal);
  let heardFrames = 0;
  let closed = false;
  tap.port.onmessage = ({ data }: MessageEvent<unknown>) => {
    const block = closed ? undefined : readBlock(data);
    if (!block) {
      return;
    }
    const { channels, frames, pcm } = block;
    // The latest `size` samples of each channel, oldest first, as an
    // analyser holds them (`soundHops.ts`).
    const kept = Math.min(frames, size);
    left.copyWithin(0, kept);
    right.copyWithin(0, kept);
    for (let frame = frames - kept; frame < frames; frame += 1) {
      const at = size - frames + frame;
      left[at] = pcm[frame * channels];
      right[at] = pcm[frame * channels + channels - 1];
    }
    heardFrames += frames;
    hearing.update(left, right, (heardFrames / rate) * 1_000);
    hearing.music();
  };

  /** Each connection this made, and only those, however the capture ended. */
  const disconnect = (from: AudioNode) => {
    try {
      from.disconnect();
    } catch (error) {
      if (!(
        error instanceof DOMException && error.name === 'InvalidAccessError'
      )) {
        throw error;
      }
    }
  };

  return {
    close: () => {
      if (closed) {
        return;
      }
      closed = true;
      tap.port.onmessage = null;
      // A processor that keeps answering `true` is kept alive by its
      // context; told to close, it answers `false` once and goes.
      tap.port.postMessage({ kind: 'close' });
      [source, input, tap, mute].forEach(disconnect);
    },
  };
};
