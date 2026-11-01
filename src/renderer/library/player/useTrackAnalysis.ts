/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Measuring Library songs, for the numbers the player plays them by: the
 * loudness Normalizer and Master work from, where the music starts and stops
 * for the overlap, and the noise floor Denoise subtracts.
 *
 * The player runs in the app's core and reads those numbers from the
 * library; the measuring stays here, where the decoder is. Each result is
 * kept in the library (`library-track-normalization-set`), and the core picks
 * it up from there: the song playing gets its level, the overlap its edges.
 * The DSP page's status line is this window's own.
 *
 * Three jobs and one rule between them: **one song owns one analysis job.**
 * `jobRef` is that claim, and whichever job starts a decode aborts the
 * other's — two full decodes at once make the window drop frames, and a
 * result that lands against a song already replaced is worse than none.
 *
 * - The song playing, when a setting asks for a number it has not got — or
 *   the file changed since it was measured.
 * - The NEXT song, so it starts at its final gain from the first sample
 *   rather than being level-matched audibly over its opening bars. Always
 *   subordinate: while a job exists for the song playing, it waits.
 * - The noise floor, only on an explicit request from the Denoise card.
 */
import { useEffect, useRef } from 'react';
import type { IDspSettings } from '../../../common/dsp/chain';
import type { ILibraryTrack } from '../../../common/library/types';
import { analyzeInputTrack } from '../../dsp/inputNormalizer';
import {
  readDspInputAnalysis,
  setDspInputAnalysis,
  useDspNoiseRescanRequest,
} from '../../dsp/store';
import { useRackGate } from '../../dsp/rackPlacement';

interface IAnalysisJob {
  trackId: string;
  controller: AbortController;
}

const keep = (
  track: ILibraryTrack,
  analysis: NonNullable<ILibraryTrack['normalization']>,
  signature: { sizeBytes: number; mtimeMs: number } | undefined,
) =>
  window.electron.ipcRenderer.setLibraryTrackNormalization(
    track.id,
    analysis,
    signature ?? { sizeBytes: track.sizeBytes, mtimeMs: track.mtimeMs },
  );

const readTrack = (trackId: string) =>
  Promise.all([
    window.electron.ipcRenderer.libraryTrackBytes(trackId),
    window.electron.ipcRenderer.libraryTrackSignature(trackId),
  ]);

const useTrackAnalysis = (options: {
  track: ILibraryTrack | undefined;
  next: ILibraryTrack | undefined;
  settings: IDspSettings;
}): void => {
  const { track, next, settings } = options;
  const noiseRescanRequest = useDspNoiseRescanRequest();
  const handledNoiseRescanRef = useRef(0);
  const jobRef = useRef<IAnalysisJob | undefined>(undefined);
  // Source measurements serve every output under the FluidEQ Engine: a
  // second output's Normalizer must not depend on the main output having its
  // own switched on.
  const outputAnalysis = useRackGate().engine === 'fluid';
  const wantsLoudness =
    outputAnalysis ||
    (settings.enabled &&
      (settings.normalizer.mode !== 'off' ||
        (settings.master.enabled && settings.master.loudnessMaximize)));
  // The overlap cannot know when a song stops without measuring where its
  // last audible sample is.
  const wantsEdges = settings.enabled && settings.crossfade.enabled;
  const shouldAnalyze = wantsLoudness || wantsEdges;

  /**
   * The song playing. Its cached numbers are shown at once; it is measured
   * when they are missing, when the file changed since, or when only the
   * edges are missing and the overlap now wants them.
   */
  useEffect(() => {
    if (!track || track.kind !== 'audio' || !track.isPlayable) {
      setDspInputAnalysis({
        ...(track ? { trackId: track.id } : {}),
        status: track ? 'unavailable' : 'idle',
        fraction: 0,
      });
      return undefined;
    }
    const cached = track.normalization;
    setDspInputAnalysis(
      cached
        ? { trackId: track.id, status: 'ready', fraction: 1, analysis: cached }
        : {
            trackId: track.id,
            status: shouldAnalyze ? 'analyzing' : 'idle',
            fraction: 0,
          },
    );
    if (!shouldAnalyze) {
      return undefined;
    }
    jobRef.current?.controller.abort();
    const job: IAnalysisJob = {
      trackId: track.id,
      controller: new AbortController(),
    };
    jobRef.current = job;
    let cancelled = false;
    const isMine = () => !cancelled && jobRef.current === job;
    const unavailable = () => {
      if (!cached && isMine() && !job.controller.signal.aborted) {
        setDspInputAnalysis({
          trackId: track.id,
          status: 'unavailable',
          fraction: 0,
        });
      }
    };
    const measure = async () => {
      const signature = await window.electron.ipcRenderer.libraryTrackSignature(
        track.id,
      );
      const needsFresh =
        !cached ||
        !signature ||
        signature.sizeBytes !== track.sizeBytes ||
        signature.mtimeMs !== track.mtimeMs ||
        // Measured before the edges existed: the loudness is still right,
        // so only the overlap is worth a second decode.
        (!cached.edges && wantsEdges);
      if (!needsFresh || !isMine()) {
        return;
      }
      const buffer = await window.electron.ipcRenderer.libraryTrackBytes(
        track.id,
      );
      if (!buffer || !isMine()) {
        unavailable();
        return;
      }
      const analysis = await analyzeInputTrack(buffer, {
        sampleRateHint: track.sampleRate,
        signal: job.controller.signal,
        isCancelled: () => !isMine(),
        onProgress: ({ fraction }) => {
          if (!cached && isMine()) {
            setDspInputAnalysis({
              trackId: track.id,
              status: 'analyzing',
              fraction,
            });
          }
        },
      });
      if (!analysis || !isMine()) {
        unavailable();
        return;
      }
      setDspInputAnalysis({
        trackId: track.id,
        status: 'ready',
        fraction: 1,
        analysis,
      });
      await keep(track, analysis, signature);
    };
    measure()
      .catch(unavailable)
      .finally(() => {
        if (jobRef.current === job) {
          jobRef.current = undefined;
        }
      });
    return () => {
      cancelled = true;
      job.controller.abort();
      if (jobRef.current === job) {
        jobRef.current = undefined;
      }
    };
    // The song by its id: its tags refreshed by a rescan are not a new song.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above.
  }, [track?.id, shouldAnalyze, wantsEdges]);

  /** The next song, while the one playing has nothing being measured. */
  useEffect(() => {
    if (
      !wantsLoudness ||
      !next ||
      next.kind !== 'audio' ||
      !next.isPlayable ||
      next.normalization ||
      jobRef.current
    ) {
      return undefined;
    }
    let cancelled = false;
    const controller = new AbortController();
    const measure = async () => {
      const [buffer, signature] = await readTrack(next.id);
      if (!buffer || cancelled) {
        return;
      }
      const analysis = await analyzeInputTrack(buffer, {
        sampleRateHint: next.sampleRate,
        signal: controller.signal,
        isCancelled: () => cancelled || jobRef.current !== undefined,
        onProgress: () => undefined,
      });
      if (analysis && !cancelled) {
        await keep(next, analysis, signature);
      }
    };
    measure().catch(() => undefined);
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [next, wantsLoudness, track?.id]);

  /**
   * The current song's noise floor, only when the Denoise card asks: a scan
   * that ran whenever settings allowed it stepped the sound several seconds
   * into every new song.
   */
  useEffect(() => {
    if (noiseRescanRequest.id <= handledNoiseRescanRef.current) {
      return undefined;
    }
    handledNoiseRescanRef.current = noiseRescanRequest.id;
    if (
      noiseRescanRequest.trackId !== track?.id ||
      (!settings.enabled && !outputAnalysis) ||
      !track ||
      track.kind !== 'audio'
    ) {
      return undefined;
    }
    jobRef.current?.controller.abort();
    const job: IAnalysisJob = {
      trackId: track.id,
      controller: new AbortController(),
    };
    jobRef.current = job;
    let cancelled = false;
    const isMine = () => !cancelled && jobRef.current === job;
    const shown = readDspInputAnalysis();
    const previous =
      shown.trackId === track.id ? shown.analysis : track.normalization;
    const restorePrevious = () => {
      if (isMine() && !job.controller.signal.aborted) {
        setDspInputAnalysis({
          trackId: track.id,
          status: previous ? 'ready' : 'unavailable',
          fraction: previous ? 1 : 0,
          analysis: previous,
        });
      }
    };
    setDspInputAnalysis({
      trackId: track.id,
      status: 'analyzing',
      fraction: 0,
      analysis: previous,
    });
    const measure = async () => {
      const [buffer, signature] = await readTrack(track.id);
      if (!buffer || !isMine()) {
        restorePrevious();
        return;
      }
      const analysis = await analyzeInputTrack(buffer, {
        sampleRateHint: track.sampleRate,
        signal: job.controller.signal,
        isCancelled: () => !isMine(),
        measureNoise: true,
        onProgress: ({ fraction }) => {
          if (isMine()) {
            setDspInputAnalysis({
              trackId: track.id,
              status: 'analyzing',
              fraction,
              analysis: previous,
            });
          }
        },
      });
      if (!analysis?.noise || !isMine()) {
        restorePrevious();
        return;
      }
      const completed = previous
        ? { ...previous, noise: analysis.noise }
        : analysis;
      setDspInputAnalysis({
        trackId: track.id,
        status: 'ready',
        fraction: 1,
        analysis: completed,
      });
      // The core applies the floor once the library has it.
      await keep(track, completed, signature);
    };
    measure()
      .catch(restorePrevious)
      .finally(() => {
        if (jobRef.current === job) {
          jobRef.current = undefined;
        }
      });
    return () => {
      cancelled = true;
      job.controller.abort();
      if (jobRef.current === job) {
        jobRef.current = undefined;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one scan per request.
  }, [noiseRescanRequest.id]);
};

export default useTrackAnalysis;
