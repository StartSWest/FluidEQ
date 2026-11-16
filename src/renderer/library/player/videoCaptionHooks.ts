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

import { useEffect, useMemo, useState } from 'react';
import {
  cuesAt,
  type ISubtitleCue,
  longestCueMs,
} from '../../../common/library/subtitleCues';
import { containedPicture } from '../../../common/library/subtitleStyle';

const NO_CUES: readonly ISubtitleCue[] = [];

const sameCues = (
  a: readonly ISubtitleCue[],
  b: readonly ISubtitleCue[],
): boolean =>
  a.length === b.length && a.every((cue, index) => cue === b[index]);

/**
 * The cues on screen, decided at every frame of the film the screen shows
 * (`requestVideoFrameCallback`): the caption changes with the picture it
 * belongs to, not at the next of the four clock readings a second the
 * player publishes, which would put a line up to a quarter of a second late.
 * Paused, no frame is shown, so the element's own `seeked` and `timeupdate`
 * events carry a jump or a scrub. Nothing runs on a clock.
 */
export const useActiveCues = (
  video: HTMLVideoElement | null,
  cues: readonly ISubtitleCue[],
): readonly ISubtitleCue[] => {
  const longest = useMemo(() => longestCueMs(cues), [cues]);
  const [active, setActive] = useState<readonly ISubtitleCue[]>(NO_CUES);

  useEffect(() => {
    if (video === null || cues.length === 0) {
      setActive(NO_CUES);
      return undefined;
    }
    const update = () => {
      const showing = cuesAt(cues, video.currentTime * 1000, longest);
      setActive((held) => (sameCues(held, showing) ? held : showing));
    };
    update();
    video.addEventListener('seeked', update);
    video.addEventListener('timeupdate', update);
    // Chromium has it; a test's DOM does not, and the events above still
    // keep the captions right there.
    const hasFrames = 'requestVideoFrameCallback' in video;
    let frame = 0;
    const onFrame = () => {
      update();
      frame = video.requestVideoFrameCallback(onFrame);
    };
    if (hasFrames) {
      frame = video.requestVideoFrameCallback(onFrame);
    }
    return () => {
      video.removeEventListener('seeked', update);
      video.removeEventListener('timeupdate', update);
      if (hasFrames) {
        video.cancelVideoFrameCallback(frame);
      }
    };
  }, [video, cues, longest]);

  return active;
};

export interface IPictureRect {
  left: number;
  top: number;
  width: number;
  height: number;
  /** The stage's height under the picture: the letterbox below it. */
  below: number;
}

const sameRect = (a: IPictureRect | undefined, b: IPictureRect): boolean =>
  a !== undefined &&
  a.left === b.left &&
  a.top === b.top &&
  a.width === b.width &&
  a.height === b.height &&
  a.below === b.below;

/**
 * Where the film's picture is inside its `<video>`, measured when the
 * element is resized (a pane opened, full screen) and when the film's own
 * size becomes known (`loadedmetadata`, and `resize`, which a stream that
 * changes resolution fires). `alignTop` mirrors the stylesheet: the tab
 * hangs the picture from the bar, full screen centres it.
 */
export const usePictureRect = (
  video: HTMLVideoElement | null,
  alignTop: boolean,
): IPictureRect | undefined => {
  const [rect, setRect] = useState<IPictureRect | undefined>(undefined);

  useEffect(() => {
    if (video === null) {
      setRect(undefined);
      return undefined;
    }
    const measure = () => {
      const box = { width: video.clientWidth, height: video.clientHeight };
      const picture = containedPicture(
        box,
        { width: video.videoWidth, height: video.videoHeight },
        alignTop,
      );
      const next = {
        ...picture,
        below: Math.max(0, box.height - picture.top - picture.height),
      };
      setRect((held) => (sameRect(held, next) ? held : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(video);
    video.addEventListener('loadedmetadata', measure);
    video.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      video.removeEventListener('loadedmetadata', measure);
      video.removeEventListener('resize', measure);
    };
  }, [video, alignTop]);

  return rect;
};
