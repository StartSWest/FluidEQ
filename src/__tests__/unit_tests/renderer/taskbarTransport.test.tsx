/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, render, renderHook } from '@testing-library/react';
import {
  ITaskbarTransportState,
  TTaskbarTransportAction,
} from 'common/taskbarTransport';
import { ILibraryTrack } from 'common/library/types';
import TaskbarTransport from '../../../renderer/audio/TaskbarTransport';
import {
  resetPlaybackOwner,
  TPlaybackOwner,
} from '../../../renderer/audio/playbackOwner';
import {
  clearTransportSource,
  ITransportSource,
  resetTransportSource,
  setTransportSource,
} from '../../../renderer/audio/transportSource';
import usePublishedTransport from '../../../renderer/library/player/usePublishedTransport';

const originalElectron = window.electron;
let listener: ((action: TTaskbarTransportAction) => void) | undefined;
let published: ITaskbarTransportState[];
let actions: string[];
const source = (
  owner: TPlaybackOwner,
  isPlaying = false,
): ITransportSource => ({
  owner,
  title: owner,
  isPlaying,
  positionMs: 0,
  durationMs: 1000,
  toggle: () => actions.push(`${owner}:toggle`),
  previous: () => actions.push(`${owner}:previous`),
  next: () => actions.push(`${owner}:next`),
});
const latest = () => published[published.length - 1];

beforeEach(() => {
  resetPlaybackOwner();
  resetTransportSource();
  published = [];
  actions = [];
  listener = undefined;
  window.electron = {
    platform: 'win32',
    ipcRenderer: {
      setTaskbarTransport: async (state: ITaskbarTransportState) => {
        published.push(state);
      },
      onTaskbarTransport: (next: typeof listener) => {
        listener = next;
        return () => {
          listener = undefined;
        };
      },
    },
  } as unknown as typeof window.electron;
});
afterEach(() => {
  window.electron = originalElectron;
  resetPlaybackOwner();
  resetTransportSource();
});

it('disables an empty toolbar and releases its listener on unmount', () => {
  const view = render(<TaskbarTransport />);
  expect(latest()).toMatchObject({
    canToggle: false,
    canNext: false,
    canPrevious: false,
  });
  act(() => setTransportSource(source('media')));
  expect(latest().canToggle).toBe(true);
  view.unmount();
  expect(listener).toBeUndefined();
  expect(latest().canToggle).toBe(false);
});

it.each<TPlaybackOwner>(['library', 'karaoke', 'media', 'remote'])(
  'follows the %s bar and refreshes callbacks without redrawing for position ticks',
  (owner) => {
    setTransportSource(source(owner));
    const view = render(<TaskbarTransport tabOwner={owner} />);
    act(() => {
      listener?.('previous');
      listener?.('toggle');
      listener?.('next');
    });
    expect(actions).toEqual([
      `${owner}:previous`,
      `${owner}:toggle`,
      `${owner}:next`,
    ]);
    const count = published.length;
    act(() =>
      setTransportSource({
        ...source(owner),
        positionMs: 250,
        toggle: () => actions.push('new callback'),
      }),
    );
    expect(published).toHaveLength(count);
    act(() => listener?.('toggle'));
    expect(actions[actions.length - 1]).toBe('new callback');
    view.unmount();
  },
);

it('follows the audible external player, then returns to the paused tab when it stops', () => {
  setTransportSource(source('library'));
  const view = render(<TaskbarTransport tabOwner="library" />);
  act(() =>
    setTransportSource({
      ...source('system', true),
      previous: undefined,
      next: undefined,
    }),
  );
  expect(latest()).toMatchObject({
    isPlaying: true,
    canNext: false,
    canPrevious: false,
  });
  act(() => {
    listener?.('toggle');
    listener?.('next');
  });
  expect(actions).toEqual(['system:toggle']);
  act(() => setTransportSource(source('system', false)));
  expect(latest().isPlaying).toBe(false);
  act(() => listener?.('toggle'));
  expect(actions).toEqual(['system:toggle', 'library:toggle']);
  act(() => clearTransportSource('library'));
  expect(latest().canToggle).toBe(false);
  view.unmount();
});

it('keeps a paused remote sender available to resume and follows tab changes', () => {
  setTransportSource(source('remote'));
  const view = render(<TaskbarTransport />);
  act(() => listener?.('toggle'));
  act(() => setTransportSource(source('karaoke')));
  view.rerender(<TaskbarTransport tabOwner="karaoke" />);
  act(() => listener?.('toggle'));
  expect(actions).toEqual(['remote:toggle', 'karaoke:toggle']);
  view.unmount();
});

it('uses Library queue commands and disables play for an unplayable track', () => {
  const player = renderHook(
    ({ isUnplayable }) =>
      usePublishedTransport({
        track: { id: 'song', title: 'Song', artist: 'Artist' } as ILibraryTrack,
        isPlaying: false,
        retainWhenHidden: false,
        publishedPositionMs: 0,
        publishedDurationMs: 1000,
        toggle: () => actions.push('play'),
        skip: (direction) => actions.push(`skip:${direction}`),
        seek: () => undefined,
        isUnplayable,
      }),
    { initialProps: { isUnplayable: false } },
  );
  const view = render(<TaskbarTransport tabOwner="library" />);
  act(() => {
    listener?.('previous');
    listener?.('next');
  });
  expect(actions).toEqual(['skip:-1', 'skip:1']);
  player.rerender({ isUnplayable: true });
  expect(latest().canToggle).toBe(false);
  act(() => listener?.('toggle'));
  expect(actions).toHaveLength(2);
  view.unmount();
  player.unmount();
});

it('does not register or publish Windows controls on other platforms', () => {
  window.electron = { ...window.electron, platform: 'darwin' };
  const view = render(<TaskbarTransport />);
  expect(listener).toBeUndefined();
  expect(published).toHaveLength(0);
  view.unmount();
});
