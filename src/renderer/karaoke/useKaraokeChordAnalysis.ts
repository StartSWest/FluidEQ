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

import { useEffect, useState } from 'react';
import {
  analyzeKaraokeChords,
  IKaraokeChordSegment,
  KARAOKE_CHORD_ANALYSIS_SAMPLE_RATE,
} from '../../common/karaoke/chords';
import nextTask from '../../common/nextTask';
import { IKaraokeSong } from '../../common/karaoke/types';
import { recallRecent, rememberRecent } from '../utils/recentMap';

export type TKaraokeChordAnalysisStatus =
  'idle' | 'analyzing' | 'ready' | 'unsupported' | 'error';

export interface IKaraokeChordAnalysisState {
  status: TKaraokeChordAnalysisStatus;
  chords: IKaraokeChordSegment[];
  progress: number;
}

/**
 * Chords already worked out, by song, so going back to a song does not decode
 * it again. Capped: kept for every song ever opened, it grew for as long as
 * the window was open; a returning singer's recent songs stay.
 */
const chordCache = new Map<string, IKaraokeChordSegment[]>();
const CACHED_SONGS = 32;

/** Downmix and resample in bounded chunks after Chromium decodes the file. */
const audioBufferToChordPcm = async (
  buffer: AudioBuffer,
  shouldCancel: () => boolean,
): Promise<Float32Array> => {
  const targetLength = Math.max(
    1,
    Math.ceil(buffer.duration * KARAOKE_CHORD_ANALYSIS_SAMPLE_RATE),
  );
  const output = new Float32Array(targetLength);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
    buffer.getChannelData(index),
  );
  const sourceStep = buffer.sampleRate / KARAOKE_CHORD_ANALYSIS_SAMPLE_RATE;
  const chunkSize = 131_072;
  for (let chunkStart = 0; chunkStart < targetLength; chunkStart += chunkSize) {
    if (shouldCancel()) {
      return new Float32Array();
    }
    const chunkEnd = Math.min(targetLength, chunkStart + chunkSize);
    for (let index = chunkStart; index < chunkEnd; index += 1) {
      const sourcePosition = index * sourceStep;
      const leftIndex = Math.min(
        buffer.length - 1,
        Math.max(0, Math.floor(sourcePosition)),
      );
      const rightIndex = Math.min(buffer.length - 1, leftIndex + 1);
      const fraction = sourcePosition - leftIndex;
      let mono = 0;
      channels.forEach((channel) => {
        mono +=
          channel[leftIndex] +
          (channel[rightIndex] - channel[leftIndex]) * fraction;
      });
      output[index] = channels.length ? mono / channels.length : 0;
    }
    // A task, not a zero-delay timer: a hidden window runs timers once a
    // second at best, so a four-minute song — about twenty chunks — took
    // twenty seconds or more to convert, holding the whole decoded song.
    await nextTask();
  }
  return output;
};

const initialState: IKaraokeChordAnalysisState = {
  status: 'idle',
  chords: [],
  progress: 0,
};

/** Decode and analyze the selected backing track entirely on this machine. */
export const useKaraokeChordAnalysis = (
  song: IKaraokeSong | undefined,
  isActive: boolean,
): IKaraokeChordAnalysisState => {
  const [state, setState] = useState<IKaraokeChordAnalysisState>(initialState);
  const songId = song?.id;
  const audioFile = song?.assets.find((asset) => asset.role === 'audio')?.file;

  useEffect(() => {
    if (!songId) {
      setState(initialState);
      return undefined;
    }
    const cached = recallRecent(chordCache, songId);
    if (cached) {
      setState({ status: 'ready', chords: cached, progress: 1 });
      return undefined;
    }
    if (!isActive) {
      setState(initialState);
      return undefined;
    }
    if (!audioFile || typeof AudioContext === 'undefined') {
      setState({ status: 'unsupported', chords: [], progress: 0 });
      return undefined;
    }

    let cancelled = false;
    let context: AudioContext | undefined;
    const shouldCancel = () => cancelled;
    setState({ status: 'analyzing', chords: [], progress: 0.02 });

    const analyze = async () => {
      try {
        context = new AudioContext({
          latencyHint: 'playback',
          sampleRate: KARAOKE_CHORD_ANALYSIS_SAMPLE_RATE,
        });
        const encoded = await audioFile.arrayBuffer();
        if (cancelled) {
          return;
        }
        const decoded = await context.decodeAudioData(encoded.slice(0));
        if (cancelled) {
          return;
        }
        setState((current) => ({ ...current, progress: 0.08 }));
        const pcm = await audioBufferToChordPcm(decoded, shouldCancel);
        if (cancelled || !pcm.length) {
          return;
        }
        setState((current) => ({ ...current, progress: 0.12 }));
        let reportedProgress = 0;
        const chords = await analyzeKaraokeChords(
          pcm,
          KARAOKE_CHORD_ANALYSIS_SAMPLE_RATE,
          {
            shouldCancel,
            onProgress: (progress) => {
              if (
                !cancelled &&
                (progress - reportedProgress >= 0.015 || progress === 1)
              ) {
                reportedProgress = progress;
                setState((current) => ({
                  ...current,
                  progress: 0.12 + progress * 0.88,
                }));
              }
            },
          },
        );
        if (cancelled) {
          return;
        }
        rememberRecent(chordCache, songId, chords, CACHED_SONGS);
        setState({ status: 'ready', chords, progress: 1 });
      } catch {
        if (!cancelled) {
          setState({ status: 'error', chords: [], progress: 0 });
        }
      } finally {
        context?.close().catch(() => undefined);
      }
    };
    analyze().catch(() => undefined);

    return () => {
      cancelled = true;
      context?.close().catch(() => undefined);
    };
  }, [audioFile, isActive, songId]);

  return state;
};
