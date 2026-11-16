/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the karaoke session learns from the engine making the sound.
 *
 * Two engines can be making it (`useKaraokeNativeDeck`): the page's own
 * `<audio>` element, whose events say what happened, and the Library's native
 * player, whose telemetry does. They are one subject — the song started,
 * paused, ran out, or could not play — and the rule that keeps them apart is
 * the same throughout: while the host has the song, the element is stood down
 * and paused where the host took it, and nothing it says is about the song.
 */
import {
  Dispatch,
  MutableRefObject,
  RefObject,
  SetStateAction,
  useEffect,
} from 'react';
import { TrackClock } from '../../common/karaoke/clock';
import { IKaraokeSong } from '../../common/karaoke/types';
import { releasePlayback } from '../audio/playbackOwner';
import { IKaraokeLiveValueWriter } from './karaokeLiveValue';
import type {
  TKaraokePlaybackStatus,
  TKaraokeSessionError,
} from './useKaraokeSession';
import { IKaraokeNativeDeck } from './useKaraokeNativeDeck';

interface IKaraokeMediaEventsOptions {
  audioRef: RefObject<HTMLAudioElement | null>;
  playhead: IKaraokeLiveValueWriter<number>;
  /** The stage is drawn, and its frame loop owns the playhead. */
  isActiveRef: MutableRefObject<boolean>;
  deck: IKaraokeNativeDeck;
  /** The same, from listeners bound once. */
  deckRef: MutableRefObject<IKaraokeNativeDeck>;
  status: TKaraokePlaybackStatus;
  statusRef: MutableRefObject<TKaraokePlaybackStatus>;
  readPlayheadMs: () => number;
  setStatus: Dispatch<SetStateAction<TKaraokePlaybackStatus>>;
  setSong: Dispatch<SetStateAction<IKaraokeSong | undefined>>;
  setError: Dispatch<SetStateAction<TKaraokeSessionError | undefined>>;
  setDurationMs: Dispatch<SetStateAction<number>>;
}

const useKaraokeMediaEvents = ({
  audioRef,
  playhead,
  isActiveRef,
  deck,
  deckRef,
  status,
  statusRef,
  readPlayheadMs,
  setStatus,
  setSong,
  setError,
  setDurationMs,
}: IKaraokeMediaEventsOptions): void => {
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return undefined;
    }
    /** Whether the element is the sound, and its events are the song's. */
    const elementIsTheSound = () => !deckRef.current.ownsRef.current;
    const syncTime = () => {
      const snapshot = new TrackClock(audio).read();
      // Stood down for the host, the element is paused where the host took
      // the song over; its position is not the song's.
      if (elementIsTheSound()) {
        playhead.write(snapshot.nowMs);
      }
      setDurationMs(snapshot.durationMs);
    };
    const onPlaying = () => {
      syncTime();
      setStatus('playing');
    };
    const onPause = () => {
      if (!elementIsTheSound()) {
        return;
      }
      syncTime();
      if (!audio.ended && audio.currentSrc) {
        setStatus((current) => (current === 'ready' ? current : 'paused'));
      }
    };
    const onTimeUpdate = () => {
      // The visible stage owns its smoother frame clock. Off-tab, this native
      // media event is enough to keep the one transport readout honest
      // without running an animation loop for DOM that is not mounted.
      if (!isActiveRef.current) {
        syncTime();
      }
    };
    const onEnded = () => {
      if (!elementIsTheSound()) {
        return;
      }
      syncTime();
      setStatus('ended');
    };
    const onReady = () => {
      syncTime();
      setSong((current) =>
        current ? { ...current, durationMs: audio.duration * 1_000 } : current,
      );
      setStatus((current) => (current === 'loading' ? 'ready' : current));
    };
    const onError = () => {
      // The host has its own copy of the file and is playing it.
      if (!elementIsTheSound()) {
        return;
      }
      releasePlayback('karaoke');
      setError('playback');
      setStatus('error');
    };

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadedmetadata', onReady);
    audio.addEventListener('durationchange', onReady);
    audio.addEventListener('seeked', syncTime);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadedmetadata', onReady);
      audio.removeEventListener('durationchange', onReady);
      audio.removeEventListener('seeked', syncTime);
      audio.removeEventListener('error', onError);
    };
  }, [
    audioRef,
    deckRef,
    isActiveRef,
    playhead,
    setDurationMs,
    setError,
    setSong,
    setStatus,
  ]);

  // The host's deck ran out of file: the song's end, as the element's `ended`
  // is on the element's path. Only as it happens — a play from the end seeks
  // to the top first, and the frame saying so arrives after.
  useEffect(() => {
    if (deck.owns && deck.ended && statusRef.current === 'playing') {
      playhead.write(readPlayheadMs());
      setStatus('ended');
    }
  }, [deck.ended, deck.owns, playhead, readPlayheadMs, setStatus, statusRef]);

  // The host given up while the song plays — it would not take the file,
  // failed to start, or the Maker opened — and the element takes the song,
  // from where the host handed it back.
  useEffect(() => {
    const audio = audioRef.current;
    if (
      status !== 'playing' ||
      deck.canPlay ||
      deck.owns ||
      !audio ||
      !audio.paused ||
      audio.ended ||
      !audio.currentSrc
    ) {
      return;
    }
    new TrackClock(audio).play().catch(() => {
      setError('playback');
      setStatus('error');
    });
  }, [audioRef, deck.canPlay, deck.owns, setError, setStatus, status]);
};

export default useKaraokeMediaEvents;
