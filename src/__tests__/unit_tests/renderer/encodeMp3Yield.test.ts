/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * An MP3 encode giving the window its turns.
 *
 * It yielded with a zero-delay `setTimeout`, which a hidden window runs once a
 * second at best: a four-minute stem, about 140 yields, took minutes behind a
 * minimised window. It yields with a posted task now (`nextTask`), which comes
 * next whether anything is painted or not, and at once when cancelled.
 */

import { encodeChannelsAsMp3 } from '../../../renderer/karaoke/makerSeparation/encodeMp3';

// LAME itself is not what is measured here, only how the loop around it waits.
jest.mock('@breezystack/lamejs', () => ({
  Mp3Encoder: jest.fn(() => ({
    encodeBuffer: () => new Uint8Array(4),
    flush: () => new Uint8Array(0),
  })),
}));

/** Enough samples for two yields: one every 64 blocks of 1152. */
const samples = () => new Float32Array(1_152 * 130);

describe('encoding a stem as MP3', () => {
  it('yields between batches without a timer', async () => {
    const timers = jest.spyOn(window, 'setTimeout');
    const progress: number[] = [];
    try {
      const file = await encodeChannelsAsMp3(
        samples(),
        undefined,
        44_100,
        'stem.mp3',
        { onProgress: (fraction) => progress.push(fraction) },
      );
      // The control: both yields were reached, and then the end.
      expect(progress).toHaveLength(3);
      expect(progress[2]).toBe(1);
      expect(file.size).toBeGreaterThan(0);
      expect(timers).not.toHaveBeenCalled();
    } finally {
      timers.mockRestore();
    }
  });

  it('stops at the first yield once cancelled', async () => {
    const controller = new AbortController();
    const progress: number[] = [];
    await expect(
      encodeChannelsAsMp3(samples(), undefined, 44_100, 'stem.mp3', {
        signal: controller.signal,
        onProgress: (fraction) => {
          progress.push(fraction);
          controller.abort();
        },
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(progress).toHaveLength(1);
  });
});
