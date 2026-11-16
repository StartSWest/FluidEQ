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

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { subtitleLanguage } from '../../common/library/subtitles';
import { readPersistedText, writePersistedText } from './libraryWorkspacePrefs';

/** The language last picked, so the next film opens in it. */
const SUBTITLE_LANGUAGE_KEY = 'fluideq.library.subtitleLanguage';

/**
 * Which subtitle file each video plays with this session, ONE answer for
 * every place that asks: the Subtitles tab picks, the captions over the
 * picture and the full-screen menu follow, and a pick in either is the
 * other's at once. A module store, as the style is (`subtitleStyleStore`),
 * because the tab and the stage are far apart in the tree.
 */
const pickedByVideo = new Map<string, string>();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Picks a video's subtitle file, and remembers its language for the next
 * film (a file that names none forgets it). */
export const chooseSubtitle = (
  videoId: string,
  fileName: string,
  tag: string | undefined,
): void => {
  pickedByVideo.set(videoId, fileName);
  writePersistedText(SUBTITLE_LANGUAGE_KEY, subtitleLanguage(tag));
  listeners.forEach((listener) => listener());
};

export interface ISubtitleChoice {
  /** The file picked for this video, or nothing: main then picks. */
  wanted: string | undefined;
  /** The languages to open in when nothing is picked: the last one picked,
   * then the app's own. */
  preferred: readonly string[];
  choose: (fileName: string, tag: string | undefined) => void;
}

export const useSubtitleChoice = (
  videoId: string,
  locale: string,
): ISubtitleChoice => {
  const wanted = useSyncExternalStore(subscribe, () =>
    pickedByVideo.get(videoId),
  );
  // Read once per video: it only matters before anything is picked, and a
  // pick then speaks for itself (`useTrackSubtitles` keys by the pick).
  const preferred = useMemo(() => {
    const remembered = readPersistedText(SUBTITLE_LANGUAGE_KEY);
    return remembered === undefined || remembered === locale
      ? [locale]
      : [remembered, locale];
  }, [locale]);
  const choose = useCallback(
    (fileName: string, tag: string | undefined) =>
      chooseSubtitle(videoId, fileName, tag),
    [videoId],
  );
  return { wanted, preferred, choose };
};
