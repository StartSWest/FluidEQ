/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ILibraryScanProgress } from '../../../common/library/types';
import { gateScanProgress } from '../../../main/library/scanProgressGate';

const report = (over: Partial<ILibraryScanProgress>): ILibraryScanProgress => ({
  rootId: 'r1',
  seen: 0,
  parsed: 0,
  karaokeSkipped: 0,
  isDone: false,
  ...over,
});

describe('which scan reports cross to another process', () => {
  it('carries a small share of an unchanged library’s reports, its first and last among them', () => {
    const sent: ILibraryScanProgress[] = [];
    const gate = gateScanProgress((progress) => sent.push(progress));
    // Fourteen thousand songs in fourteen hundred album folders, every one
    // unchanged: one report per file in each phase, as the walk makes them.
    let seen = 0;
    for (let folder = 0; folder < 1400; folder += 1) {
      for (let file = 0; file < 10; file += 1) {
        seen += 1;
        gate.progress(report({ seen, current: `Album ${folder}` }));
      }
    }
    for (let parsed = 1; parsed <= seen; parsed += 1) {
      gate.progress(report({ seen, parsed, current: `${parsed}.flac` }));
    }
    gate.progress(report({ seen, parsed: seen, isDone: true }));

    // It used to be every one of them: twenty-eight thousand messages.
    expect(sent.length).toBeLessThan((seen * 2) / 10);
    expect(sent[0]).toMatchObject({ seen: 1, parsed: 0 });
    expect(sent[sent.length - 1]).toMatchObject({ parsed: seen, isDone: true });
    // Every folder the walk entered was named while discovering.
    expect(
      new Set(sent.filter((entry) => entry.parsed === 0).map((e) => e.current))
        .size,
    ).toBe(1400);
    // Parsing started, and every whole percent was shown on the way.
    const percents = new Set(
      sent
        .filter((entry) => entry.parsed > 0)
        .map((entry) => Math.floor((entry.parsed * 100) / entry.seen)),
    );
    expect(percents.size).toBe(101);
  });

  it('carries every report of a walk slow enough to send a batch of tracks per file', () => {
    // The control for the one above: a large video, a network share -- each
    // file flushes a batch of its own, and each is shown as it finishes.
    const sent: ILibraryScanProgress[] = [];
    const gate = gateScanProgress((progress) => sent.push(progress));
    gate.progress(report({ seen: 5000, current: 'Films' }));
    for (let parsed = 1; parsed <= 20; parsed += 1) {
      gate.tracksSent();
      gate.progress(report({ seen: 5000, parsed, current: `${parsed}.mkv` }));
    }
    expect(sent.map((entry) => entry.parsed)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ]);
  });

  it('never holds a large folder still for more than a few dozen files', () => {
    const sent: ILibraryScanProgress[] = [];
    const gate = gateScanProgress((progress) => sent.push(progress));
    for (let seen = 1; seen <= 1000; seen += 1) {
      gate.progress(report({ seen, current: 'Everything' }));
    }
    const gaps = sent
      .slice(1)
      .map((entry, place) => entry.seen - sent[place].seen);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(32);
  });
});
