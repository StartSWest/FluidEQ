/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { HOP_MS, soundHistorySamples } from 'common/soundHops';
import { CAPTURE_PROCESSOR } from '../audio/outputMirror';
import { keepNewestSamples, readCaptureBlock } from '../audio/captureBlocks';
import workletUrl from '../remoteAudio/workletUrl';
import { createSoundHearing } from '../graph/liveSound';
import { FFT_SIZE } from '../graph/liveSpectrumFrames';
import { createLampFrameMaker, type IHeardFrame } from './lampFrames';
import { LIGHTING_TICKS_PER_SECOND } from './lightingSceneMessages';

export type { IHeardFrame };

/**
 * What the scene hears, measured for the lamps on the audio clock.
 *
 * The same measurement the graph's scene gets — the same analyser settings,
 * the same track-referenced decibel window, the same sound read every ten
 * milliseconds (`liveSound.ts`) — so the lamps move with the music the way
 * the picture does. Its own analyser on the capture's source rather than the
 * graph's frames, because the graph publishes nothing while the window is
 * hidden, and the desk is lit exactly when the window is not being looked at.
 *
 * EVERY SAMPLE, HANDED OVER BY THE AUDIO THREAD. The audio thread gives the
 * capture's blocks to this page as they play (`CAPTURE_PROCESSOR`), and each
 * is heard when it arrives, in order: the rhythm, the drums and the energy
 * never lose a moment of the song, however late the page gets to them. A
 * clock worklet telling the page when to read its analysers was the first
 * way, and whatever played between two late ticks was never heard — an
 * analyser holds its last third of a second — while Chromium held the page
 * back behind a busy UI, or a hidden renderer sat at Windows' idle priority
 * (measured: ticks up to 5.4 s apart in a hidden window on a loaded machine).
 *
 * A LATE PAGE DRAWS THE NEWEST MOMENT. A frame is a picture, and pictures of
 * moments already past would reach the devices together and be seen as none.
 * So while another block is already waiting — the audio clock says how far
 * ahead of this page it is — no frame is made; the frame made at the newest
 * block stands for all the time since the last one, and its picture (the
 * spectrum and the waveform, read from the analyser) is the music as it is.
 */

export interface ILightingListener {
  close(): void;
}

/**
 * What the page's demo listens to, and whose audio clock draws it: the
 * output's capture. The member's own lamps are heard by the scene host
 * (`main/lighting/lampScenes.ts`).
 */
export interface ILampSound {
  context: AudioContext;
  source: AudioNode;
}

/** About one hop of sound a block: 480 frames at 48 kHz, 960 at 96. */
const blockFramesAt = (rate: number) =>
  Math.min(8_192, Math.max(128, Math.round((rate * HOP_MS) / 1_000)));

export const startLightingListener = async (
  sound: ILampSound,
  accent: [number, number, number],
  isPaused: () => boolean,
  onHeard: (heard: IHeardFrame) => void,
  signal?: AbortSignal,
): Promise<ILightingListener> => {
  const { context, source } = sound;
  const assertCurrent = () => {
    signal?.throwIfAborted();
    if (context.state === 'closed') {
      throw new DOMException(
        'The sound the lamps follow was closed',
        'AbortError',
      );
    }
  };
  assertCurrent();
  // Loaded into the sound's own context. A context that already has the
  // bundle (the output mirror uses it) resolves at once.
  await context.audioWorklet.addModule(workletUrl().href);
  // A sound or scene can be replaced while its worklet module is loading.
  assertCurrent();

  const rate = context.sampleRate;
  const analyser = context.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.minDecibels = -100;
  analyser.maxDecibels = 0;
  // The graph's own value, and for the same reason: see useLiveOutputSpectrum.
  analyser.smoothingTimeConstant = 0.2;

  // Two channels always, as the drawings hear them (`connectSoundAnalysers`):
  // a single one spread to both, more than two folded down as speakers fold
  // them.
  const input = context.createGain();
  input.channelCount = 2;
  input.channelCountMode = 'explicit';
  input.channelInterpretation = 'speakers';
  const tap = new AudioWorkletNode(context, CAPTURE_PROCESSOR, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  // Silent, and connected all the way to the destination: a node the graph
  // does not pull toward an output is not guaranteed to be processed at all.
  const mute = context.createGain();
  mute.gain.value = 0;
  source.connect(analyser);
  source.connect(input);
  input.connect(tap);
  tap.connect(mute);
  mute.connect(context.destination);
  // Blocks of about a hop: the frame made at a block is at most that late.
  const blockFrames = blockFramesAt(rate);
  const blocks = new MessageChannel();
  tap.port.postMessage({ kind: 'attach', port: blocks.port1, blockFrames }, [
    blocks.port1,
  ]);

  const historySize = soundHistorySamples(rate);
  const left = new Float32Array(historySize);
  const right = new Float32Array(historySize);
  const hearing = createSoundHearing(rate);
  const tickFrames = Math.round(rate / LIGHTING_TICKS_PER_SECOND);

  const makeFrame = createLampFrameMaker(rate, accent, analyser, () =>
    hearing.music(),
  );
  let closed = false;
  /** Frames of sound handed over so far, and where the last picture was made. */
  let heardFrames = 0;
  let framedAt = 0;
  let nextTick = tickFrames;
  /**
   * The fewest frames the audio thread has ever been ahead of this page: the
   * handover itself and the delivery. A part-filled block and the clock's
   * render quantum add up to a block more on time; two blocks more, and a
   * newer block is waiting behind this one.
   */
  let handover: number | undefined;
  /** The first frame put off for a waiting block, and how far behind it was. */
  let skipped: { at: number; ahead: number } | undefined;

  blocks.port2.onmessage = ({ data }: MessageEvent<unknown>) => {
    const block = closed ? undefined : readCaptureBlock(data);
    if (!block) {
      return;
    }
    keepNewestSamples(left, right, block);
    heardFrames += block.frames;
    hearing.update(left, right, (heardFrames / rate) * 1_000);
    const ahead = Math.round(context.currentTime * rate) - heardFrames;
    handover = handover === undefined ? ahead : Math.min(handover, ahead);
    if (heardFrames < nextTick) {
      return;
    }
    while (nextTick <= heardFrames) {
      nextTick += tickFrames;
    }
    if (ahead - handover > 2 * blockFrames) {
      skipped ??= { at: heardFrames, ahead };
      // A backlog is worked through block by block, each nearer the audio
      // than the last. A distance that has held for a second of sound is
      // not one: the tap counted nothing while its source was silent to it,
      // and this is where the handover is now. Without this the lamps would
      // wait on a backlog that will never clear.
      const held =
        heardFrames - skipped.at >= rate && skipped.ahead - ahead < blockFrames;
      if (!held) {
        return;
      }
      handover = ahead;
    }
    skipped = undefined;
    const deltaMs = ((heardFrames - framedAt) / rate) * 1_000;
    framedAt = heardFrames;
    onHeard(makeFrame(deltaMs, isPaused()));
  };

  /**
   * Each connection this made, and only those: the capture's source feeds the
   * graph and the meters too. A capture that stopped first has already
   * disconnected its source from everything, and the browser answers a second
   * disconnect with InvalidAccessError — which here means the work is done.
   */
  const disconnect = (from: AudioNode, to?: AudioNode) => {
    try {
      if (to) {
        from.disconnect(to);
      } else {
        from.disconnect();
      }
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
      blocks.port2.onmessage = null;
      blocks.port2.close();
      // A processor that keeps answering `true` is kept alive by its
      // context; told to close, it answers `false` once and goes.
      tap.port.postMessage({ kind: 'close' });
      disconnect(source, analyser);
      disconnect(source, input);
      disconnect(input);
      disconnect(tap);
      disconnect(mute);
    },
  };
};
