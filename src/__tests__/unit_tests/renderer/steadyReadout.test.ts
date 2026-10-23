/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The incoming delay as an average. Shown as every reading, it flickered
 * through a dozen values a second.
 */

import { createSteadyReadout } from 'renderer/remoteAudio/steadyReadout';

const BLOCK_MS = 20;
const blocks = (seconds: number) => (seconds * 1000) / BLOCK_MS;

/** A reading every block, the way they arrive; what the figure became, and
 * when. */
const run = (values: readonly number[]) => {
  const readout = createSteadyReadout();
  const shown: { figure: number; second: number }[] = [];
  values.forEach((value, index) => {
    const figure = readout.next(value, index * BLOCK_MS);
    if (figure !== undefined) {
      shown.push({ figure, second: (index * BLOCK_MS) / 1000 });
    }
  });
  return { readout, shown, last: shown[shown.length - 1]?.figure };
};

describe('a steady readout', () => {
  it('shows the first reading as it is', () => {
    expect(run([72]).shown).toEqual([{ figure: 72, second: 0 }]);
  });

  it('settles on the average of a delay that swings, and then holds still', () => {
    // Ten seconds of readings jumping between 60 and 84 around 72.
    const swinging = Array.from({ length: blocks(10) }, (_, index) =>
      index % 2 === 0 ? 60 : 84,
    );
    const { shown, last } = run(swinging);
    expect(Math.abs((last ?? 0) - 72)).toBeLessThan(3);
    // Settled within its first tenth of a second, and nothing after.
    expect(shown.filter((entry) => entry.second > 0.1)).toEqual([]);
  });

  it('follows a delay that really changes, within a few seconds', () => {
    const before = Array.from({ length: blocks(2) }, () => 70);
    const after = Array.from({ length: blocks(8) }, () => 120);
    const { shown, last } = run([...before, ...after]);
    expect(shown[0].figure).toBe(70);
    expect(last).toBeGreaterThanOrEqual(117);
    const arrived = shown.find((entry) => entry.figure >= 117);
    expect(arrived?.second).toBeLessThan(2 + 7);
  });

  it('moves the text only by whole steps worth reading', () => {
    const { shown } = run(
      Array.from({ length: blocks(6) }, (_, index) => 70 + index / 30),
    );
    expect(shown.length).toBeGreaterThan(2);
    shown.slice(1).forEach((entry, index) => {
      expect(
        Math.abs(entry.figure - shown[index].figure),
      ).toBeGreaterThanOrEqual(3);
    });
  });

  it('starts afresh once reset, showing the next reading as it is', () => {
    const { readout } = run([70, 70, 70]);
    readout.reset();
    expect(readout.next(140, 1_000)).toBe(140);
  });
});
