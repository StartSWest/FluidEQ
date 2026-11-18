/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The karaoke workspace's remembered choices: playlist grouped by folder,
// what the stage shows under the words (pitch, chords or words only) and
// what stands behind them, each kept in this window's local storage.

import { useSyncExternalStore } from 'react';

const backgroundListeners = new Set<() => void>();
const subscribeBackground = (listener: () => void) => {
  backgroundListeners.add(listener);
  return () => {
    backgroundListeners.delete(listener);
  };
};

const PLAYLIST_FOLDER_GROUPING_KEY = 'fluideq-karaoke-playlist-group-by-folder';

const PITCH_GUIDE_VISIBILITY_KEY = 'fluideq-karaoke-pitch-guide-visible';

const STAGE_ART_VISIBILITY_KEY = 'fluideq-karaoke-stage-art-visible';

const STAGE_BACKGROUND_KEY = 'fluideq-karaoke-stage-background';

/** The one choice of three the guides were before they were toggles. */
const STAGE_GUIDES_KEY = 'fluideq-karaoke-stage-guides';

const STAGE_GUIDES_SHOWN_KEY = 'fluideq-karaoke-stage-guides-shown';

/**
 * What stands behind the words: the app's scene, the song's picture, the
 * song's video, or the bare stage. `cover` is the picture alone since the
 * stage's toolbar offered Art and Video apart (Ivan, 2026-11-15, "K1"); it
 * used to mean "the video, or the picture when there is none".
 */
export type TKaraokeBackground = 'cover' | 'video' | 'graph' | 'none';

/**
 * What the stage shows under the words: the pitch lane and the chords, each
 * on or off by itself (Ivan, 2026-11-18: "make these buttons toggles so they
 * can choose which to see"). They were one choice of three - the chords over
 * the lane, the chords alone, or neither. The words are not a choice: "it is
 * a karaoke".
 */
export const STAGE_GUIDES = ['pitch', 'chords'] as const;
export type TKaraokeStageGuide = (typeof STAGE_GUIDES)[number];
export type TKaraokeStageGuides = Readonly<Record<TKaraokeStageGuide, boolean>>;

const ALL_GUIDES: TKaraokeStageGuides = { pitch: true, chords: true };

/** What the old one choice showed under the words. */
const guidesOfChoice = (choice: string | null): TKaraokeStageGuides => {
  if (choice === 'chords') {
    return { pitch: false, chords: true };
  }
  if (choice === 'words') {
    return { pitch: false, chords: false };
  }
  return ALL_GUIDES;
};

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

/**
 * The guides shown, written as the names of those on (`pitch,chords`; an
 * empty list is both off). Read from the old one choice where there
 * is nothing newer, and before that from the pitch guide's switch.
 */
export const readKaraokeStageGuides = (): TKaraokeStageGuides => {
  try {
    const shown = window.localStorage.getItem(STAGE_GUIDES_SHOWN_KEY);
    if (shown !== null) {
      const names = shown.split(',');
      return {
        pitch: names.includes('pitch'),
        chords: names.includes('chords'),
      };
    }
    const choice = window.localStorage.getItem(STAGE_GUIDES_KEY);
    if (choice !== null) {
      return guidesOfChoice(choice);
    }
    // The pitch guide's old switch: a lane switched off kept the chords,
    // which were always drawn.
    return guidesOfChoice(
      window.localStorage.getItem(PITCH_GUIDE_VISIBILITY_KEY) === 'false'
        ? 'chords'
        : 'pitch',
    );
  } catch {
    return ALL_GUIDES;
  }
};

export const writeKaraokeStageGuides = (guides: TKaraokeStageGuides): void => {
  try {
    window.localStorage.setItem(
      STAGE_GUIDES_SHOWN_KEY,
      STAGE_GUIDES.filter((guide) => guides[guide]).join(','),
    );
  } catch {
    // Keep the live preference when storage is unavailable.
  }
};

export const readKaraokeBackground = (): TKaraokeBackground => {
  try {
    const saved = window.localStorage.getItem(STAGE_BACKGROUND_KEY);
    if (
      saved === 'cover' ||
      saved === 'video' ||
      saved === 'graph' ||
      saved === 'none'
    ) {
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
