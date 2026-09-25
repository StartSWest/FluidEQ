/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The chord analysis yields between batches, and used to yield on an
 * animation frame: in a minimised window, which runs none, it parked mid-song
 * holding the song's samples until the window came back.
 */

import { MessageChannel as NodeMessageChannel } from 'worker_threads';
import {
  analyzeKaraokeChords,
  KARAOKE_CHORD_ANALYSIS_SAMPLE_RATE,
} from 'common/karaoke/chords';

beforeEach(() => {
  Object.assign(globalThis, { MessageChannel: NodeMessageChannel });
  // A window that paints nothing.
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
});

afterEach(() => {
  jest.restoreAllMocks();
  Reflect.deleteProperty(globalThis, 'MessageChannel');
});

it('finishes a song in a window that paints nothing, yielding after every batch', async () => {
  const rate = KARAOKE_CHORD_ANALYSIS_SAMPLE_RATE;
  const samples = Float32Array.from({ length: rate * 3 }, (_, index) =>
    [130.813, 164.814, 195.998].reduce(
      (sum, frequency) =>
        sum + Math.sin((2 * Math.PI * frequency * index) / rate) * 0.18,
      0,
    ),
  );
  const chords = await analyzeKaraokeChords(samples, rate, {
    framesPerYield: 1,
  });
  expect(chords[0]).toMatchObject({ label: 'C', quality: 'major' });
});
