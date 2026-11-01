/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The core's tap on the sound before FluidEQ touches it: a frame for every
 * window of new audio and never sooner, the Library through its host's rack
 * input at the host's rate, and a tap that cannot open or goes away said so.
 */
import { ANALYSIS_BINS, type IHostAnalysis } from 'common/dsp/analysisWire';
import type { ILanRemoteAudioChunk } from 'common/remoteAudio';
import { SENDER_SPECTRUM_SIZE } from 'common/senderSpectrum';
import type { IRawSourceFrame } from 'common/smartEqMeasurement';
import {
  type IRawSourceTaps,
  openRawSourceFrames,
} from 'main/smartEq/rawSourceFrames';

const RATE = 48000;
const CHUNK_FRAMES = 480;

const tone = (sequence: number): ILanRemoteAudioChunk => {
  const pcm = new Float32Array(CHUNK_FRAMES * 2);
  for (let frame = 0; frame < CHUNK_FRAMES; frame += 1) {
    const value =
      0.5 *
      Math.sin((2 * Math.PI * 1000 * (sequence * CHUNK_FRAMES + frame)) / RATE);
    pcm[frame * 2] = value;
    pcm[frame * 2 + 1] = value;
  }
  return {
    peerId: 'local',
    sequence,
    sampleRate: RATE,
    channels: 2,
    frames: CHUNK_FRAMES,
    pcm: pcm.buffer,
  } as ILanRemoteAudioChunk;
};

const setUp = (host?: Promise<(() => void) | undefined>) => {
  const process = {
    audio: (_chunk: ILanRemoteAudioChunk) => undefined as void,
    fail: () => undefined as void,
    close: jest.fn(),
  };
  let hostListener: ((analysis: IHostAnalysis) => void) | undefined;
  let rate = RATE;
  const taps: IRawSourceTaps = {
    startProcessCapture: (onAudio, onFailure) => {
      process.audio = onAudio;
      process.fail = onFailure;
      return Promise.resolve({ close: process.close });
    },
    listenToHost: (listener) => {
      hostListener = listener;
      return host ?? Promise.resolve(() => undefined);
    },
    hostSampleRate: () => rate,
  };
  const frames: IRawSourceFrame[] = [];
  const lost: string[] = [];
  const open = (kind: 'host' | 'process') =>
    openRawSourceFrames(taps, {
      kind,
      onFrame: (frame) => frames.push(frame),
      onLost: (reason) => lost.push(reason),
    });
  return {
    open,
    process,
    frames,
    lost,
    hearHost: (analysis: IHostAnalysis) => hostListener?.(analysis),
    setRate: (next: number) => {
      rate = next;
    },
  };
};

it('sends a frame once a whole window of new audio has arrived, and not before', async () => {
  const { open, process, frames } = setUp();
  await open('process');
  const perWindow = SENDER_SPECTRUM_SIZE / CHUNK_FRAMES;
  let sequence = 0;
  while (sequence < Math.ceil(perWindow) - 1) {
    process.audio(tone(sequence));
    sequence += 1;
  }
  expect(frames).toHaveLength(0);
  process.audio(tone(sequence));
  sequence += 1;
  expect(frames).toHaveLength(1);
  expect(frames[0].sampleRate).toBe(RATE);
  // The loudest point is the tone's, near 1 kHz.
  const loudest = frames[0].levels.indexOf(Math.max(...frames[0].levels));
  expect(frames[0].axis[loudest]).toBeGreaterThan(900);
  expect(frames[0].axis[loudest]).toBeLessThan(1100);
  // The next one needs a whole window more.
  process.audio(tone(sequence));
  expect(frames).toHaveLength(1);
});

it('says the process tap went away once, and stops on close', async () => {
  const { open, process, lost, frames } = setUp();
  const close = await open('process');
  process.fail();
  process.fail();
  expect(lost).toEqual(['eq.smart.error.noSource']);
  for (let sequence = 0; sequence < 40; sequence += 1) {
    process.audio(tone(sequence));
  }
  expect(frames).toHaveLength(0);
  close();
  expect(process.close).toHaveBeenCalledTimes(1);
});

it('hears the Library at the rack’s input, at the host’s rate', async () => {
  const { open, frames, hearHost, setRate } = setUp();
  await open('host');
  const denoise = new Float32Array(ANALYSIS_BINS).fill(-60);
  hearHost({ spectra: { denoise } } as unknown as IHostAnalysis);
  expect(frames).toHaveLength(1);
  expect(frames[0].sampleRate).toBe(RATE);
  // Another stage's window, or no rate yet, is nothing to measure.
  hearHost({ spectra: { eq: denoise } } as unknown as IHostAnalysis);
  setRate(0);
  hearHost({ spectra: { denoise } } as unknown as IHostAnalysis);
  expect(frames).toHaveLength(1);
});

it('refuses a host that cannot send its frames', async () => {
  const { open } = setUp(Promise.resolve(undefined));
  await expect(open('host')).rejects.toThrow('eq.smart.error.noSource');
});

it('calls a capture that cannot start no source, whatever the helper said', async () => {
  const frames = openRawSourceFrames(
    {
      startProcessCapture: () =>
        Promise.reject(new Error('The system audio capture stopped.')),
      listenToHost: () => Promise.resolve(undefined),
      hostSampleRate: () => 48000,
    },
    { kind: 'process', onFrame: jest.fn(), onLost: jest.fn() },
  );
  await expect(frames).rejects.toThrow('eq.smart.error.noSource');
});
