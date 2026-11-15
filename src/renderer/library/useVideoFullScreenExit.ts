/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';

/**
 * A film leaving the tab takes the window out of full screen with it.
 *
 * Full screen over a video is the film's; with the film gone the window
 * stayed full screen over a shelf with no titlebar and no way back to the
 * rest of the app (Ivan, 2026-11-15: "when going back while on fullscreen it
 * needs to exit fullscreen"). Every way a film leaves - the picture's Back,
 * the bar's back arrow, a step of the place bar, the queue moving on - comes
 * through here, so none of them has to remember to do it.
 */
const useVideoFullScreenExit = (
  videoTrackId: string | undefined,
  isFullScreen: boolean,
  onToggleFullScreen: () => void,
): void => {
  const lastVideoRef = useRef(videoTrackId);
  const toggleRef = useRef(onToggleFullScreen);
  toggleRef.current = onToggleFullScreen;
  useEffect(() => {
    const hadVideo = lastVideoRef.current !== undefined;
    lastVideoRef.current = videoTrackId;
    if (hadVideo && videoTrackId === undefined && isFullScreen) {
      toggleRef.current();
    }
  }, [videoTrackId, isFullScreen]);
};

export default useVideoFullScreenExit;
