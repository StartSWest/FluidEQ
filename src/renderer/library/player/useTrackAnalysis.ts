/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Measuring tracks in the background, for the numbers the loader had no reason
 * to produce.
 *
 * Two effects, and they are one subject because they share the rule that makes
 * either safe: **one track owns one analysis job.** `analysisJobRef` is that
 * claim, and whichever of them starts a decode aborts the other's — two full
 * decodes at once makes the window drop frames, and a result that lands
 * against a track already replaced is worse than no result.
 *
 * The first pre-measures the track the queue says is NEXT, so it starts at its
 * final gain from the first sample rather than being level-matched audibly
 * over the opening bars. It is deliberately subordinate: while a job exists
 * for the audible track, it waits.
 *
 * The second measures the track that is ALREADY playing, and exists for the
 * case the loader deliberately skipped — the song was started with the
 * Normalizer, the crossfade and Denoise all off, and one of them has just been
 * switched on. It is keyed on those settings rather than on the track.
 *
 * Neither restarts anything. The audio is already going; these only read the
 * file a second time to fill in what the panel and the overlap are missing.
 */
import { MutableRefObject, useEffect } from 'react';
import { IDspSettings } from '../../../common/dsp/chain';
import {
  ILibraryQueue,
  advanceQueue,
  currentTrackId,
} from '../../../common/library/queue';
import {
  ILibraryProgrammeEdges,
  ILibraryTrack,
} from '../../../common/library/types';
import {
  analyzeInputTrack,
  masterLoudnessGainDb,
  normalizerGainDb,
} from '../../dsp/inputNormalizer';
import { setDspInputAnalysis } from '../../dsp/store';
import { setDspTrackLevelGains } from '../../dsp/useDspEngine';

export interface ITrackAnalysisDeps {
  track: ILibraryTrack | undefined;
  trackId: string | undefined;
  queue: ILibraryQueue | undefined;
  trackById: Map<string, ILibraryTrack>;
  dspSettings: IDspSettings;
  dspSettingsRef: MutableRefObject<IDspSettings>;
  trackIdRef: MutableRefObject<string | undefined>;
  audioElementRef: MutableRefObject<HTMLAudioElement | undefined>;
  elementTrackRef: MutableRefObject<Map<HTMLMediaElement, string>>;
  programmeEdgesRef: MutableRefObject<
    Map<HTMLMediaElement, ILibraryProgrammeEdges>
  >;
  /** The single claim both effects compete for. See above. */
  analysisJobRef: MutableRefObject<
    { trackId: string; controller: AbortController } | undefined
  >;
}

export const useTrackAnalysis = (deps: ITrackAnalysisDeps): void => {
  const {
    track,
    trackId,
    queue,
    trackById,
    dspSettings,
    dspSettingsRef,
    trackIdRef,
    audioElementRef,
    elementTrackRef,
    programmeEdgesRef,
    analysisJobRef,
  } = deps;

  /**
   * Measure the NEXT track while this one plays.
   *
   * Without this, an uncached track starts at raw unity and steps to its
   * chosen gain over two seconds once the analysis lands — an audible level
   * move at the top of a song, and the one place where per-track loudness
   * matching is heard doing its job instead of doing it invisibly. It is also
   * the worst possible moment for it: the opening bars are where somebody is
   * deciding whether the record is at the right level.
   *
   * Measured here rather than made faster, because the decode is the cost and
   * the decode cannot be skipped. A track measured before it is reached starts
   * at its final gain from the first sample.
   *
   * Deliberately subordinate to the playing track's own analysis: while
   * `analysisJobRef` holds a job, the audible track is still being measured
   * and two full decodes at once would make the window drop frames to prepare
   * a song nobody is listening to yet.
   */
  useEffect(() => {
    const wantsLoudness =
      dspSettings.normalizer.mode !== 'off' ||
      (dspSettings.master.enabled && dspSettings.master.loudnessMaximize);
    if (!dspSettings.enabled || !wantsLoudness || !queue || !track) {
      return undefined;
    }
    // The queue's own rules decide what comes next — shuffle order, repeat,
    // the end of the shelf. Reimplementing them here is how a prefetch comes
    // to measure a track the player was never going to reach.
    const nextId = currentTrackId(advanceQueue(queue, 1));
    const next =
      nextId && nextId !== track.id ? trackById.get(nextId) : undefined;
    if (
      !next ||
      next.kind !== 'audio' ||
      next.normalization ||
      analysisJobRef.current
    ) {
      return undefined;
    }

    let cancelled = false;
    const controller = new AbortController();
    const measure = async () => {
      const [buffer, signature] = await Promise.all([
        window.electron.ipcRenderer.libraryTrackBytes(next.id),
        window.electron.ipcRenderer.libraryTrackSignature(next.id),
      ]);
      if (!buffer || cancelled) {
        return;
      }
      const analysis = await analyzeInputTrack(buffer, {
        sampleRateHint: next.sampleRate,
        signal: controller.signal,
        // Yields to the playing track: if its loader starts a job mid-decode,
        // this one stops rather than competing for the same window.
        isCancelled: () => cancelled || analysisJobRef.current !== undefined,
        // Nothing is published while this runs. The panel's progress belongs
        // to the track being listened to, and a second bar for a song that has
        // not started reads as the current one having gone backwards.
        onProgress: () => undefined,
      });
      if (!analysis || cancelled) {
        return;
      }
      await window.electron.ipcRenderer.setLibraryTrackNormalization(
        next.id,
        analysis,
        signature ?? {
          sizeBytes: next.sizeBytes,
          mtimeMs: next.mtimeMs,
        },
      );
    };
    measure().catch(() => undefined);
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [dspSettings, queue, track, trackById, analysisJobRef]);

  /**
   * Enabling normalization or the crossfade while an already-playing uncached
   * track is active.
   *
   * The ordinary loader already measures in the background. This path exists
   * for the one situation where it deliberately did not: the track was
   * started while both were off. The linked gain ramps once when analysis
   * completes; it never follows short-term level afterwards.
   */
  useEffect(() => {
    const wantsLoudness =
      (dspSettings.normalizer.mode !== 'off' ||
        (dspSettings.master.enabled && dspSettings.master.loudnessMaximize)) &&
      !track?.normalization;
    // A track already measured for loudness can still be missing its edges,
    // either because it was analyzed before they were measured at all or
    // because the crossfade was switched on after it started.
    const wantsEdges =
      dspSettings.crossfade.enabled && !track?.normalization?.edges;
    // Same shape as the edges above: a track measured before Denoise existed,
    // or measured while the stage was off, is still missing this half.
    const wantsNoise =
      dspSettings.denoise.enabled &&
      dspSettings.denoise.profileSource === 'scanned' &&
      (dspSettings.denoise.hiss.enabled || dspSettings.denoise.hum.enabled) &&
      !track?.normalization?.noise;
    if (
      !dspSettings.enabled ||
      (!wantsLoudness && !wantsEdges && !wantsNoise) ||
      !track ||
      track.kind !== 'audio' ||
      analysisJobRef.current?.trackId === track.id
    ) {
      return undefined;
    }
    let cancelled = false;
    analysisJobRef.current?.controller.abort();
    const analysisJob = {
      trackId: track.id,
      controller: new AbortController(),
    };
    analysisJobRef.current = analysisJob;
    setDspInputAnalysis({
      trackId: track.id,
      status: 'analyzing',
      fraction: 0,
    });
    const analyze = async () => {
      const [buffer, signature] = await Promise.all([
        window.electron.ipcRenderer.libraryTrackBytes(track.id),
        window.electron.ipcRenderer.libraryTrackSignature(track.id),
      ]);
      if (!buffer || cancelled) {
        return;
      }
      const analysis = await analyzeInputTrack(buffer, {
        sampleRateHint: track.sampleRate,
        signal: analysisJob.controller.signal,
        isCancelled: () => cancelled || analysisJobRef.current !== analysisJob,
        measureNoise: wantsNoise,
        onProgress: ({ fraction }) => {
          if (!cancelled && analysisJobRef.current === analysisJob) {
            setDspInputAnalysis({
              trackId: track.id,
              status: 'analyzing',
              fraction,
            });
          }
        },
      });
      if (
        !analysis ||
        cancelled ||
        analysisJobRef.current !== analysisJob ||
        trackIdRef.current !== track.id
      ) {
        if (
          !analysis &&
          !cancelled &&
          analysisJobRef.current === analysisJob &&
          !analysisJob.controller.signal.aborted
        ) {
          setDspInputAnalysis({
            trackId: track.id,
            status: 'unavailable',
            fraction: 0,
          });
        }
        return;
      }
      const deck = audioElementRef.current;
      if (
        analysis.edges &&
        deck &&
        elementTrackRef.current.get(deck) === track.id
      ) {
        programmeEdgesRef.current.set(deck, analysis.edges);
      }
      setDspInputAnalysis({
        trackId: track.id,
        status: 'ready',
        fraction: 1,
        analysis,
      });
      setDspTrackLevelGains(
        normalizerGainDb(dspSettingsRef.current.normalizer, analysis),
        masterLoudnessGainDb(
          dspSettingsRef.current.master,
          dspSettingsRef.current.normalizer,
          analysis,
        ),
      );
      await window.electron.ipcRenderer.setLibraryTrackNormalization(
        track.id,
        analysis,
        signature ?? {
          sizeBytes: track.sizeBytes,
          mtimeMs: track.mtimeMs,
        },
      );
    };
    analyze()
      .catch(() => {
        if (
          !cancelled &&
          analysisJobRef.current === analysisJob &&
          !analysisJob.controller.signal.aborted
        ) {
          setDspInputAnalysis({
            trackId: track.id,
            status: 'unavailable',
            fraction: 0,
          });
        }
      })
      .finally(() => {
        if (analysisJobRef.current === analysisJob) {
          analysisJobRef.current = undefined;
        }
      });
    return () => {
      cancelled = true;
      analysisJob.controller.abort();
      if (analysisJobRef.current === analysisJob) {
        analysisJobRef.current = undefined;
      }
    };
  }, [
    dspSettings.crossfade.enabled,
    dspSettings.denoise.enabled,
    dspSettings.denoise.hiss.enabled,
    dspSettings.denoise.hum.enabled,
    dspSettings.denoise.profileSource,
    dspSettings.enabled,
    dspSettings.master.enabled,
    dspSettings.master.loudnessMaximize,
    dspSettings.normalizer.mode,
    track,
    trackId,
    // Refs, so this list never actually moves — spelled out because the rule
    // cannot see that through a parameter object.
    analysisJobRef,
    audioElementRef,
    dspSettingsRef,
    elementTrackRef,
    programmeEdgesRef,
    trackIdRef,
  ]);
};
