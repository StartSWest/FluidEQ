/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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

import { useCallback, useEffect, useState } from 'react';
import { albumKey } from '../../common/library/grouping';
import type { ILibraryTrack } from '../../common/library/types';
import { usePlaybackOwner } from '../audio/playbackOwner';
import keepsPlayerMounted from '../audio/playerMount';
import useSilenceHold, { MEDIA_SILENCE_HOLD_MS } from '../audio/useSilenceHold';
import {
  readRememberedTransportOwner,
  useLastTransportOwner,
  useTransportIdentitySources,
} from '../audio/transportSource';
import { useHasPendingKaraokeHandoff } from '../library/karaokeHandoff';
import { useSceneLook } from '../utils/graphStyle';
import type { TWorkspaceTab } from '../workspaceTabs';

/** The player whose picture a page's graph opens over. */
const PAGE_PICTURE: Partial<
  Record<TWorkspaceTab, 'karaoke' | 'library' | 'media'>
> = { karaoke: 'karaoke', library: 'library', video: 'media' };

export interface IPlayerMountsInput {
  activeWorkspaceTab: TWorkspaceTab;
  /** The graph expanded or full screen over the page, with a picture under. */
  isGraphBackdropMode: boolean;
  /** The amp's queue deck, which needs the Library's player mounted. */
  playerWantsLibrary: boolean;
  selectTopWorkspaceTab: (tab: TWorkspaceTab) => void;
}

/**
 * The three players — Media, Library, Karaoke — and when each is mounted off
 * its tab; and which of them, or the machine's own song, is the picture under
 * an expanded graph.
 */
const usePlayerMounts = ({
  activeWorkspaceTab,
  isGraphBackdropMode,
  playerWantsLibrary,
  selectTopWorkspaceTab,
}: IPlayerMountsInput) => {
  const isVideoTab = activeWorkspaceTab === 'video';
  const isLibraryTab = activeWorkspaceTab === 'library';
  const isKaraokeTab = activeWorkspaceTab === 'karaoke';
  const playingOwner = usePlaybackOwner();
  const transportIdentities = useTransportIdentitySources();

  // A Plus visualizer fills the graph edge to edge, so laid over a video it
  // only hides the picture. With one on the graph, the graph's full screen is
  // the visualizer alone and the video gets its own (see the double-click on
  // the video in App); the standard visualizers still draw over a playing
  // video, see-through and all (Ivan, 2026-09-21). Karaoke keeps its stage
  // under the graph: that is its lyrics, and it has no other full screen.
  const isSceneOnGraph = useSceneLook() !== null;
  /**
   * THE PAGE YOU ARE ON, NOT WHAT IS PLAYING (Ivan, 2026-11-16: "I double-click
   * the graph and it will open just the graph, not the lyrics ... depending on
   * where I click, I want to see that view, not whatever is playing"). Under
   * the graph goes the picture of the page it was opened from: the Karaoke's
   * stage on the Karaoke, the Library's picture on the Library, the video on
   * Online Media, and on every other page the graph alone, its own scene and
   * all. It used to be whatever played, or played last, wherever it was: from
   * the EQ page with a song on the Karaoke the graph opened over the lyrics,
   * and the Karaoke's stage, mounted for it, took the scene's stand-in and
   * drew no scene behind them either. The machine's own song lost its cover
   * here for the same rule: it has no page to be opened from.
   */
  const pageOwner = PAGE_PICTURE[activeWorkspaceTab];
  const graphBackdropOwner =
    isGraphBackdropMode &&
    pageOwner !== undefined &&
    (pageOwner === 'karaoke' || !isSceneOnGraph)
      ? pageOwner
      : undefined;
  const showsMediaGraphBackdrop = graphBackdropOwner === 'media';
  const showsLibraryGraphBackdrop = graphBackdropOwner === 'library';
  const showsKaraokeGraphBackdrop = graphBackdropOwner === 'karaoke';

  // Off its tab a player stays for as long as it plays, hands over, or is the
  // last thing played — see `keepsPlayerMounted`. The picture under an
  // expanded graph counts as seen: a paused song there is on screen, not
  // behind another tab, and unmounting it blacked the card out.
  const lastTransportOwner = useLastTransportOwner();
  const isMediaPlaying =
    playingOwner === 'media' || transportIdentities.media?.isPlaying === true;
  const isMediaHandingOver =
    transportIdentities.media?.retainWhenHidden === true;
  // The page that was just playing outlives the site's silence before its
  // next video — see `MEDIA_SILENCE_HOLD_MS`.
  const isMediaRecentlyHeard = useSilenceHold(
    isMediaPlaying || isMediaHandingOver,
    MEDIA_SILENCE_HOLD_MS,
  );
  const keepVideoMounted = keepsPlayerMounted({
    isActive: isVideoTab || showsMediaGraphBackdrop,
    isPlaying: isMediaPlaying,
    isHandingOver: isMediaHandingOver,
    isLastOwner: lastTransportOwner === 'media',
    isRecentlyHeard: isMediaRecentlyHeard,
  });
  const keepLibraryMounted = keepsPlayerMounted({
    // The amp's open queue deck is an active consumer (`playerWantsLibrary`).
    // The DSP tab is not, though the native DSP host lives in this provider:
    // the host only carries the rack for the Library's own songs, and while
    // one plays or was the last thing played the rules below keep it anyway.
    // Kept for the DSP tab as well, a silent Library and its host stayed in
    // memory there and nowhere else (Ivan, 2026-11-15: "DSP to Library shows
    // instant because we keep it in memory - we cannot"). With no host the
    // DSP page shows the state it shows before the Library is first opened.
    isActive: isLibraryTab || playerWantsLibrary || showsLibraryGraphBackdrop,
    isPlaying:
      playingOwner === 'library' ||
      transportIdentities.library?.isPlaying === true,
    isHandingOver: transportIdentities.library?.retainWhenHidden === true,
    isLastOwner: lastTransportOwner === 'library',
  });
  const keepKaraokeMounted = keepsPlayerMounted({
    isActive: isKaraokeTab || showsKaraokeGraphBackdrop,
    isPlaying:
      playingOwner === 'karaoke' ||
      transportIdentities.karaoke?.isPlaying === true,
    isHandingOver: transportIdentities.karaoke?.retainWhenHidden === true,
    isLastOwner: lastTransportOwner === 'karaoke',
  });

  /**
   * The player somebody was using when the window last closed.
   *
   * Each of the three below becomes eligible to mount on its first visit and
   * is disposed off its tab once it is silent and no longer the last thing
   * played. The tab is remembered but a disposed player is not live, so coming
   * back on the EQ, DSP or Config tab — which is most restarts — left every
   * player unmounted, nothing describing itself to the bar, and the foot of
   * the window reading "Nothing playing" over a queue that was sitting in
   * storage waiting to be resumed. What was missing was not the memory: the
   * library's queue, the karaoke session and the Media tab's page each restore
   * themselves perfectly well the moment they exist. Nobody was mounting them.
   *
   * One of them, not all three: this is "what was I last listening to", and
   * bringing up a karaoke session alongside the queue somebody actually left
   * would be two players restored to answer a question about one. Each
   * restores paused — the point is the transport being there to press, not
   * sound arriving unasked at launch.
   *
   * The Library or Karaoke only, never the Media tab: its page is not the
   * listener's own file, and mounted at launch it described itself on the bar
   * before anybody had touched the window — last night's video, by name, on
   * the first frame (`lastShown.ts`). It comes back to its page when its tab
   * is opened.
   *
   * Held in state purely to be read once. The answer is a fact about how the
   * window opened; re-reading storage after that would be wasted work and
   * could change the value under flags which have already gone true.
   */
  const [restoredOwner] = useState(readRememberedTransportOwner);
  // Once visited, the Media tab is eligible to reconstruct its guest. A silent
  // hidden browser stays only while it is the last thing played.
  const [hasOpenedVideo, setHasOpenedVideo] = useState(false);
  // Library follows the same eligibility rule. Its providers survive off-tab
  // while a deck is making sound, or while its queue is the last thing played.
  const [hasOpenedLibrary, setHasOpenedLibrary] = useState(
    () => restoredOwner === 'library',
  );
  // What the now-playing bar asked the Library to show. The nonce is what
  // makes pressing it twice for the same album work: an id alone would look
  // unchanged after the user had navigated away, and do nothing.
  const [libraryReveal, setLibraryReveal] = useState<
    { albumId: string; trackId: string; nonce: number } | undefined
  >(undefined);
  /** Opening the album was only half of "show me what is playing": it landed
   * the reader on the right page and left them to find the row, which on a
   * forty-track compilation is no answer at all. The track id travels with
   * the album so the list can scroll to that row and mark it. */
  const revealPlayingTrack = useCallback(
    (track: ILibraryTrack) => {
      selectTopWorkspaceTab('library');
      setLibraryReveal((current) => ({
        albumId: albumKey(track),
        trackId: track.id,
        nonce: (current?.nonce ?? 0) + 1,
      }));
    },
    [selectTopWorkspaceTab],
  );
  // Karaoke keeps a playing audio element across a tab switch. Its microphone,
  // canvases and editing tools belong to the visible tab and are discharged.
  const [hasOpenedKaraoke, setHasOpenedKaraoke] = useState(
    () => restoredOwner === 'karaoke',
  );

  /**
   * A song was sent over from the Library tab.
   *
   * App's whole share of the handoff is moving the reader and mounting the
   * destination; `KaraokeWorkspace` drains the queue itself. Both halves are
   * needed and neither is enough: without the mount there is nobody to drain
   * it, and without the switch the song arrives on a tab nobody is looking
   * at — a menu item that appears to have done nothing.
   *
   * The queue is what is watched rather than an event, so a file sent before
   * the workspace has ever been mounted still lands. See `karaokeHandoff.ts`.
   */
  const hasPendingKaraokeHandoff = useHasPendingKaraokeHandoff();
  useEffect(() => {
    if (!hasPendingKaraokeHandoff) {
      return;
    }
    setHasOpenedKaraoke(true);
    selectTopWorkspaceTab('karaoke');
  }, [hasPendingKaraokeHandoff, selectTopWorkspaceTab]);

  useEffect(() => {
    if (!isVideoTab) {
      return undefined;
    }

    setHasOpenedVideo(true);
    return undefined;
  }, [isVideoTab]);

  useEffect(() => {
    if (!isLibraryTab && !playerWantsLibrary) {
      return undefined;
    }

    setHasOpenedLibrary(true);
    return undefined;
  }, [isLibraryTab, playerWantsLibrary]);

  useEffect(() => {
    if (!isKaraokeTab) {
      return undefined;
    }

    setHasOpenedKaraoke(true);
    return undefined;
  }, [isKaraokeTab]);

  return {
    isSceneOnGraph,
    showsMediaGraphBackdrop,
    showsLibraryGraphBackdrop,
    showsKaraokeGraphBackdrop,
    keepVideoMounted,
    keepLibraryMounted,
    keepKaraokeMounted,
    hasOpenedVideo,
    hasOpenedLibrary,
    hasOpenedKaraoke,
    libraryReveal,
    revealPlayingTrack,
  };
};

export default usePlayerMounts;
