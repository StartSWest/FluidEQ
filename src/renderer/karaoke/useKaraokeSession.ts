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

import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import {
  karaokeFileBaseName,
  karaokeFileExtension,
  karaokeFileRelativePath,
  karaokeRestoredFileToken,
  parseKaraokeLyricFile,
  selectKaraokeFiles,
  selectKaraokeStageMedia,
  setKaraokeRelativePath,
  setKaraokeRestoredFileToken,
} from '../../common/karaoke/files';
import { findActiveKaraokeLine, TrackClock } from '../../common/karaoke/clock';
import { IKaraokeSong } from '../../common/karaoke/types';

const KARAOKE_VOLUME_KEY = 'fluideq.karaoke.volume';
const PLAYHEAD_RENDER_INTERVAL_MS = 50;

export type TKaraokePlaybackStatus =
  'empty' | 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';

export type TKaraokeSessionError =
  'missing-audio' | 'ambiguous' | 'unsupported' | 'read' | 'playback';

export interface IKaraokeSessionWarning {
  kind: 'lyrics';
  fileName: string;
}

const persistedVolume = (): number => {
  try {
    const stored = window.localStorage.getItem(KARAOKE_VOLUME_KEY);
    if (stored === null) {
      return 0.8;
    }
    const value = Number(stored);
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.8;
  } catch {
    return 0.8;
  }
};

const displayTitleFromFile = (file: File): string => {
  const extension = karaokeFileExtension(file.name);
  return (extension ? file.name.slice(0, -(extension.length + 1)) : file.name)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const sessionIdForFile = (file: File): string =>
  `${karaokeFileBaseName(file.name)}-${file.size}-${file.lastModified}`;

const materializeRestoredAudio = async (file: File): Promise<File> => {
  const token = karaokeRestoredFileToken(file);
  if (!token) {
    return file;
  }
  const reader = window.electron?.ipcRenderer.readKaraokeSessionFile;
  if (!reader) {
    throw new Error('The saved karaoke file bridge is unavailable.');
  }
  const restored = await reader(token);
  if (!restored) {
    throw new Error('The saved karaoke audio is no longer available.');
  }
  const materialized = new File([Uint8Array.from(restored.data)], file.name, {
    type: restored.type || file.type,
    lastModified: restored.lastModified || file.lastModified,
  });
  setKaraokeRelativePath(materialized, karaokeFileRelativePath(file));
  setKaraokeRestoredFileToken(materialized, token);
  return materialized;
};

/**
 * The same fetch for artwork, but never fatal.
 *
 * A restored session hands back picture and video files as empty shells with a
 * token; the bytes only arrive when asked for. Without this the stage got a
 * zero-length blob and drew a broken image, which is worse than the gradient
 * it replaced. And unlike the audio, a cover that has been moved or deleted
 * since the session was saved is not a reason to fail the song — it is a
 * reason to have no cover.
 */
const materializeRestoredMedia = async (
  file: File | undefined,
): Promise<File | undefined> => {
  if (!file) {
    return undefined;
  }
  try {
    return await materializeRestoredAudio(file);
  } catch {
    return undefined;
  }
};

/** Owns one local song session; no selected file or path leaves the renderer. */
export const useKaraokeSession = (isActive: boolean) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const objectUrlRef = useRef<string | undefined>(undefined);
  /** The backing track's URL once a song is separated; the element plays it. */
  const instrumentalUrlRef = useRef<string | undefined>(undefined);
  const importRequestRef = useRef(0);
  const [song, setSong] = useState<IKaraokeSong>();
  const [status, setStatus] = useState<TKaraokePlaybackStatus>('empty');
  const [error, setError] = useState<TKaraokeSessionError>();
  const [warning, setWarning] = useState<IKaraokeSessionWarning>();
  const [playheadMs, setPlayheadMs] = useState(0);
  const playheadMsRef = useRef(0);
  const [durationMs, setDurationMs] = useState(0);
  const [volume, setVolumeState] = useState(persistedVolume);
  // Solo listening scales the backing track under the master volume; 1 is
  // normal playback, 0 is voice alone. A ref, because the element must be
  // retuned inside callbacks that never re-render.
  const backingScaleRef = useRef(1);
  const volumeRef = useRef(persistedVolume());
  playheadMsRef.current = playheadMs;

  /** Read the media element directly for frame-accurate visual synchronization. */
  const readPlayheadMs = useCallback((): number => {
    const audio = audioRef.current;
    return audio ? new TrackClock(audio).read().nowMs : playheadMsRef.current;
  }, []);

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
    setPlayheadMs(0);
    setDurationMs(0);
  }, [revokeObjectUrl]);

  /** Replace only the parsed karaoke metadata while keeping the loaded audio alive. */
  const applySong = useCallback((nextSong: IKaraokeSong) => {
    // A song that has been separated plays its backing track, not the mix.
    // The swap happens here, in place, keeping the playhead and the playing
    // state — the original `audio` asset is deliberately left alone, both as
    // the imported file's identity and because the guide-vocal fader adds the
    // voice back on top of whatever the element plays: over the instrumental
    // that reconstructs the song, over the mix it would double the singer.
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

      let parsed;
      if (selection.lyrics) {
        try {
          parsed = await parseKaraokeLyricFile(selection.lyrics);
        } catch {
          setWarning({
            kind: 'lyrics',
            fileName: selection.lyrics.name,
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

        const id = sessionIdForFile(audioFile);
        // Resolved here rather than at import, because only now is the lyric
        // file parsed — UltraStar names its own cover, background and video,
        // and a folder holding several songs' artwork needs that header to
        // pick the right one. Formats with no header fall back to matching by
        // base name, which is all an LRC or a bare MP3 can offer.
        const chosenMedia = selectKaraokeStageMedia(selection.audio, files, {
          coverFileName: parsed?.coverFileName,
          backgroundFileName: parsed?.backgroundFileName,
          videoFileName: parsed?.videoFileName,
        });
        // Only the three that won are read off disk. Fetching every picture in
        // the folder would mean loading the losing candidates too, and a song
        // folder can hold a 60MB video that the stage never shows.
        const [cover, background, video] = await Promise.all([
          materializeRestoredMedia(chosenMedia.cover),
          materializeRestoredMedia(chosenMedia.background),
          materializeRestoredMedia(chosenMedia.video),
        ]);
        const stageMedia = { cover, background, video };
        const mediaAsset = (
          role: 'cover' | 'background' | 'video',
          file: File | undefined,
        ) =>
          file
            ? [
                {
                  id: `${id}-${role}`,
                  role,
                  file,
                  extension: karaokeFileExtension(file.name),
                },
              ]
            : [];
        setSong({
          id,
          title: parsed?.title || displayTitleFromFile(audioFile),
          artist: parsed?.artist,
          assets: [
            {
              id: `${id}-audio`,
              role: 'audio',
              file: audioFile,
              extension: karaokeFileExtension(audioFile.name),
            },
            ...mediaAsset('cover', stageMedia.cover),
            ...mediaAsset('background', stageMedia.background),
            ...mediaAsset('video', stageMedia.video),
            ...(selection.lyrics
              ? [
                  {
                    id: `${id}-lyrics`,
                    role: 'lyrics' as const,
                    file: selection.lyrics,
                    extension: karaokeFileExtension(selection.lyrics.name),
                  },
                ]
              : []),
          ],
          timingPrecision: parsed?.timingPrecision ?? 'none',
          lines: parsed?.lines ?? [],
          pitch: parsed?.pitch ?? { kind: 'none', reason: 'missing' },
          meta: {
            sourceFormat: parsed?.sourceFormat ?? 'audio-only',
            gapMs: parsed?.gapMs ?? 0,
            videoGapMs: parsed?.videoGapMs,
            bpm: parsed?.bpm,
            language: parsed?.language,
          },
        });
        setPlayheadMs(0);
        setDurationMs(0);
        setStatus('ready');
        audio.src = nextUrl;
        audio.volume = volume * backingScaleRef.current;
        audio.load();
        return true;
      } catch {
        setStatus(song ? 'paused' : 'error');
        setError('read');
        return false;
      }
    },
    [revokeObjectUrl, song, volume],
  );

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !song) {
      return;
    }
    try {
      await new TrackClock(audio).play();
      setError(undefined);
    } catch {
      setError('playback');
      setStatus('error');
    }
  }, [song]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      new TrackClock(audio).pause();
    }
  }, []);

  const togglePlayback = useCallback(() => {
    if (status === 'playing') {
      pause();
    } else {
      play();
    }
  }, [pause, play, status]);

  const seek = useCallback((nextMs: number) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const clock = new TrackClock(audio);
    clock.seek(nextMs);
    setPlayheadMs(clock.read().nowMs);
  }, []);

  const restart = useCallback(() => {
    seek(0);
  }, [seek]);

  const seekLyric = useCallback(
    (direction: -1 | 1) => {
      if (!song?.lines.length) {
        return;
      }
      const active = findActiveKaraokeLine(song.lines, playheadMs);
      const nextIndex =
        direction > 0
          ? Math.min(song.lines.length - 1, active + 1)
          : Math.max(0, active <= 0 ? 0 : active - 1);
      seek(song.lines[nextIndex].startMs ?? 0);
    },
    [playheadMs, seek, song],
  );

  const setBackingScale = useCallback((scale: number) => {
    backingScaleRef.current = Math.min(1, Math.max(0, scale));
    if (audioRef.current) {
      audioRef.current.volume = volumeRef.current * backingScaleRef.current;
    }
  }, []);

  const setVolume = useCallback((nextVolume: number) => {
    const normalized = Math.min(1, Math.max(0, nextVolume));
    setVolumeState(normalized);
    volumeRef.current = normalized;
    if (audioRef.current) {
      audioRef.current.volume = normalized * backingScaleRef.current;
    }
    try {
      window.localStorage.setItem(KARAOKE_VOLUME_KEY, String(normalized));
    } catch {
      // A private/locked storage area should not disable local playback.
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return undefined;
    }
    const syncTime = () => {
      const snapshot = new TrackClock(audio).read();
      setPlayheadMs(snapshot.nowMs);
      setDurationMs(snapshot.durationMs);
    };
    const onPlaying = () => {
      syncTime();
      setStatus('playing');
    };
    const onPause = () => {
      syncTime();
      if (!audio.ended && audio.currentSrc) {
        setStatus((current) => (current === 'ready' ? current : 'paused'));
      }
    };
    const onEnded = () => {
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
      setError('playback');
      setStatus('error');
    };

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadedmetadata', onReady);
    audio.addEventListener('durationchange', onReady);
    audio.addEventListener('seeked', syncTime);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadedmetadata', onReady);
      audio.removeEventListener('durationchange', onReady);
      audio.removeEventListener('seeked', syncTime);
      audio.removeEventListener('error', onError);
    };
  }, []);

  useEffect(() => {
    if (!isActive || status !== 'playing') {
      if (isActive && audioRef.current) {
        setPlayheadMs(new TrackClock(audioRef.current).read().nowMs);
      }
      return undefined;
    }
    let frame = 0;
    let lastRender = -Infinity;
    const renderFrame = (renderTime: number) => {
      if (renderTime - lastRender >= PLAYHEAD_RENDER_INTERVAL_MS) {
        lastRender = renderTime;
        if (audioRef.current) {
          setPlayheadMs(new TrackClock(audioRef.current).read().nowMs);
        }
      }
      frame = window.requestAnimationFrame(renderFrame);
    };
    frame = window.requestAnimationFrame(renderFrame);
    return () => window.cancelAnimationFrame(frame);
  }, [isActive, status]);

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

  return {
    audioRef: audioRef as RefObject<HTMLAudioElement>,
    song,
    status,
    error,
    warning,
    playheadMs,
    readPlayheadMs,
    durationMs,
    volume,
    loadFiles,
    applySong,
    clear,
    play,
    pause,
    togglePlayback,
    seek,
    restart,
    seekLyric,
    setVolume,
    setBackingScale,
  };
};
