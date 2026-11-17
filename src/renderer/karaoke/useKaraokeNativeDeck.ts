/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Karaoke playing through the Library's native player.
 *
 * Not a second player. It is the Library's own engine — `useNativeBackend`
 * to bring the host up with the rack the panel shows, `useNativeMirror` to
 * cue the song on a deck, start, pause and seek it and stand the page's
 * `<audio>` element down while the host has it — driven with a karaoke song
 * instead of a library track. The element stays what it is for the Library:
 * the fallback, holding the file, unmuted and handed the song back at the
 * host's position the moment the host cannot play it.
 *
 * What the Karaoke needs on top, and where it lives:
 *
 * - The host, which is one process with two decks and was the Library's
 *   alone: borrowed while the Karaoke plays, or while its tab is in front
 *   with a song and the Library is not playing (`hostLease.ts`).
 * - A path, where the Karaoke holds `File`s (`karaokeMediaPath.ts`).
 * - A clock fine enough for a lyric wipe (`karaokeHostClock.ts`).
 * - Its faders: the backing fader is the host's volume, and a separated song
 *   is the backing track with its voice LAYERED on the same deck, each at its
 *   own gain (`nativeMirrorMix.ts`). A host built before layers says so to
 *   the probe (`setDeckGain` in main's `wire.ts`), and a separated song
 *   plays on the element there.
 *
 * Off the host altogether, and on the element as before: while the Maker is
 * open — its auditions time themselves sample by sample on the element — on a
 * window with no host, after the host failed to start for this song, for a
 * file the host refused, and for a file with no path.
 */
import {
  MutableRefObject,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DECK_ENDED } from '../../common/dsp/deckState';
import { IKaraokeSong } from '../../common/karaoke/types';
import { usePlaybackOwner } from '../audio/playbackOwner';
import { setKaraokeWantsHost, useHostClient } from '../dsp/hostLease';
import { INativeMirrorState } from '../dsp/nativeMirrorTypes';
import { setPlayerProcessingLatency } from '../dsp/processingLatency';
import { useDspNativeState, usePlaybackDspSettings } from '../dsp/store';
import {
  hasNativeHostBridge,
  useNativeBackend,
  useNativeDeviceGeneration,
  useNativeMirror,
} from '../dsp/useNativeBackend';
import { createKaraokeHostClock } from './karaokeHostClock';
import {
  karaokeMediaPathNow,
  resolveKaraokeMediaPath,
} from './karaokeMediaPath';

export interface IKaraokeNativeDeckOptions {
  /** The fallback, and what the host stands down. */
  audioRef: RefObject<HTMLAudioElement | null>;
  song: IKaraokeSong | undefined;
  /** What the listener wants: the session's own status says playing. */
  isPlaying: boolean;
  /** Where the song is, for a host taking it over mid-play. */
  positionMs: number;
  /** The Karaoke tab is in front. */
  isShown: boolean;
  isMakerOpen: boolean;
  /** The backing fader, 0 to 1. */
  backingScale: number;
  /** The guide-vocal fader, 0 to 1, for a separated song. */
  vocalLevel: number;
  /** Every telemetry frame: the playhead's clock, for whoever draws it. */
  onFrame?: () => void;
}

export interface IKaraokeNativeDeck {
  /**
   * The host can play this song: its file has a path (or one is being
   * found), the engine has not failed for it, the Maker is closed, and a
   * separated song has a host that layers. Play goes to the host then, and
   * the element is never started.
   */
  canPlay: boolean;
  /** The host is making the sound now; the element is stood down. */
  owns: boolean;
  /** The same, read from listeners bound once. */
  ownsRef: MutableRefObject<boolean>;
  /** The host's deck has played to the end of the file. */
  ended: boolean;
  /** The voice is the host's layer, so the page's own copy stays silent. */
  hostPlaysVocals: boolean;
  /** Where the song is heard to be, in ms, while the host owns it. */
  readMs: (playing: boolean) => number;
  /** The listener moving the playhead; a no-op until a deck has the song. */
  seek: (positionMs: number) => void;
}

/**
 * A file's path for the host: the path, `undefined` for none, `null` while
 * main is being asked. A path known at once is never asked for.
 */
const useHostPath = (file: File | undefined): string | null | undefined => {
  const known = useMemo(
    () => (file ? karaokeMediaPathNow(file) : undefined),
    [file],
  );
  const [asked, setAsked] = useState<{ file: File; path?: string }>();
  useEffect(() => {
    if (!file || known) {
      return undefined;
    }
    let current = true;
    resolveKaraokeMediaPath(file)
      .then((path) => {
        if (current) {
          setAsked({ file, path });
        }
        return path;
      })
      .catch(() => {
        if (current) {
          setAsked({ file });
        }
      });
    return () => {
      current = false;
    };
  }, [file, known]);
  if (!file) {
    return undefined;
  }
  if (known) {
    return known;
  }
  return asked?.file === file ? asked.path : null;
};

export const useKaraokeNativeDeck = ({
  audioRef,
  song,
  isPlaying,
  positionMs,
  isShown,
  isMakerOpen,
  backingScale,
  vocalLevel,
  onFrame,
}: IKaraokeNativeDeckOptions): IKaraokeNativeDeck => {
  const songId = song?.id;
  // A separated song plays its backing track; the voice goes over it.
  const backing =
    song?.assets.find((asset) => asset.role === 'instrumental')?.file ??
    song?.assets.find((asset) => asset.role === 'audio')?.file;
  const vocals = song?.assets.find((asset) => asset.role === 'vocals')?.file;
  const backingPath = useHostPath(backing);
  const vocalsPath = useHostPath(vocals);

  /**
   * Once per song, a host that did not start or a file it would not take
   * sends the song to the element and is not asked again — a host that
   * cannot start would otherwise be asked once more by every render that
   * found it idle. The next song asks afresh.
   */
  const [failedSong, setFailedSong] = useState<string>();
  const [refused, setRefused] = useState<{ songId: string; path: string }>();
  /** Whether the host layers, once a host has been asked. */
  const [layers, setLayers] = useState<boolean>();

  const nativeState = useDspNativeState();
  const holds = useHostClient() === 'karaoke';
  useEffect(() => {
    if (holds && nativeState === 'failed' && songId !== undefined) {
      setFailedSong(songId);
    }
  }, [holds, nativeState, songId]);

  const canPlay =
    hasNativeHostBridge() &&
    songId !== undefined &&
    !isMakerOpen &&
    failedSong !== songId &&
    backing !== undefined &&
    backingPath !== undefined &&
    !(refused?.songId === songId && refused.path === backingPath) &&
    (vocals === undefined || (layers !== false && vocalsPath !== undefined));

  /**
   * The host while this plays, and while its tab is in front with a song and
   * the Library is not playing — so a press of Play finds it engaged. Never
   * taken from a Library that is playing: the Karaoke's own Play claims
   * playback first, which pauses the Library and makes the host free.
   */
  const owner = usePlaybackOwner();
  const wantsHost =
    canPlay && (owner === 'karaoke' || (isShown && owner !== 'library'));
  useEffect(() => {
    setKaraokeWantsHost(wantsHost);
  }, [wantsHost]);
  useEffect(() => () => setKaraokeWantsHost(false), []);

  const settings = usePlaybackDspSettings();
  const controller = useNativeBackend(settings, holds && wantsHost, 'karaoke');
  useNativeDeviceGeneration(controller);

  useEffect(() => {
    if (!controller || vocals === undefined || layers !== undefined) {
      return undefined;
    }
    let current = true;
    controller.transport
      .supportsLayers()
      .then((supported) => {
        if (current) {
          setLayers(supported);
        }
        return supported;
      })
      .catch(() => {
        if (current) {
          setLayers(false);
        }
      });
    return () => {
      current = false;
    };
  }, [controller, layers, vocals]);

  const [clock] = useState(createKaraokeHostClock);
  const [ended, setEnded] = useState(false);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  useEffect(() => {
    if (!controller) {
      return undefined;
    }
    // The host comes to the Karaoke from the Library, levelled and denoised
    // by the Library's analysis of the Library's last track. A karaoke song
    // has neither: unity, and Denoise following the floor live.
    controller.transport.setTrackGains(0, 0).catch(() => undefined);
    controller.transport.setNoiseProfile(undefined).catch(() => undefined);
    const subscribe = window.electron?.ipcRenderer.onDspHostTelemetry;
    if (typeof subscribe !== 'function') {
      return undefined;
    }
    const stop = subscribe((frame) => {
      clock.take(frame, performance.now());
      setEnded(frame.deckState === DECK_ENDED);
      setPlayerProcessingLatency(
        frame.processingLatency && frame.processingEndpoint
          ? {
              endpoint: frame.processingEndpoint,
              latency: frame.processingLatency,
            }
          : undefined,
      );
      onFrameRef.current?.();
    });
    return () => {
      stop();
      setEnded(false);
      setPlayerProcessingLatency(undefined);
    };
  }, [clock, controller]);

  const ownsRef = useRef(false);
  const [owns, setOwns] = useState(false);
  const onOwnership = useCallback((next: boolean) => {
    // The ref first: the element's `pause` from the stand-down that follows
    // is read against it, and must be read as the host taking over.
    ownsRef.current = next;
    setOwns(next);
  }, []);

  /**
   * The backing file's path while main is asked for a new one inside the
   * same song: the mix being replaced by the backing track it was separated
   * into keeps playing until the backing track can be cued in its place.
   */
  const heldPathRef = useRef<{ songId?: string; path?: string }>({});
  let mediaPath: string | undefined;
  if (typeof backingPath === 'string') {
    mediaPath = backingPath;
  } else if (backingPath === null && heldPathRef.current.songId === songId) {
    mediaPath = heldPathRef.current.path;
  }
  heldPathRef.current = { songId, path: mediaPath };
  const songRef = useRef({ songId, mediaPath });
  songRef.current = { songId, mediaPath };
  const onTrackRefused = useCallback(() => {
    const { current } = songRef;
    if (current.songId !== undefined && current.mediaPath !== undefined) {
      setRefused({ songId: current.songId, path: current.mediaPath });
    }
  }, []);

  const element = audioRef.current;
  const elements = useMemo(() => (element ? [element] : []), [element]);
  // A separated song waits for the answer about layers: cued without one,
  // the backing would start and then be taken away again when the answer
  // was no.
  const mirrored =
    element !== null && (vocals === undefined || layers === true)
      ? controller
      : undefined;
  const layer =
    vocals !== undefined && typeof vocalsPath === 'string'
      ? { path: vocalsPath, deckGain: backingScale, gain: vocalLevel }
      : undefined;
  const state: INativeMirrorState = {
    mediaPath,
    isPlaying,
    positionMs,
    followPosition: true,
    // With a layer the backing fader is the deck's own gain, so the voice is
    // not scaled with it; without one it is the level the whole song plays
    // at, ahead of the rack, as the element's volume was.
    mix: { volume: layer ? 1 : backingScale, layer },
  };
  const mirrorSeek = useNativeMirror(mirrored, elements, state, {
    claimSource: (seconds) => clock.cued(seconds, performance.now()),
    readHostPosition: () => clock.positionSeconds(),
    onOwnership,
    onTrackRefused,
  });

  const seek = useCallback(
    (target: number) => {
      const asked = clock.seek(target);
      mirrorSeek(target)
        .then((applied) => {
          clock.answered(asked, applied);
          return applied;
        })
        .catch(() => clock.answered(asked, false));
    },
    [clock, mirrorSeek],
  );
  const readMs = useCallback(
    (playing: boolean) => clock.read(performance.now(), playing),
    [clock],
  );

  return {
    canPlay,
    owns,
    ownsRef,
    ended,
    hostPlaysVocals: owns && layer !== undefined,
    readMs,
    seek,
  };
};
