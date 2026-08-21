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

import { useEffect, useRef } from 'react';
import { getDriverFilters } from 'common/driver';
import { getHeadphoneFilters } from 'common/headphone';
import { getSmartEqFilters } from 'common/smartEq';
import { getVoicingFilters } from 'common/voicing';
import { IGraphicEqPoint, TApoLayer } from '../common/constants';
import {
  getResponseGainAtFrequencies,
  ICombinedResponse,
} from '../common/response';
import { IProgrammePoint } from '../common/smartHeadroom';
import { useLiveAudioControl } from './audio/LiveAudioContext';
import {
  createAxisCells,
  IAxisCell,
  readAbsoluteLevels,
} from './utils/autoBalanceCapture';
import { sendSmartHeadroomMeasurement } from './utils/equalizerApi';
import { useFluidEqContext } from './utils/FluidEqContext';
import {
  accumulateHeadroomFrame,
  advanceSupervisorTrimDb,
  createHeadroomCaptureState,
  readHeadroomProgramme,
  shouldPushMeasurement,
} from './utils/headroomCapture';
import { createFrequencyAxis, FFT_SIZE } from './graph/liveSpectrumFrames';

/**
 * Listening, so that auto-normalize can reserve what the music needs.
 *
 * Headless. It measures and reports; it never sets a preamp. The config writer
 * in the main process owns that number and derives it from the chain it is
 * about to write, which is what keeps a single writer for a value that decides
 * whether somebody's music distorts. What travels over IPC from here is
 * evidence — a spectrum and a trim — and never a conclusion.
 *
 * Its own analyser rather than the display pump's, for two reasons. The trace
 * is smoothed for the eye and this wants the frame as measured; and the peak
 * has to be read per channel, because down-mixing stereo to mono averages the
 * two and under-reads the true peak, which is the one number here that must
 * never read low.
 */

/** Analyser cadence. The same order as the display pump, and for the same
 * reason: fast enough that a transient is not missed between frames. */
const FRAME_INTERVAL_MS = 45;

const SmartHeadroomEngine = () => {
  const {
    bypassed,
    convolution,
    customFx,
    driver,
    filters,
    graphicEq,
    headphone,
    isAutoPreAmpOn,

    preAmp,
    smartEq,
    voicing,
  } = useFluidEqContext();
  const { capture, isActive } = useLiveAudioControl();

  /**
   * The whole applied chain, as a response the shared evaluator understands.
   *
   * EVERY layer, and the preamp with them. Smart EQ's version of this
   * deliberately leaves its own layer in so that its loop can hear its own
   * correction; this one takes everything out, because the question is not "how
   * far is the sound from where it should be" but "what was on the record
   * before any of this touched it". The preamp is part of what touched it — the
   * loopback is post-APO, proven by a 1 kHz tone sent at -26.02 dBFS coming
   * back at -32.37 against a -9.5 dB preamp — so leaving it in would have the
   * measurement chase the very number it is trying to set.
   *
   * A bypassed layer is not in the config, so nothing of it is in what the
   * analyser hears and there is nothing to remove.
   */
  const buildResponse = (): ICombinedResponse => {
    const off = (layer: TApoLayer) => (bypassed ?? []).includes(layer);
    const curves: Array<IGraphicEqPoint[] | undefined> = [];
    if (!off('eq') && graphicEq?.length) {
      curves.push(graphicEq);
    }
    if (!off('custom') && customFx?.graphicEq?.length) {
      curves.push(customFx.graphicEq);
    }
    if (
      !off('convolution') &&
      convolution?.fileName &&
      convolution.response?.length
    ) {
      curves.push(convolution.response);
    }
    return {
      filters: [
        ...(off('eq') || graphicEq?.length ? [] : Object.values(filters)),
        ...(off('driver') ? [] : getDriverFilters(driver)),
        ...(off('headphone') ? [] : getHeadphoneFilters(headphone)),
        ...(off('voicing') ? [] : getVoicingFilters(voicing)),
        ...(off('smart') ? [] : getSmartEqFilters(smartEq)),
        ...(off('custom') || !customFx ? [] : Object.values(customFx.filters)),
        ...(off('convolution') || !convolution || convolution.fileName
          ? []
          : Object.values(convolution.filters || {})),
      ],
      curves,
      constantGain: preAmp + (off('custom') ? 0 : (customFx?.preAmp ?? 0)),
    };
  };

  // Held on a ref so the sixty-times-a-second loop below reads the current
  // chain without being rebuilt every time somebody nudges a band.
  const buildResponseRef = useRef(buildResponse);
  buildResponseRef.current = buildResponse;

  const isOn = isAutoPreAmpOn;

  useEffect(() => {
    if (!isOn || !isActive || !capture) {
      return undefined;
    }
    const { context, source } = capture;

    const analyser = context.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.minDecibels = -100;
    analyser.maxDecibels = 0;
    // Unsmoothed, unlike the trace. Smoothing is for the eye; a maximum built
    // out of smoothed frames is a maximum of something that never happened.
    analyser.smoothingTimeConstant = 0;
    source.connect(analyser);

    // Per channel, because the supervisor's peak must not be the average of
    // two channels. A splitter with one analyser per channel is what the level
    // meter does, and for exactly this reason.
    const channelCount = Math.max(1, source.channelCount);
    const splitter = context.createChannelSplitter(channelCount);
    source.connect(splitter);
    const peakAnalysers: AnalyserNode[] = [];
    // Typed against a plain ArrayBuffer rather than the default, which the DOM
    // types widen to include SharedArrayBuffer — a buffer `getFloatTimeDomainData`
    // will not accept.
    const peakSamples: Float32Array<ArrayBuffer>[] = [];
    for (let channel = 0; channel < channelCount; channel += 1) {
      const peakAnalyser = context.createAnalyser();
      peakAnalyser.fftSize = 2048;
      splitter.connect(peakAnalyser, channel);
      peakAnalysers.push(peakAnalyser);
      peakSamples.push(
        new Float32Array(new ArrayBuffer(peakAnalyser.fftSize * 4)),
      );
    }

    const axis = createFrequencyAxis(context.sampleRate);
    const cells: IAxisCell[] = createAxisCells(
      axis,
      context.sampleRate,
      FFT_SIZE,
    );
    const frequencyData = new Float32Array(analyser.frequencyBinCount);
    const levels = new Float64Array(axis.length);
    const state = createHeadroomCaptureState(axis);

    let trimDb = 0;
    let lastPushMs = 0;
    let lastPushedTrim = 0;
    let lastPushedProgramme: IProgrammePoint[] = [];
    let lastTickMs = performance.now();

    const changedEnough = (next: IProgrammePoint[]): number => {
      if (next.length !== lastPushedProgramme.length) {
        return Number.POSITIVE_INFINITY;
      }
      return next.reduce(
        (worst, point, index) =>
          Math.max(
            worst,
            Math.abs(point.gain - lastPushedProgramme[index].gain),
          ),
        0,
      );
    };

    const tick = () => {
      const nowMs = performance.now();
      const deltaMs = nowMs - lastTickMs;
      lastTickMs = nowMs;

      analyser.getFloatFrequencyData(frequencyData);
      readAbsoluteLevels(frequencyData, cells, levels);
      state.chainGainDb = getResponseGainAtFrequencies(
        buildResponseRef.current(),
        axis,
      );
      accumulateHeadroomFrame(state, { levels, timestampMs: nowMs });

      let peakDbfs = Number.NEGATIVE_INFINITY;
      peakAnalysers.forEach((peakAnalyser, channel) => {
        const samples = peakSamples[channel];
        peakAnalyser.getFloatTimeDomainData(samples);
        for (let index = 0; index < samples.length; index += 1) {
          const amplitude = Math.abs(samples[index]);
          if (amplitude > 0) {
            const db = 20 * Math.log10(amplitude);
            if (db > peakDbfs) {
              peakDbfs = db;
            }
          }
        }
      });
      trimDb = advanceSupervisorTrimDb(trimDb, peakDbfs, deltaMs);

      const programme = readHeadroomProgramme(state);
      if (programme.length === 0) {
        return;
      }
      if (
        !shouldPushMeasurement({
          sincePushMs: nowMs - lastPushMs,
          trimDb,
          lastPushedTrimDb: lastPushedTrim,
          programmeDeltaDb: changedEnough(programme),
        })
      ) {
        return;
      }
      lastPushMs = nowMs;
      lastPushedTrim = trimDb;
      lastPushedProgramme = programme;
      sendSmartHeadroomMeasurement(programme, trimDb);
    };

    const timer = window.setInterval(tick, FRAME_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      analyser.disconnect();
      splitter.disconnect();
      peakAnalysers.forEach((peakAnalyser) => peakAnalyser.disconnect());
    };
  }, [capture, isActive, isOn]);

  return null;
};

export default SmartHeadroomEngine;
