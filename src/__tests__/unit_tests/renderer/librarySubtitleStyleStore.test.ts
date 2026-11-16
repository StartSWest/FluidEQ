/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { DEFAULT_SUBTITLE_STYLE } from 'common/library/subtitleStyle';
import { SETTING_STEMS } from 'renderer/utils/settingsReset';

/**
 * The captions' style, kept per viewer under one key: written on every
 * change, read back by the next window, still changing for the session
 * when storage refuses, and forgotten by Reset settings. Moving the
 * captions is never kept.
 */

type TStore = typeof import('renderer/library/subtitleStyleStore');
type TTesting = typeof import('@testing-library/react');

/**
 * A window as it loads: the store with nothing read yet, and React and its
 * testing library from the same fresh registry, so the store's hooks run on
 * the React they were loaded with.
 */
const freshWindow = (): { store: TStore; testing: TTesting } => {
  let loaded: { store: TStore; testing: TTesting } | undefined;
  jest.isolateModules(() => {
    loaded = {
      // eslint-disable-next-line global-require -- a fresh module per window, which only `isolateModules` gives
      store: require('renderer/library/subtitleStyleStore') as TStore,
      // eslint-disable-next-line global-require -- the same registry's React, or its hooks are another React's
      testing: require('@testing-library/react') as TTesting,
    };
  });
  if (loaded === undefined) {
    throw new Error('the window did not load');
  }
  return loaded;
};

const KEY = 'fluideq.library.subtitleStyle';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('the captions’ kept style', () => {
  it('is written under its key on every change, the rest kept', () => {
    const { store } = freshWindow();
    store.updateSubtitleStyle({ size: 'l' });
    store.updateSubtitleStyle({ colour: 'cyan' });
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? '{}')).toEqual({
      ...DEFAULT_SUBTITLE_STYLE,
      size: 'l',
      colour: 'cyan',
    });
  });

  it('is read back by the next window', () => {
    freshWindow().store.updateSubtitleStyle({
      background: 'box',
      position: { x: 0.3, y: 0.2 },
    });
    const { store, testing } = freshWindow();
    const { result, unmount } = testing.renderHook(() =>
      store.useSubtitleStyle(),
    );
    expect(result.current).toEqual({
      ...DEFAULT_SUBTITLE_STYLE,
      background: 'box',
      position: { x: 0.3, y: 0.2 },
    });
    unmount();
  });

  it('starts at the default with nothing kept (the control)', () => {
    const { store, testing } = freshWindow();
    const { result, unmount } = testing.renderHook(() =>
      store.useSubtitleStyle(),
    );
    expect(result.current).toEqual(DEFAULT_SUBTITLE_STYLE);
    unmount();
  });

  it('re-renders its readers on a change', () => {
    const { store, testing } = freshWindow();
    const { result, unmount } = testing.renderHook(() =>
      store.useSubtitleStyle(),
    );
    testing.act(() => store.updateSubtitleStyle({ enabled: false }));
    expect(result.current.enabled).toBe(false);
    unmount();
  });

  it('still changes for the session when storage refuses', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('refused');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const { store, testing } = freshWindow();
    const { result, unmount } = testing.renderHook(() =>
      store.useSubtitleStyle(),
    );
    expect(result.current).toEqual(DEFAULT_SUBTITLE_STYLE);
    testing.act(() => store.updateSubtitleStyle({ colour: 'green' }));
    expect(result.current.colour).toBe('green');
    unmount();
  });

  it('is forgotten by Reset settings, with the language the next film opens in', () => {
    expect(SETTING_STEMS).toContain(KEY);
    expect(SETTING_STEMS).toContain('fluideq.library.subtitleLanguage');
  });
});

describe('moving the captions', () => {
  it('is heard by every reader and never kept', () => {
    const { store, testing } = freshWindow();
    const { result, unmount } = testing.renderHook(() =>
      store.useCaptionsMoving(),
    );
    expect(result.current).toBe(false);
    testing.act(() => store.setCaptionsMoving(true));
    expect(result.current).toBe(true);
    expect(window.localStorage.length).toBe(0);
    unmount();
    // A fresh window starts with the captions put down.
    const next = freshWindow();
    const { result: again, unmount: done } = next.testing.renderHook(() =>
      next.store.useCaptionsMoving(),
    );
    expect(again.current).toBe(false);
    done();
  });
});
