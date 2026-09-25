/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { act, renderHook } from '@testing-library/react';
import { useIdlePlayerMount } from '../../../renderer/audio/useIdlePlayerMount';
import {
  claimPlayback,
  releasePlayback,
  resetPlaybackOwner,
} from '../../../renderer/audio/playbackOwner';
import {
  resetTransportSource,
  setTransportSource,
} from '../../../renderer/audio/transportSource';

/**
 * Every timer this replaced would still be pending here. A helper, so the
 * check can run after each test without being an `expect` in a hook.
 */
const expectNothingScheduled = () => expect(jest.getTimerCount()).toBe(0);

/**
 * The window put away and brought back, as the page sees it. jsdom's
 * `visibilityState` is a getter on the prototype, so the document gets its own
 * for these tests and gives it back after.
 */
let visibility: DocumentVisibilityState = 'visible';
const setVisibility = (next: DocumentVisibilityState) => {
  visibility = next;
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

beforeAll(() => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  });
});

afterAll(() => {
  Reflect.deleteProperty(document, 'visibilityState');
});

interface IProps {
  isActive: boolean;
  isPlaying: boolean;
  hasLoadedSource: boolean;
  page: string;
}

/** A loaded, silent Media player on its own tab, about to be left. */
const mountOnItsTab = (overrides: Partial<IProps> = {}) =>
  renderHook((props: IProps) => useIdlePlayerMount(props), {
    initialProps: {
      isActive: true,
      isPlaying: false,
      hasLoadedSource: true,
      page: 'video',
      ...overrides,
    },
  });

/** The machine's own player, starting or stopping. */
const systemPlays = (isPlaying: boolean) =>
  act(() => {
    setTransportSource({
      owner: 'system',
      title: 'A browser tab',
      isPlaying,
      positionMs: 0,
      durationMs: 0,
      toggle: () => undefined,
    });
  });

/**
 * A loaded, silent player left behind stays until the next thing that says its
 * user has moved on — never until a clock runs out.
 *
 * Every null here (still mounted) sits beside the positive control that lets
 * it go, so a hook that simply never let anything go could not pass, and every
 * test ends with nothing scheduled: the five-second lease this replaced was a
 * timer, and a timer is what these fail on.
 */
describe('a silent player left on another tab', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    visibility = 'visible';
    resetPlaybackOwner();
    resetTransportSource();
  });

  afterEach(() => {
    expectNothingScheduled();
    jest.useRealTimers();
  });

  it('stays for one page, however long it is looked at, and goes on the next', () => {
    const hook = mountOnItsTab();
    hook.rerender({
      isActive: false,
      isPlaying: false,
      hasLoadedSource: true,
      page: 'eq',
    });
    act(() => jest.advanceTimersByTime(60_000));
    expect(hook.result.current).toBe(true);

    hook.rerender({
      isActive: false,
      isPlaying: false,
      hasLoadedSource: true,
      page: 'presets',
    });
    expect(hook.result.current).toBe(false);
  });

  it('comes back when its own tab is opened again', () => {
    const hook = mountOnItsTab();
    hook.rerender({
      isActive: false,
      isPlaying: false,
      hasLoadedSource: true,
      page: 'eq',
    });
    hook.rerender({
      isActive: false,
      isPlaying: false,
      hasLoadedSource: true,
      page: 'presets',
    });
    expect(hook.result.current).toBe(false);

    hook.rerender({
      isActive: true,
      isPlaying: false,
      hasLoadedSource: true,
      page: 'video',
    });
    expect(hook.result.current).toBe(true);
  });

  it('goes when another of the app’s players starts, and not when one stops', () => {
    act(() => claimPlayback('library'));
    const hook = mountOnItsTab();
    hook.rerender({
      isActive: false,
      isPlaying: false,
      hasLoadedSource: true,
      page: 'eq',
    });
    // Already playing when this one was left: not news. Stopping: not news.
    act(() => releasePlayback('library'));
    expect(hook.result.current).toBe(true);

    act(() => claimPlayback('karaoke'));
    expect(hook.result.current).toBe(false);
  });

  it('goes when the machine’s own player starts, and not for one already playing', () => {
    systemPlays(true);
    const hook = mountOnItsTab();
    hook.rerender({
      isActive: false,
      isPlaying: false,
      hasLoadedSource: true,
      page: 'eq',
    });
    expect(hook.result.current).toBe(true);

    systemPlays(false);
    expect(hook.result.current).toBe(true);
    systemPlays(true);
    expect(hook.result.current).toBe(false);
  });

  it('goes when the window is put away, and not when it is shown', () => {
    const hook = mountOnItsTab();
    hook.rerender({
      isActive: false,
      isPlaying: false,
      hasLoadedSource: true,
      page: 'eq',
    });
    setVisibility('visible');
    expect(hook.result.current).toBe(true);

    setVisibility('hidden');
    expect(hook.result.current).toBe(false);
  });

  it('stays while it plays behind another tab, whatever happens around it', () => {
    const hook = mountOnItsTab();
    hook.rerender({
      isActive: false,
      isPlaying: true,
      hasLoadedSource: true,
      page: 'eq',
    });
    hook.rerender({
      isActive: false,
      isPlaying: true,
      hasLoadedSource: true,
      page: 'presets',
    });
    setVisibility('hidden');
    expect(hook.result.current).toBe(true);

    // The positive control: the same steps with it silent let it go.
    hook.rerender({
      isActive: false,
      isPlaying: false,
      hasLoadedSource: true,
      page: 'config',
    });
    hook.rerender({
      isActive: false,
      isPlaying: false,
      hasLoadedSource: true,
      page: 'games',
    });
    expect(hook.result.current).toBe(false);
  });

  it('drops an empty hidden player immediately and remounts on return', () => {
    const hook = mountOnItsTab({ isActive: false, hasLoadedSource: false });

    expect(hook.result.current).toBe(false);
    hook.rerender({
      isActive: true,
      isPlaying: false,
      hasLoadedSource: false,
      page: 'video',
    });
    expect(hook.result.current).toBe(true);
  });
});
