/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * Captions are placed on the film's picture, which is only known once the
 * film's own size is. Measured against the whole element before then, a
 * caption stood at the stage's foot and slid up to the picture once the
 * metadata came (Ivan, 2026-11-15: "they need to show in that position, not
 * animate to go there"). Until the size is known there is no rect, so nothing
 * is drawn; from then on, the picture's.
 */

import { act, renderHook } from '@testing-library/react';
import { usePictureRect } from 'renderer/library/player/videoCaptionHooks';

/** A `<video>` laid out at 1000x1000 whose film size is set by the test;
 * jsdom lays nothing out and never loads a film. */
const videoElement = (film: { width: number; height: number }) => {
  const video = document.createElement('video');
  const size = { ...film };
  Object.defineProperties(video, {
    clientWidth: { configurable: true, get: () => 1000 },
    clientHeight: { configurable: true, get: () => 1000 },
    videoWidth: { configurable: true, get: () => size.width },
    videoHeight: { configurable: true, get: () => size.height },
  });
  return {
    video,
    /** The film's size becomes known, as the element tells it. */
    load: (width: number, height: number) => {
      size.width = width;
      size.height = height;
      video.dispatchEvent(new Event('loadedmetadata'));
    },
  };
};

describe('the picture a caption stands on', () => {
  it('is nothing while the film’s size is unknown', () => {
    const { video } = videoElement({ width: 0, height: 0 });
    const { result } = renderHook(() => usePictureRect(video, false));
    expect(result.current).toBeUndefined();
  });

  it('is the picture inside the letterbox once the size is known', () => {
    // The control: the same element with its film's size known is measured.
    const { video } = videoElement({ width: 1920, height: 1080 });
    const { result } = renderHook(() => usePictureRect(video, false));
    expect(result.current).toEqual({
      left: 0,
      top: 218.75,
      width: 1000,
      height: 562.5,
      below: 218.75,
    });
  });

  it('appears when the metadata arrives, already at the picture', () => {
    const { video, load } = videoElement({ width: 0, height: 0 });
    const { result } = renderHook(() => usePictureRect(video, true));
    expect(result.current).toBeUndefined();
    act(() => load(1920, 1080));
    // Hung from the bar: the letterbox is all below the picture.
    expect(result.current).toEqual({
      left: 0,
      top: 0,
      width: 1000,
      height: 562.5,
      below: 437.5,
    });
  });

  it('is nothing with no element', () => {
    const { result } = renderHook(() => usePictureRect(null, false));
    expect(result.current).toBeUndefined();
  });
});
