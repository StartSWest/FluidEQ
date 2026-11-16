/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * A film leaving the tab takes the window out of full screen with it (Ivan,
 * 2026-11-15: "when going back while on fullscreen it needs to exit
 * fullscreen"). Only a film that was there and went: a window put full
 * screen over the shelf, with no film ever on it, is the viewer's to leave.
 */

import { renderHook } from '@testing-library/react';
import useVideoFullScreenExit from 'renderer/library/useVideoFullScreenExit';

interface IProps {
  videoTrackId: string | undefined;
  isFullScreen: boolean;
}

const mount = (initial: IProps) => {
  const toggle = jest.fn();
  const hook = renderHook(
    ({ videoTrackId, isFullScreen }: IProps) =>
      useVideoFullScreenExit(videoTrackId, isFullScreen, toggle),
    { initialProps: initial },
  );
  return { toggle, rerender: hook.rerender };
};

describe('a film leaving in full screen', () => {
  it('takes the window out of full screen once', () => {
    const { toggle, rerender } = mount({
      videoTrackId: 'film',
      isFullScreen: true,
    });
    expect(toggle).not.toHaveBeenCalled();
    rerender({ videoTrackId: undefined, isFullScreen: true });
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('leaves a window that is not full screen alone', () => {
    const { toggle, rerender } = mount({
      videoTrackId: 'film',
      isFullScreen: false,
    });
    rerender({ videoTrackId: undefined, isFullScreen: false });
    expect(toggle).not.toHaveBeenCalled();
  });

  it('leaves full screen alone while a film is still on the tab', () => {
    const { toggle, rerender } = mount({
      videoTrackId: 'film',
      isFullScreen: true,
    });
    // The queue moving on to the next film is not the film leaving.
    rerender({ videoTrackId: 'next film', isFullScreen: true });
    expect(toggle).not.toHaveBeenCalled();
  });
});

describe('full screen with no film ever on the tab', () => {
  it('is left alone, entered or not', () => {
    const { toggle, rerender } = mount({
      videoTrackId: undefined,
      isFullScreen: false,
    });
    rerender({ videoTrackId: undefined, isFullScreen: true });
    rerender({ videoTrackId: undefined, isFullScreen: true });
    expect(toggle).not.toHaveBeenCalled();
  });

  it('is not left after the film that left has already taken it out', () => {
    const { toggle, rerender } = mount({
      videoTrackId: 'film',
      isFullScreen: true,
    });
    rerender({ videoTrackId: undefined, isFullScreen: true });
    rerender({ videoTrackId: undefined, isFullScreen: false });
    // The viewer puts the shelf full screen again on their own.
    rerender({ videoTrackId: undefined, isFullScreen: true });
    expect(toggle).toHaveBeenCalledTimes(1);
  });
});
