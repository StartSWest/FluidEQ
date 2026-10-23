/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo, useRef } from 'react';
import { useDspSettings } from '../dsp/store';
import { useSoundingGame } from '../games/useGameSound';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useOutputEditor } from '../utils/outputEditor';
import { useKnownAudioEngineStatus } from '../utils/useAudioEngineStatus';
import { useNowPlayingIdentity } from './nowPlayingIdentity';
import {
  feedSongSound,
  holdSongSound,
  registerSongSoundHost,
  returnLeftoverSongSound,
} from './songSoundSession';
import songSoundOf from './songSoundOf';
import { useTransportSources } from './transportSource';

/**
 * Tells the song sound memory (`songSoundSession.ts`) what plays, what is
 * heard and that time passes, and draws nothing.
 *
 * A component of its own beside the notices rather than a hook in the
 * window's root: it reads the bands, which change with every step of a band
 * being dragged, and every position a player reports, several a second — a
 * redraw of nothing here, of the whole window there.
 *
 * The output is told before the sound it brings, by the order of the effects
 * below and of the window's own updates (the output's id lands a render
 * before main's state does): a song filed as an output switch closes it must
 * be filed with the sound heard on the output it was played on.
 */
const SongSoundHost = () => {
  const { isLoading, filters, tone, voicing, eqFormat, refreshState } =
    useFluidEqContext();
  const { editor } = useOutputEditor();
  const rack = useDspSettings();
  const status = useKnownAudioEngineStatus();
  const { identity, isPlaying } = useNowPlayingIdentity();
  const sources = useTransportSources();
  const game = useSoundingGame();

  // Read when a sound is put on, never captured at registration: the engine
  // can change while the window runs.
  const isApoRef = useRef(false);
  useEffect(() => {
    isApoRef.current = status?.engine === 'apo';
  }, [status]);

  useEffect(() => {
    registerSongSoundHost({
      isApo: () => isApoRef.current,
      refresh: () => refreshState(),
    });
  }, [refreshState]);

  // A game's own sound holds the memory off for as long as it plays.
  const isGameSounding = game !== undefined;
  useEffect(() => {
    holdSongSound(isGameSounding);
  }, [isGameSounding]);

  useEffect(() => {
    feedSongSound({ kind: 'deviceChanged', deviceId: editor?.device.id ?? '' });
    returnLeftoverSongSound();
  }, [editor?.device.id, editor?.generation]);

  useEffect(() => {
    feedSongSound({ kind: 'nowPlaying', identity, isPlaying });
  }, [identity, isPlaying]);

  // Nothing while the window is still reading main's state: the defaults it
  // shows meanwhile are nobody's sound, and a song opened on them would read
  // the real one arriving as an edit.
  const sound = useMemo(
    () =>
      isLoading
        ? undefined
        : songSoundOf({ filters, tone, voicing, eqFormat }, rack),
    [isLoading, filters, tone, voicing, eqFormat, rack],
  );
  useEffect(() => {
    feedSongSound({ kind: 'soundChanged', sound });
  }, [sound]);

  // The clock: every position a player reports is time passing while it
  // plays, which is all the settle and the pause grace need — the same clock
  // the Smart EQ memory keeps (`useSongEqClock`).
  useEffect(() => {
    feedSongSound({ kind: 'tick' });
  }, [sources]);

  useEffect(() => {
    // Best effort, as the window is already on its way out: what an edited
    // song files here may not land. Nothing lent can outlive it — main and the
    // rack write the listener's own sound down while a song's plays.
    const onBeforeUnload = () => feedSongSound({ kind: 'closing' });
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  return null;
};

export default SongSoundHost;
