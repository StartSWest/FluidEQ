/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { sceneEnergyFixtureSample } from 'common/sceneEnergyFixture';
import { HOP_MS, soundHistorySamples } from 'common/soundHops';
import { createCoreAnalyser } from '../../core/liveFrames/analyser';
import { keepNewestSamples } from '../audio/captureBlocks';
import { createSoundHearing } from '../graph/liveSound';
import { FFT_SIZE } from '../graph/liveSpectrumFrames';
import { createLampFrameMaker, type ILampAnalyser } from './lampFrames';
import { LIGHTING_TICKS_PER_SECOND } from './lightingSceneMessages';

/**
 * The frames the lamps' scene is handed, as the window makes them, written
 * by `generate-sound-hops-fixture.ts` into `native/scene-core/tests/
 * lamp_frame_fixture.h` for `lamp_frame_parity_test.cpp`: this window's own
 * frame maker (`lampFrames.ts`) on the clone of Chromium's analyser the core
 * hears with, fed the energy fixture's song as the listener is fed — a
 * block of a hop at a time, the hearing given each channel's newest history,
 * a frame at every thirtieth of a second of audio.
 *
 * The song starts at once, so the first frame hears only the newest hop as
 * the window's does and its first sound has no loudest yet; it falls silent
 * for a second near its end, longer than the analyser's window, so frames of
 * true silence are in it; and the lamps are paused for a second and a half
 * in the middle, where they hold what they showed and fall further behind
 * the music than the hops a listener keeps, which they hear as time lost.
 */

export const LAMP_FRAME_RATE = 48_000;
const SONG_SECONDS = 12;
/** The second of the song that is silence, from and to. */
export const LAMP_FRAME_SILENCE: readonly [number, number] = [10, 11];
/** Blocks (of a hop each) during which the lamps are paused. */
export const LAMP_FRAME_PAUSED_BLOCKS: readonly [number, number] = [700, 850];
/** Every this many frames, the texels too. */
export const LAMP_FRAME_TEXELS_EVERY = 6;

/** The song's sample `n`, or silence in its silent second. */
const sampleAt = (n: number): [number, number] =>
  n >= LAMP_FRAME_SILENCE[0] * LAMP_FRAME_RATE &&
  n < LAMP_FRAME_SILENCE[1] * LAMP_FRAME_RATE
    ? [0, 0]
    : sceneEnergyFixtureSample(n, LAMP_FRAME_RATE);

/** A double as C++ reads it back exactly: JavaScript's shortest round trip. */
const cDouble = (value: number) => {
  const text = String(value);
  return text.includes('.') || text.includes('e') ? text : `${text}.0`;
};

interface IFrameRow {
  scalars: number[];
  spectrum?: Uint8Array;
  waveform?: Uint8Array;
}

const frames = (): IFrameRow[] => {
  const rate = LAMP_FRAME_RATE;
  const blockFrames = Math.round((rate * HOP_MS) / 1000);
  const total = SONG_SECONDS * rate;
  const core = createCoreAnalyser(FFT_SIZE, FFT_SIZE);
  const left = new Float32Array(FFT_SIZE);
  const right = new Float32Array(FFT_SIZE);
  // Chromium's node with the graph's smoothing, its input folded to mono as
  // a node's is.
  const analyser: ILampAnalyser = {
    getFloatFrequencyData: (target) => core.readFrequency(target, 0.2),
    getFloatTimeDomainData: (target) => {
      core.readChannel(0, left);
      core.readChannel(1, right);
      for (let at = 0; at < target.length; at += 1) {
        target[at] = 0.5 * (left[at] + right[at]);
      }
    },
  };
  const hearing = createSoundHearing(rate);
  const make = createLampFrameMaker(rate, [0, 0.9, 0.8], analyser, () =>
    hearing.music(),
  );
  const historySize = soundHistorySamples(rate);
  const heardLeft = new Float32Array(historySize);
  const heardRight = new Float32Array(historySize);
  const tickFrames = Math.round(rate / LIGHTING_TICKS_PER_SECOND);
  const rows: IFrameRow[] = [];
  let heardFrames = 0;
  let framedAt = 0;
  let nextTick = tickFrames;
  for (let block = 0; heardFrames < total; block += 1) {
    const pcm = new Float32Array(blockFrames * 2);
    for (let frame = 0; frame < blockFrames; frame += 1) {
      const [l, r] = sampleAt(heardFrames + frame);
      pcm[frame * 2] = l;
      pcm[frame * 2 + 1] = r;
    }
    core.push({
      sampleRate: rate,
      channels: 2,
      frames: blockFrames,
      sequence: block,
      pcm: pcm.buffer,
    });
    keepNewestSamples(heardLeft, heardRight, {
      channels: 2,
      frames: blockFrames,
      pcm,
    });
    heardFrames += blockFrames;
    hearing.update(heardLeft, heardRight, (heardFrames / rate) * 1000);
    if (heardFrames >= nextTick) {
      while (nextTick <= heardFrames) {
        nextTick += tickFrames;
      }
      const deltaMs = ((heardFrames - framedAt) / rate) * 1000;
      framedAt = heardFrames;
      const paused =
        block >= LAMP_FRAME_PAUSED_BLOCKS[0] &&
        block < LAMP_FRAME_PAUSED_BLOCKS[1];
      const { frame, silent } = make(deltaMs, paused);
      const keepTexels = rows.length % LAMP_FRAME_TEXELS_EVERY === 0;
      rows.push({
        scalars: [
          deltaMs,
          frame.timeSeconds,
          frame.fade,
          frame.level,
          frame.beat,
          frame.bands[0],
          frame.bands[1],
          frame.bands[2],
          silent ? 1 : 0,
        ],
        ...(keepTexels
          ? {
              spectrum: Uint8Array.from(frame.spectrum),
              waveform: Uint8Array.from(frame.waveform),
            }
          : {}),
      });
    }
  }
  return rows;
};

export const lampFrameFixture = (): string => {
  const rows = frames();
  const kept = rows.filter((row) => row.spectrum && row.waveform);
  return [
    '// Written by .erb/scripts/generate-sound-hops-fixture.ts from',
    '// src/renderer/lighting/lampFrameFixture.ts. Do not edit; regenerate.',
    '#pragma once',
    '',
    '#include <cstdint>',
    '',
    'namespace feq::scene::fixture {',
    '',
    `inline constexpr double kLampFrameRate = ${cDouble(LAMP_FRAME_RATE)};`,
    `inline constexpr int kLampFrameSilentFrom = ${LAMP_FRAME_SILENCE[0]};`,
    `inline constexpr int kLampFrameSilentTo = ${LAMP_FRAME_SILENCE[1]};`,
    `inline constexpr int kLampFrameSongSeconds = ${SONG_SECONDS};`,
    `inline constexpr int kLampFramePausedFrom = ${LAMP_FRAME_PAUSED_BLOCKS[0]};`,
    `inline constexpr int kLampFramePausedTo = ${LAMP_FRAME_PAUSED_BLOCKS[1]};`,
    `inline constexpr int kLampFrameTexelsEvery = ${LAMP_FRAME_TEXELS_EVERY};`,
    '',
    '// delta ms, time s, fade, level, beat, bass, mid, treble, silent.',
    'inline constexpr double kLampFrames[][9] = {',
    ...rows.map((row) => `    {${row.scalars.map(cDouble).join(', ')}},`),
    '};',
    '',
    '// Every kLampFrameTexelsEvery-th frame: the spectrum, then the waveform.',
    `inline constexpr std::uint8_t kLampSpectra[][512] = {`,
    ...kept.map((row) => `    {${[...(row.spectrum ?? [])].join(', ')}},`),
    '};',
    `inline constexpr std::uint8_t kLampWaveforms[][128] = {`,
    ...kept.map((row) => `    {${[...(row.waveform ?? [])].join(', ')}},`),
    '};',
    '',
    '}  // namespace feq::scene::fixture',
    '',
  ].join('\n');
};
