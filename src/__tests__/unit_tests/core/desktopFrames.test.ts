/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A desktop background's frame, made in the core the way the window's
 * drawing reader made one for a background: due only when more audio has
 * been heard, measured against the track's own loudest bin, which falls by
 * its release over the audio heard and never by how often it is asked.
 */
import {
  LIVE_FULL_SCALE_DB,
  POINT_COUNT,
  TRACK_REFERENCE_RELEASE_DB,
  UPDATE_INTERVAL_MS,
  WAVEFORM_POINT_COUNT,
} from 'common/liveFrames';
import { createDesktopFrameReader } from 'core/liveFrames/desktopFrames';
import {
  SIGNAL_RATE,
  analyserSignal,
  signalBlocks,
} from '../../utils/analyserSignal';

const loudest = (points: { y: number }[]) =>
  points.reduce((top, point) => Math.max(top, point.y), -Infinity);

describe('a desktop background’s frame', () => {
  it('is silence until something is heard', () => {
    const reader = createDesktopFrameReader();
    const frame = reader.read();

    expect(frame.points).toEqual([]);
    expect(frame.waveform).toHaveLength(WAVEFORM_POINT_COUNT);
    expect(frame.waveform.every((sample) => sample === 0)).toBe(true);
    expect(frame.stereo).toBeUndefined();
  });

  it('draws the music against its own loudest bin', () => {
    const reader = createDesktopFrameReader();
    signalBlocks(analyserSignal(), 0, 4096).forEach((block) =>
      reader.analyser.push(block),
    );
    const frame = reader.read();

    expect(frame.points).toHaveLength(POINT_COUNT);
    expect(loudest(frame.points)).toBeLessThanOrEqual(LIVE_FULL_SCALE_DB);
    expect(loudest(frame.points)).toBeGreaterThan(LIVE_FULL_SCALE_DB - 6);
    // The 440 Hz tone is the loudest thing in the signal.
    const top = frame.points.find((point) => point.y === loudest(frame.points));
    expect(top?.x).toBeGreaterThan(400);
    expect(top?.x).toBeLessThan(480);
  });

  it('leans to the louder side, and has a waveform of its peaks', () => {
    const reader = createDesktopFrameReader();
    signalBlocks(analyserSignal(), 0, 4096).forEach((block) =>
      reader.analyser.push(block),
    );
    const frame = reader.read();

    // The left carries a tone twice the right's.
    expect(frame.stereo?.[0]).toBeLessThan(-0.1);
    expect(frame.stereo?.[1]).toBeGreaterThan(0);
    expect(Math.max(...frame.waveform)).toBeGreaterThan(0.5);
  });

  it('hands back the same frame until more audio is heard', () => {
    const reader = createDesktopFrameReader();
    const blocks = signalBlocks(analyserSignal(), 0, 6000);
    blocks.slice(0, 10).forEach((block) => reader.analyser.push(block));
    const first = reader.read();
    const firstPoints = first.points.map((point) => point.y);
    // Asked again with nothing new: no second average, same numbers.
    expect(reader.read().points.map((point) => point.y)).toEqual(firstPoints);

    blocks.slice(10).forEach((block) => reader.analyser.push(block));
    expect(reader.read().points.map((point) => point.y)).not.toEqual(
      firstPoints,
    );
  });

  it('lets the reference fall by the audio heard, not by how often it is asked', () => {
    // A steady 1 kHz tone, 20 dB quieter after the first 4096 frames: every
    // window of the quiet part reads the same, so only the reference moves
    // the points.
    const READ_FRAMES = 1600;
    const tone = (from: number, frames: number, gain: number) => {
      const pcm = new Float32Array(frames * 2);
      for (let frame = 0; frame < frames; frame += 1) {
        const sample = Math.fround(
          gain * Math.sin((2 * Math.PI * 1000 * (from + frame)) / SIGNAL_RATE),
        );
        pcm[frame * 2] = sample;
        pcm[frame * 2 + 1] = sample;
      }
      return {
        sampleRate: SIGNAL_RATE,
        channels: 2,
        frames,
        sequence: 0,
        pcm: pcm.buffer,
      };
    };
    const readAcross = (asksPerRead: number) => {
      const reader = createDesktopFrameReader();
      reader.analyser.push(tone(0, 4096, 1));
      reader.read();
      const tops: number[] = [];
      // Two seconds of the quiet part, read every 1600 frames, the first
      // reads let go of while the loud part leaves the window.
      for (let read = 0; read < 60; read += 1) {
        reader.analyser.push(tone(4096 + read * READ_FRAMES, READ_FRAMES, 0.1));
        for (let ask = 0; ask < asksPerRead; ask += 1) {
          tops.push(loudest(reader.read().points));
        }
      }
      return tops.filter((_top, index) => index % asksPerRead === 0);
    };

    const once = readAcross(1);
    // From the fifth read on the window holds the quiet part alone.
    const settled = once.slice(5);
    expect(settled[0]).toBeLessThan(LIVE_FULL_SCALE_DB - 18);
    // A decibel per second of audio, so 1600 frames' worth per read.
    const perRead =
      (TRACK_REFERENCE_RELEASE_DB * (READ_FRAMES / SIGNAL_RATE) * 1000) /
      UPDATE_INTERVAL_MS;
    const risen = settled[settled.length - 1] - settled[0];
    expect(risen).toBeCloseTo(perRead * (settled.length - 1), 2);
    // Asked five times as often over the same audio: the same frames.
    expect(readAcross(5)).toEqual(once);
  });

  it('has no stereo image for one channel', () => {
    const reader = createDesktopFrameReader();
    const pcm = new Float32Array(4096).map((_value, n) =>
      Math.sin((2 * Math.PI * 440 * n) / SIGNAL_RATE),
    );
    reader.analyser.push({
      sampleRate: SIGNAL_RATE,
      channels: 1,
      frames: 4096,
      sequence: 0,
      pcm: pcm.buffer,
    });
    const frame = reader.read();

    expect(frame.stereo).toBeUndefined();
    expect(frame.points).toHaveLength(POINT_COUNT);
  });
});
