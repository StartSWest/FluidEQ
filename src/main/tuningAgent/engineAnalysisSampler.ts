/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Multi-frame live acoustic sampler built on top of `engineAnalysisPipe.ts`.
 *
 * Paces retries across renderer paint frames (`requestAnimationFrame`, never a
 * timer) only while the window is focused and unthrottled so 2048-sample FFT
 * windows (~43 ms) have time to fill without stalling when FluidEQ is occluded.
 */

import type { BrowserWindow } from 'electron';
import type { IEngineAnalysis } from '../../common/dsp/engineAnalysis';
import type { IEnginePreamp } from '../../common/enginePreamp';
import {
  releaseEndpointMeters,
  requestEndpointFrames,
  requestEndpointPreamp,
} from '../engineAnalysisPipe';

const preferPreamp = (
  best: IEnginePreamp | undefined,
  entry: IEnginePreamp | undefined,
): IEnginePreamp | undefined =>
  entry &&
  (!best || (entry.active && (!best.active || entry.gainDb < best.gainDb)))
    ? entry
    : best;

const preferLoudest = (
  best: IEngineAnalysis | undefined,
  entry: IEngineAnalysis | undefined,
): IEngineAnalysis | undefined =>
  entry &&
  (!best || Math.max(...entry.frame.peaks) > Math.max(...best.frame.peaks))
    ? entry
    : best;

const hasSpectrum = (entry: IEngineAnalysis): boolean =>
  Object.keys(entry.frame.spectra).length > 0;

/**
 * Wait one renderer paint frame (~16.6 ms on 60 Hz) ONLY while the window is
 * focused (unthrottled). Background/occluded Electron windows throttle rAF to
 * ~1 Hz under `backgroundThrottling: true`, so never wait on rAF unless focused.
 */
const waitForPaintTick = async (
  getMainWindow: () => BrowserWindow | null,
): Promise<boolean> => {
  const win = getMainWindow();
  if (
    !win ||
    win.isDestroyed() ||
    !win.isVisible() ||
    win.isMinimized() ||
    !win.isFocused() ||
    win.webContents.isDestroyed()
  ) {
    return false;
  }
  try {
    await win.webContents.executeJavaScript(
      'new Promise((resolve) => requestAnimationFrame(() => resolve(true)))',
    );
    return true;
  } catch {
    return false;
  }
};

const createEngineAnalysisSampler =
  (getMainWindow: () => BrowserWindow | null) =>
  async (
    endpointGuid: string,
    targetFrames = 6,
  ): Promise<{ frames: IEngineAnalysis[]; preamp?: IEnginePreamp }> => {
    const preampAnswers = await requestEndpointPreamp(endpointGuid);
    const preamp = preampAnswers.reduce(preferPreamp, undefined);
    const count = Math.max(1, Math.min(20, Math.round(targetFrames)));
    const spectralFrames: IEngineAnalysis[] = [];
    const fallbackFrames: IEngineAnalysis[] = [];
    let emptyTicks = 0;
    let maxEmptyTicks = 8;

    try {
      while (spectralFrames.length < count && emptyTicks < maxEmptyTicks) {
        const batch = await requestEndpointFrames(endpointGuid);
        if (batch === null) {
          break;
        }
        const loudest = batch.reduce(preferLoudest, undefined);
        if (loudest && hasSpectrum(loudest)) {
          spectralFrames.push(loudest);
          emptyTicks = 0;
        } else {
          if (loudest) {
            fallbackFrames.push(loudest);
          }
          emptyTicks += 1;
        }
        if (spectralFrames.length < count && emptyTicks < maxEmptyTicks) {
          const paced = await waitForPaintTick(getMainWindow);
          if (!paced) {
            maxEmptyTicks = 3;
          }
        }
      }
    } finally {
      releaseEndpointMeters(endpointGuid);
    }

    const frames = spectralFrames.length > 0 ? spectralFrames : fallbackFrames;
    return { frames, ...(preamp ? { preamp } : {}) };
  };

export default createEngineAnalysisSampler;
