/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type RefObject, useEffect, useState } from 'react';
import { type IFilmCue, filmCueAt } from './featureFilms';

/**
 * The line a film's voice is saying now, for the subtitle under it: read
 * once a painted frame while the film is shown, because `timeupdate` comes
 * four times a second and would land a line late. What's New's player and
 * Help's both draw it.
 */
export default function useFilmLine(
  video: RefObject<HTMLVideoElement | null>,
  cues: readonly IFilmCue[],
  isShown: boolean,
): IFilmCue | undefined {
  const [cue, setCue] = useState<IFilmCue | undefined>();
  useEffect(() => {
    if (!isShown) {
      return undefined;
    }
    let frame = 0;
    const follow = () => {
      const element = video.current;
      if (element) {
        const next = filmCueAt(cues, element.currentTime);
        setCue((shown) => (shown === next ? shown : next));
      }
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [video, cues, isShown]);
  return cue;
}
