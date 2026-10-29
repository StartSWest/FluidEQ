/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The karaoke workspace's remembered choices: playlist grouped by folder,
// the pitch guide and the stage background, each kept in this
// window's local storage, and whether the stage opens with its pitch lane.

import { useSyncExternalStore } from 'react';

const backgroundListeners = new Set<() => void>();
const subscribeBackground = (listener: () => void) => {
  backgroundListeners.add(listener);
  return () => {
    backgroundListeners.delete(listener);
  };
};

export const STAGE_PITCH_MEDIA_QUERY = '(min-width: 1120px)';

const PLAYLIST_FOLDER_GROUPING_KEY = 'fluideq-karaoke-playlist-group-by-folder';

const PITCH_GUIDE_VISIBILITY_KEY = 'fluideq-karaoke-pitch-guide-visible';

const STAGE_ART_VISIBILITY_KEY = 'fluideq-karaoke-stage-art-visible';

const STAGE_BACKGROUND_KEY = 'fluideq-karaoke-stage-background';

export type TKaraokeBackground = 'cover' | 'graph' | 'none';

export const readKaraokePlaylistFolderGrouping = (): boolean => {
  try {
    return window.localStorage.getItem(PLAYLIST_FOLDER_GROUPING_KEY) === 'true';
  } catch {
    return false;
  }
};

export const writeKaraokePlaylistFolderGrouping = (enabled: boolean): void => {
  try {
    window.localStorage.setItem(PLAYLIST_FOLDER_GROUPING_KEY, String(enabled));
  } catch {
    // Keep the live preference when storage is unavailable.
  }
};

export const readPitchGuideVisibility = (): boolean => {
  try {
    return window.localStorage.getItem(PITCH_GUIDE_VISIBILITY_KEY) !== 'false';
  } catch {
    return true;
  }
};

export const writePitchGuideVisibility = (visible: boolean): void => {
  try {
    window.localStorage.setItem(PITCH_GUIDE_VISIBILITY_KEY, String(visible));
  } catch {
    // Keep the live preference when storage is unavailable.
  }
};

export const readKaraokeBackground = (): TKaraokeBackground => {
  try {
    const saved = window.localStorage.getItem(STAGE_BACKGROUND_KEY);
    if (saved === 'cover' || saved === 'graph' || saved === 'none') {
      return saved;
    }
    // Keep the old art switch's choice when upgrading to three backgrounds.
    return window.localStorage.getItem(STAGE_ART_VISIBILITY_KEY) === 'false'
      ? 'none'
      : 'cover';
  } catch {
    return 'cover';
  }
};

export const writeKaraokeBackground = (
  background: TKaraokeBackground,
): void => {
  try {
    window.localStorage.setItem(STAGE_BACKGROUND_KEY, background);
  } catch {
    // Keep the live preference when storage is unavailable.
  }
};

let shownBackground: TKaraokeBackground | undefined;

/** The stage publishes after commit, not from its state updater. */
export const publishKaraokeBackgroundChoice = (
  background: TKaraokeBackground,
) => {
  shownBackground = background;
  backgroundListeners.forEach((listener) => listener());
};

const getShownBackground = () => shownBackground ?? readKaraokeBackground();

export const useKaraokeBackgroundChoice = () =>
  useSyncExternalStore(
    subscribeBackground,
    getShownBackground,
    () => 'cover' as const,
  );

export const initiallyUseStagePitch = (): boolean =>
  typeof window.matchMedia !== 'function' ||
  window.matchMedia(STAGE_PITCH_MEDIA_QUERY).matches;
