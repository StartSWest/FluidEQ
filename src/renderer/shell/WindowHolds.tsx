/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The holds the window's own players put on it (`useWindowHold.ts`): a web
 * player or Karaoke playing — their sound comes from this page — and the
 * Library while it plays on the page's own element (a video, or a song on a
 * machine without the native host). The Library heard from its host holds
 * nothing: main plays it, and main gives the engine its rack back when it
 * stops (`sourceAnalysis.ts`). Renders nothing.
 *
 * And the page's first word to main, said once everything mounted before it
 * has registered its own holds: effects run in the order things are mounted,
 * and this is mounted last.
 */
import { useEffect } from 'react';
import { usePlaybackOwner } from '../audio/playbackOwner';
import { useCorePlayerView } from '../library/player/corePlayer';
import { announceWindowHolds, useWindowHold } from './useWindowHold';

export default function WindowHolds() {
  const owner = usePlaybackOwner();
  const library = useCorePlayerView();
  useWindowHold('player', owner === 'media' || owner === 'karaoke');
  useWindowHold(
    'library-window',
    library.deck === 'window' && library.isPlaying,
  );
  useEffect(() => announceWindowHolds(), []);
  return null;
}
