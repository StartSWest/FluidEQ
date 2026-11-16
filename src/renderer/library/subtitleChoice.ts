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
import {
  parseSubtitleMemory,
  serialiseSubtitleMemory,
  withoutSubtitleChoice,
  withSubtitleChoice,
} from '../../common/library/subtitleMemory';
import { subtitleLanguage } from '../../common/library/subtitles';
import { readPersistedText, writePersistedText } from './libraryWorkspacePrefs';

/** The language last picked, so a film with no choice of its own opens in
 * it. */
const SUBTITLE_LANGUAGE_KEY = 'fluideq.library.subtitleLanguage';

/** The file each video was last watched with (`subtitleMemory.ts`). */
export const SUBTITLE_BY_VIDEO_KEY = 'fluideq.library.subtitleByVideo';

/**
 * Which subtitle file each video plays with, ONE answer for every place
 * that asks: the Subtitles tab picks, the captions over the picture and the
 * full-screen menu follow, and a pick in either is the other's at once. A
 * module store, as the style is (`subtitleStyleStore`), because the tab and
 * the stage are far apart in the tree. Kept between sessions (Ivan,
 * 2026-11-15: "videos need to save the last used subs"); read from storage
 * on first use, and a storage that refuses leaves a memory for the session.
 */
let memory: Map<string, string> | undefined;
const listeners = new Set<() => void>();

const readMemory = (): Map<string, string> => {
  if (memory === undefined) {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(SUBTITLE_BY_VIDEO_KEY);
    } catch {
      // Storage refused: nothing is remembered from before.
    }
    memory = parseSubtitleMemory(raw);
  }
  return memory;
};

const keep = (next: Map<string, string>) => {
  memory = next;
  try {
    window.localStorage.setItem(
      SUBTITLE_BY_VIDEO_KEY,
      serialiseSubtitleMemory(next),
    );
  } catch {
    // Not worth failing a pick over: it lasts the session.
  }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Picks a video's subtitle file, remembered for that video, and its
 * language for films with no choice of their own (a file that names none
 * forgets that). */
export const chooseSubtitle = (
  videoId: string,
  fileName: string,
  tag: string | undefined,
): void => {
  writePersistedText(SUBTITLE_LANGUAGE_KEY, subtitleLanguage(tag));
  keep(withSubtitleChoice(readMemory(), videoId, fileName));
};

/** Forgets a video's choice: its file is gone, and main picks again. */
export const forgetSubtitleChoice = (videoId: string): void => {
  if (readMemory().has(videoId)) {
    keep(withoutSubtitleChoice(readMemory(), videoId));
  }
};

export interface ISubtitleChoice {
  /** The file picked for this video, or nothing: main then picks. A file
   * that has since gone is not found beside the video, and main picks. */
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
    readMemory().get(videoId),
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
