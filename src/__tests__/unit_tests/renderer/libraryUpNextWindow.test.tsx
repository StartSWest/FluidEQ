/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Up Next list mounts only the entries near its scrollport.
 *
 * It re-rendered on every scroll event to mount the rows it already had, and
 * worked the window out by walking the whole offset table from the top each
 * time. It now renders once per step of scrolling, and searches the table.
 */

import '@testing-library/jest-dom';
import { Profiler } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ILibraryTrack } from 'common/library/types';
import LibraryUpNext from 'renderer/library/LibraryUpNext';
import {
  ROW_HEIGHT,
  SCROLL_STEP,
  upNextWindowFor,
} from 'renderer/library/upNextWindow';

const mockTracks: ILibraryTrack[] = Array.from({ length: 200 }, (_, index) => ({
  id: `t${index}`,
  rootId: 'r1',
  path: `C:\\Music\\${index}.mp3`,
  kind: 'audio',
  isPlayable: true,
  title: `Song ${index}`,
  album: `Album ${Math.floor(index / 10)}`,
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
}));

// The queue's songs as the store has answered them: every one read.
jest.mock('renderer/library/useLibraryTracks', () => ({
  useLibraryTracks: () => new Map(mockTracks.map((track) => [track.id, track])),
}));

const mockUpNext = mockTracks.map((track, index) => ({
  position: index + 1,
  trackId: track.id,
  isAdded: false,
  isContinued: false,
}));

jest.mock('renderer/library/player/LibraryPlayerContext', () => ({
  useLibraryPlayerSession: () => ({
    upNext: mockUpNext,
    jumpToQueuePosition: () => undefined,
    removeUpNextAt: () => undefined,
    moveUpNext: () => undefined,
    isContinuationOn: false,
    setIsContinuationOn: () => undefined,
  }),
}));

describe('the window over the queue', () => {
  /** What the walk from the top used to answer, entry by entry. */
  const walked = (
    offsets: readonly number[],
    top: number,
    bottom: number,
  ): { start: number; end: number } => {
    let start = 0;
    while (start < offsets.length && offsets[start] + ROW_HEIGHT < top) {
      start += 1;
    }
    let end = start;
    while (end < offsets.length && offsets[end] < bottom) {
      end += 1;
    }
    return { start, end };
  };

  it('keeps every entry the scrollport can show, wherever inside a step it is', () => {
    // Sections, headings and rows, in the proportions a real queue has.
    const heights = Array.from({ length: 400 }, (_, index) => {
      if (index % 37 === 0) {
        return 32;
      }
      return index % 9 === 0 ? 26 : ROW_HEIGHT;
    });
    const offsets: number[] = [];
    let height = 0;
    heights.forEach((each) => {
      offsets.push(height);
      height += each;
    });
    const layout = { offsets, height };
    const pane = 600;
    for (let scrolled = 0; scrolled <= height - pane; scrolled += 37) {
      const step = Math.floor(scrolled / SCROLL_STEP) * SCROLL_STEP;
      const shown = upNextWindowFor(layout, pane, step);
      const needed = walked(offsets, scrolled, scrolled + pane);
      expect(shown.start).toBeLessThanOrEqual(needed.start);
      expect(shown.end).toBeGreaterThanOrEqual(needed.end);
    }
  });

  it('answers what the walk answered for the same offset, and more below', () => {
    const offsets = Array.from(
      { length: 300 },
      (_, index) => index * ROW_HEIGHT,
    );
    const layout = { offsets, height: 300 * ROW_HEIGHT };
    [0, 1, 2, 10, 20]
      .map((steps) => steps * SCROLL_STEP)
      .forEach((step) => {
        const shown = upNextWindowFor(layout, 600, step);
        const walk = walked(
          offsets,
          step - SCROLL_STEP,
          step + 600 + SCROLL_STEP,
        );
        expect(shown.start).toBe(walk.start);
        expect(shown.end).toBeGreaterThanOrEqual(walk.end);
      });
  });
});

it('renders once per step of scrolling, never once per scroll event', () => {
  let commits = 0;
  const { container } = render(
    <Profiler
      id="up-next"
      onRender={() => {
        commits += 1;
      }}
    >
      <LibraryUpNext canSurprise={false} />
    </Profiler>,
  );
  const list = container.querySelector('.library-up-next__list');
  if (!(list instanceof HTMLElement)) {
    throw new Error('The queue drew no list');
  }
  const settled = commits;
  [40, 120, 200, 250].forEach((scrollTop) => {
    list.scrollTop = scrollTop;
    fireEvent.scroll(list);
  });
  expect(commits).toBe(settled);
  // What the scrollport shows at 250 is mounted — the rows 250 to 750 px
  // down — and the window is still a window.
  expect(screen.getByText('Song 0')).toBeInTheDocument();
  expect(screen.getByText('Song 15')).toBeInTheDocument();
  expect(screen.queryByText('Song 22')).not.toBeInTheDocument();
  // Past the step, the window moves.
  list.scrollTop = 300;
  fireEvent.scroll(list);
  expect(commits).toBeGreaterThan(settled);
  expect(screen.getByText('Song 22')).toBeInTheDocument();
});
