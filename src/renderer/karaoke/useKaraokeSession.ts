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

import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  parseKaraokeLyricFile,
  selectKaraokeFiles,
} from '../../common/karaoke/files';
import { TrackClock, clampKaraokeTime } from '../../common/karaoke/clock';
import {
  claimPlayback,
  registerPlayer,
  releasePlayback,
} from '../audio/playbackOwner';
import { letGoOfDspPlacement } from '../dsp/placementLetGo';
import {
  IKaraokeSong,
  TKaraokeParseErrorCode,
} from '../../common/karaoke/types';
import { createKaraokeLiveValue, IKaraokeLiveValue } from './karaokeLiveValue';
import {
  TParsedKaraokeLyrics,
  asKaraokeParseError,
  assembleKaraokeSong,
} from './karaokeSessionFiles';
import { materializeRestoredAudio } from './karaokeRestoredFiles';
import { useKaraokeNativeDeck } from './useKaraokeNativeDeck';
import useKaraokeMediaEvents from './useKaraokeMediaEvents';

export { karaokeSongIdForFile } from './karaokeSessionFiles';

const PLAYHEAD_RENDER_INTERVAL_MS = 50;

export type TKaraokePlaybackStatus =
  'empty' | 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';

export type TKaraokeSessionError =
  'missing-audio' | 'ambiguous' | 'unsupported' | 'read' | 'playback';

export interface IKaraokeSessionWarning {
  kind: 'lyrics';
  fileName: string;
  /**
   * Why the parse failed, when the parser said so.
   *
   * Absent for anything that is not a `KaraokeParseError` — a read that fell
   * over, an extension no adapter claimed — and the workspace falls back to
   * the one generic sentence for those. The code travels rather than the
   * message because the messages thrown in `src/common` are English
   * diagnostics; only the UI knows which interface language to say them in.
   */
  code?: TKaraokeParseErrorCode;
  /** 1-based, and only for the codes whose parser could point at a row. */
  line?: number;
}

export interface IKaraokeSessionOptions {
  /** The Karaoke tab is in front; `isActive` by default. */
  isShown?: boolean;
  /**
   * The Maker is open. Its auditions are timed on the page's own `<audio>`
   * element, so while it is the song plays there (`useKaraokeNativeDeck`).
   */
  isMakerOpen?: boolean;
}

/**
 * Owns one local song session.
 *
 * The song plays through the Library's native player whenever that can play
 * it (`useKaraokeNativeDeck`), and on the page's own `<audio>` element
 * otherwise — which stays loaded with the song either way, as the Library's
 * do, so the host can hand it back. `status` is the session's own word for
 * what the listener wants and what has happened: the element's events write
 * it while the element is the sound, and play, pause and the host's
 * end-of-file write it while the host is.
 */
export const useKaraokeSession = (
  isActive: boolean,
  { isShown = isActive, isMakerOpen = false }: IKaraokeSessionOptions = {},
) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const objectUrlRef = useRef<string | undefined>(undefined);
  /** The backing track's URL once a song is separated; the element plays it. */
  const instrumentalUrlRef = useRef<string | undefined>(undefined);
  const importRequestRef = useRef(0);
  const [song, setSong] = useState<IKaraokeSong>();
  const [status, setStatus] = useState<TKaraokePlaybackStatus>('empty');
  const statusRef = useRef(status);
  statusRef.current = status;
  const [error, setError] = useState<TKaraokeSessionError>();
  const [warning, setWarning] = useState<IKaraokeSessionWarning>();
  /**
   * Where the song is, as every readout draws it: sampled each
   * PLAYHEAD_RENDER_INTERVAL_MS while the stage plays, from `timeupdate` or
   * the host's frames while it is hidden.
   *
   * Not state. As state it re-rendered the whole workspace twenty times a
   * second, where only the few components that show it need to; see
   * `karaokeLiveValue`.
   */
  const [playhead] = useState(() => createKaraokeLiveValue(0));
  const isActiveRef = useRef(isActive);
  const [durationMs, setDurationMs] = useState(0);
  // The app's fader, shared with the library and the Media tab. It used to be
  // a karaoke-only level under its own key, defaulting to 0.8 with no control
  // anywhere in the UI — so a karaoke song played four fifths as loud as the
  // same song in the library and nothing on screen said why.
  // Solo listening scales the backing track under the master volume; 1 is
  // normal playback, 0 is voice alone. A ref, because the element must be
  // retuned inside callbacks that never re-render; state as well, because the
  // host is told it through a render (`useKaraokeNativeDeck`).
  const backingScaleRef = useRef(1);
  const [backingScale, setBackingScaleState] = useState(1);
  /** The guide-vocal fader, which the host plays as the deck's layer. */
  const [guideVocalLevel, setGuideVocalLevel] = useState(0);
  isActiveRef.current = isActive;

  /** The host's frames, for a playhead no frame loop is drawing. */
  const readPlayheadMsRef = useRef<() => number>(() => playhead.read());
  const onHostFrame = useCallback(() => {
    if (!isActiveRef.current) {
      playhead.write(readPlayheadMsRef.current());
    }
  }, [playhead]);
  const deck = useKaraokeNativeDeck({
    audioRef,
    song,
    isPlaying: status === 'playing',
    positionMs: playhead.read(),
    isShown,
    isMakerOpen,
    backingScale,
    vocalLevel: guideVocalLevel,
    onFrame: onHostFrame,
  });
  const deckRef = useRef(deck);
  deckRef.current = deck;

  /**
   * Read the engine making the sound, for frame-accurate visual
   * synchronization: the host's clock while it has the song, the media
   * element's otherwise.
   */
  const readPlayheadMs = useCallback((): number => {
    const { current } = deckRef;
    if (current.ownsRef.current) {
      return current.readMs(statusRef.current === 'playing');
    }
    const audio = audioRef.current;
    return audio ? new TrackClock(audio).read().nowMs : playhead.read();
  }, [playhead]);
  readPlayheadMsRef.current = readPlayheadMs;

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = undefined;
    }
    if (instrumentalUrlRef.current) {
      URL.revokeObjectURL(instrumentalUrlRef.current);
      instrumentalUrlRef.current = undefined;
    }
  }, []);

  const clear = useCallback(() => {
    importRequestRef.current += 1;
    releasePlayback('karaoke');
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    revokeObjectUrl();
    setSong(undefined);
    setStatus('empty');
    setError(undefined);
    setWarning(undefined);
    playhead.write(0);
    setDurationMs(0);
  }, [playhead, revokeObjectUrl]);

  /** Replace only the parsed karaoke metadata while keeping the loaded audio alive. */
  const applySong = useCallback((nextSong: IKaraokeSong) => {
    // A song that has been separated plays its backing track, not the mix.
    // The swap happens here, in place, keeping the playhead and the playing
    // state — the original `audio` asset is deliberately left alone, both as
    // the imported file's identity and because the guide-vocal fader adds the
    // voice back on top of whatever the element plays: over the instrumental
    // that reconstructs the song, over the mix it would double the singer.
    // The host swaps the same way, at its own place (`followPosition`).
    const instrumental = nextSong.assets.find(
      (asset) => asset.role === 'instrumental',
    );
    const element = audioRef.current;
    if (instrumental && element) {
      const alreadySwapped =
        instrumentalUrlRef.current !== undefined &&
        element.src === instrumentalUrlRef.current;
      if (!alreadySwapped) {
        const wasPlaying = !element.paused;
        const position = element.currentTime;
        if (instrumentalUrlRef.current) {
          URL.revokeObjectURL(instrumentalUrlRef.current);
        }
        instrumentalUrlRef.current = URL.createObjectURL(instrumental.file);
        element.src = instrumentalUrlRef.current;
        element.currentTime = position;
        if (wasPlaying) {
          element.play().catch(() => undefined);
        }
      }
    }
    setSong(nextSong);
    setError(undefined);
    setWarning(undefined);
  }, []);

  const loadFiles = useCallback(
    async (files: readonly File[]): Promise<boolean> => {
      const selection = selectKaraokeFiles(files);
      if (selection.kind !== 'ready') {
        setError(selection.kind);
        setWarning(undefined);
        return false;
      }

      const requestId = importRequestRef.current + 1;
      importRequestRef.current = requestId;
      setStatus('loading');
      setError(undefined);
      setWarning(undefined);

      let parsed: TParsedKaraokeLyrics | undefined;
      if (selection.lyrics) {
        try {
          parsed = await parseKaraokeLyricFile(selection.lyrics);
        } catch (error) {
          const parseError = asKaraokeParseError(error);
          setWarning({
            kind: 'lyrics',
            fileName: selection.lyrics.name,
            code: parseError?.code,
            line: parseError?.line,
          });
        }
      }
      if (requestId !== importRequestRef.current) {
        return false;
      }

      try {
        const audioFile = await materializeRestoredAudio(selection.audio);
        const nextUrl = URL.createObjectURL(audioFile);
        const audio = audioRef.current;
        if (!audio) {
          URL.revokeObjectURL(nextUrl);
          throw new Error('The audio player is not available.');
        }
        audio.pause();
        revokeObjectUrl();
        objectUrlRef.current = nextUrl;
        setSong(
          await assembleKaraokeSong({
            audioFile,
            importedAudio: selection.audio,
            lyrics: selection.lyrics,
            parsed,
            files,
          }),
        );
        playhead.write(0);
        setDurationMs(0);
        setStatus('ready');
        audio.src = nextUrl;
        audio.volume = backingScaleRef.current;
        audio.load();
        return true;
      } catch {
        setStatus(song ? 'paused' : 'error');
        setError('read');
        return false;
      }
    },
    [playhead, revokeObjectUrl, song],
  );

  const seek = useCallback(
    (nextMs: number) => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      // The element keeps the place whichever engine plays: it is the
      // fallback, and is handed the song back where it stands.
      const target = clampKaraokeTime(
        nextMs,
        Number.isFinite(audio.duration) ? audio.duration * 1_000 : 0,
      );
      new TrackClock(audio).seek(target);
      deckRef.current.seek(target);
      playhead.write(readPlayheadMs());
    },
    [playhead, readPlayheadMs],
  );

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !song) {
      return;
    }
    if (deckRef.current.canPlay) {
      // Claimed FIRST, on the host's path. The claim is what pauses the
      // Library and lends the Karaoke the host (`hostLease.ts`); the deck
      // starts once the host has the song. The element is not started at
      // all: started here, the song came out of Chromium for as long as the
      // host took to engage, and then a second time out of the host.
      claimPlayback('karaoke');
      setError(undefined);
      if (deckRef.current.ended || statusRef.current === 'ended') {
        seek(0);
      }
      setStatus('playing');
      return;
    }
    try {
      await new TrackClock(audio).play();
      // Claimed once the element is actually running, not when it is asked to
      // — `play()` is a promise that can be refused, and claiming on the
      // request would silence the library for a song that never started. See
      // `playbackOwner`.
      claimPlayback('karaoke');
      setError(undefined);
    } catch {
      setError('playback');
      setStatus('error');
    }
  }, [seek, song]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      new TrackClock(audio).pause();
    }
    // Said here rather than left to the element's `pause` event: the host has
    // no element event, and the element it stands down pauses with nobody
    // having pressed anything.
    setStatus((current) => (current === 'playing' ? 'paused' : current));
    releasePlayback('karaoke');
  }, []);

  const togglePlayback = useCallback(() => {
    if (status === 'playing') {
      pause();
    } else {
      play();
    }
  }, [pause, play, status]);

  // How the rest of the app silences this session when something else takes
  // over. `pause` and not a teardown: the singer keeps their song, their
  // lyrics and their place in it, and gets them back on the next press.
  // The rack's placement goes back with the sound (`placementLetGo.ts`).
  useEffect(
    () =>
      registerPlayer('karaoke', () => {
        pause();
        letGoOfDspPlacement('karaoke');
      }),
    [pause],
  );

  const restart = useCallback(() => {
    seek(0);
  }, [seek]);

  const setBackingScale = useCallback((scale: number) => {
    const clamped = Math.min(1, Math.max(0, scale));
    backingScaleRef.current = clamped;
    setBackingScaleState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
  }, []);

  useKaraokeMediaEvents({
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
  });

  useEffect(() => {
    if (!isActive || status !== 'playing') {
      if (isActive) {
        playhead.write(readPlayheadMs());
      }
      return undefined;
    }
    let frame = 0;
    let lastRender = -Infinity;
    const renderFrame = (renderTime: number) => {
      if (renderTime - lastRender >= PLAYHEAD_RENDER_INTERVAL_MS) {
        lastRender = renderTime;
        playhead.write(readPlayheadMs());
      }
      frame = window.requestAnimationFrame(renderFrame);
    };
    frame = window.requestAnimationFrame(renderFrame);
    return () => window.cancelAnimationFrame(frame);
  }, [isActive, playhead, readPlayheadMs, status]);

  useEffect(
    () => () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
      }
      revokeObjectUrl();
    },
    [revokeObjectUrl],
  );

  const { hostPlaysVocals } = deck;

  // One object for as long as nothing in it changes. The workspace's playlist
  // callbacks depend on it, and a new object every render would make each of
  // them new every render: the memoised playlist would re-draw all its rows
  // whenever anything at all changed around it.
  return useMemo(
    () => ({
      audioRef: audioRef as RefObject<HTMLAudioElement>,
      song,
      status,
      error,
      warning,
      playhead: playhead as IKaraokeLiveValue<number>,
      readPlayheadMs,
      durationMs,
      loadFiles,
      applySong,
      clear,
      play,
      pause,
      togglePlayback,
      seek,
      restart,
      setBackingScale,
      setGuideVocalLevel,
      /** The voice is the host's layer; the page's own copy stays silent. */
      hostPlaysVocals,
    }),
    [
      song,
      status,
      error,
      warning,
      playhead,
      readPlayheadMs,
      durationMs,
      loadFiles,
      applySong,
      clear,
      play,
      pause,
      togglePlayback,
      seek,
      restart,
      setBackingScale,
      hostPlaysVocals,
    ],
  );
};
