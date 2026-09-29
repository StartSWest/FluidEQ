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
import {
  readRememberedTransportOwner,
  useHasTransportTitle,
  useIsTransportPlaying,
  useLastPlayingOwner,
  useLastTransportOwner,
  useTransportIdentitySources,
} from '../audio/transportSource';
import { useHasPendingKaraokeFiles } from '../library/karaokeHandoff';
import { useSceneLook } from '../utils/graphStyle';
import type { TWorkspaceTab } from '../workspaceTabs';

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
  const isDspTab = activeWorkspaceTab === 'dsp';
  const playingOwner = usePlaybackOwner();
  const transportIdentities = useTransportIdentitySources();

  // A Plus visualizer fills the graph edge to edge, so laid over a video it
  // only hides the picture. With one on the graph, the graph's full screen is
  // the visualizer alone and the video gets its own (see the double-click on
  // the video in App); the standard visualizers still draw over a playing
  // video, see-through and all (Ivan, 2026-09-21). Karaoke keeps its stage
  // under the graph: that is its lyrics, and it has no other full screen.
  const isSceneOnGraph = useSceneLook() !== null;
  // The song the transport holds, paused or not: the one playing, else the one
  // that played last and still describes the same song. Keyed to playing
  // alone, every pause took the picture away and left a black card. Worse on
  // Karaoke, where a lyric press pauses for its count-in: the stage stopped
  // being the backdrop, went hidden, hiding cancelled the count-in, and the
  // song never came back (Ivan, 2026-09-23: "it stops and get black").
  const lastPlayingOwner = useLastPlayingOwner();
  const heldOwner = playingOwner ?? lastPlayingOwner;
  /**
   * The machine's own player, when it is the one making the sound.
   *
   * It wins the backdrop over whatever of ours played LAST — a Library song
   * paused an hour ago is not the song Spotify is playing now — but never over
   * one of ours that is playing, and never over Karaoke's stage, which is its
   * lyrics and whose count-in dies if the stage is hidden (see above).
   */
  // Two flags, not the register: read whole, it changes with the position and
  // re-rendered this entire tree on every seek-bar tick while music played.
  const isSystemPlaying = useIsTransportPlaying('system');
  const hasSystemTitle = useHasTransportTitle('system');
  const isSystemSounding = playingOwner === undefined && isSystemPlaying;
  const graphBackdropOwner =
    isGraphBackdropMode &&
    (!isSceneOnGraph || heldOwner === 'karaoke') &&
    (!isSystemSounding || heldOwner === 'karaoke')
      ? heldOwner
      : undefined;
  const showsMediaGraphBackdrop = graphBackdropOwner === 'media';
  const showsLibraryGraphBackdrop = graphBackdropOwner === 'library';
  const showsKaraokeGraphBackdrop = graphBackdropOwner === 'karaoke';
  // The same picture for the machine's own song, when none of ours holds the
  // backdrop and the machine has a song to show (Ivan, 2026-09-23: "when doing
  // expanded mode or fullscreen on system audio we can show the covert art to
  // same as we do for libarery"). A Plus scene fills the graph edge to edge,
  // so it takes this picture's place just as it takes the Library's.
  const showsSystemGraphBackdrop =
    isGraphBackdropMode &&
    !isSceneOnGraph &&
    !showsMediaGraphBackdrop &&
    !showsLibraryGraphBackdrop &&
    !showsKaraokeGraphBackdrop &&
    hasSystemTitle;

  // Off its tab a player stays for as long as it plays, hands over, or is the
  // last thing played — see `keepsPlayerMounted`. The picture under an
  // expanded graph counts as seen: a paused song there is on screen, not
  // behind another tab, and unmounting it blacked the card out.
  const lastTransportOwner = useLastTransportOwner();
  const keepVideoMounted = keepsPlayerMounted({
    isActive: isVideoTab || showsMediaGraphBackdrop,
    isPlaying:
      playingOwner === 'media' || transportIdentities.media?.isPlaying === true,
    isHandingOver: transportIdentities.media?.retainWhenHidden === true,
    isLastOwner: lastTransportOwner === 'media',
  });
  const keepLibraryMounted = keepsPlayerMounted({
    // The native DSP engine lives in this provider as well. If it has already
    // been opened, the visible DSP rack is an active consumer even though the
    // Library shelf itself is not the selected tab. So is the amp's open
    // queue deck (`playerWantsLibrary`).
    isActive:
      isLibraryTab ||
      isDspTab ||
      playerWantsLibrary ||
      showsLibraryGraphBackdrop,
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
   * bringing up a browser engine and a karaoke session alongside the queue
   * somebody actually left would be three players restored to answer a
   * question about one. Each restores paused — the point is the transport
   * being there to press, not sound arriving unasked at launch.
   *
   * Held in state purely to be read once. The answer is a fact about how the
   * window opened; re-reading storage after that would be wasted work and
   * could change the value under flags which have already gone true.
   */
  const [restoredOwner] = useState(readRememberedTransportOwner);
  // Once visited, the Media tab is eligible to reconstruct its guest. A silent
  // hidden browser stays only while it is the last thing played.
  const [hasOpenedVideo, setHasOpenedVideo] = useState(
    () => restoredOwner === 'media',
  );
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
  const hasPendingKaraokeFiles = useHasPendingKaraokeFiles();
  useEffect(() => {
    if (!hasPendingKaraokeFiles) {
      return;
    }
    setHasOpenedKaraoke(true);
    selectTopWorkspaceTab('karaoke');
  }, [hasPendingKaraokeFiles, selectTopWorkspaceTab]);

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
    showsSystemGraphBackdrop,
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
