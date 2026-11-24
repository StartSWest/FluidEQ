/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { PHASE_SPAN_MS } from 'renderer/graph/analysis/phaseView';
import {
  loudestStretch,
  STILL_SECONDS,
  stillSecondsOf,
} from 'renderer/graph/lookStillSong';

/**
 * Where a look picker's still is drawn in the demo song (`lookStillSong.ts`):
 * its loudest stretch, so no still pictures a look at rest over a quiet
 * intro - and every look hears enough of it to fill its history.
 */

const RATE = 1000;

/** A song of `seconds`, quiet but for `loud` seconds from `from`. */
const song = (seconds: number, from: number, loud: number) => {
  const samples = new Float32Array(seconds * RATE);
  for (let at = 0; at < samples.length; at += 1) {
    const time = at / RATE;
    samples[at] = time >= from && time < from + loud ? 0.8 : 0.01;
  }
  return {
    sampleRate: RATE,
    length: samples.length,
    numberOfChannels: 2,
    getChannelData: () => samples,
  } as unknown as AudioBuffer;
};

it('starts the still where the song is loudest', () => {
  expect(loudestStretch(song(20, 11, STILL_SECONDS))).toBe(11);
});

it('starts at the top of a song that is level throughout', () => {
  // The control: nothing louder anywhere, so nothing to move to.
  expect(loudestStretch(song(20, 0, 0))).toBe(0);
});

it('starts at the top of a song shorter than a still', () => {
  expect(loudestStretch(song(2, 1, 1))).toBe(0);
});

it('lets Phase history hear its whole strip, and the rest a few seconds', () => {
  expect(stillSecondsOf('phase')).toBe(PHASE_SPAN_MS / 1000);
  expect(stillSecondsOf('analyzer')).toBe(STILL_SECONDS);
  expect(stillSecondsOf('spectrogram')).toBe(STILL_SECONDS);
});
