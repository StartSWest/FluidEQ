/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
import { useEffect } from 'react';
import { ANALYSIS_BINS, IHostAnalysis } from '../../common/dsp/analysisWire';
import { getAudioDevices } from '../utils/equalizerApi';
import { reportError } from '../utils/logger';
import { createNativeMeters } from './nativeMeters';
import { setDspSampleRate } from './store';

/** External audio has no Library host. Read the real system rack's taps. */
const useSystemMeters = (enabled: boolean): void => {
  useEffect(() => {
    const read = window.electron?.ipcRenderer?.readDspEngineAnalysis;
    if (!enabled || typeof read !== 'function') {
      return undefined;
    }
    let disposed = false;
    let generation = 0;
    let animation = 0;
    let endpoint: string | undefined;
    let accept: ((frame: IHostAnalysis) => void) | undefined;
    let meters: ReturnType<typeof createNativeMeters> | undefined;
    const release = () => {
      meters?.release(true);
      meters = undefined;
      accept = undefined;
    };
    const stop = () => {
      generation += 1;
      cancelAnimationFrame(animation);
      endpoint = undefined;
      release();
      read(null).catch((error: unknown) =>
        reportError('stopping system DSP meters', error),
      );
    };
    const paint = async () => {
      const current = generation;
      if (disposed || document.hidden || !endpoint) {
        return;
      }
      try {
        const result = await read(endpoint);
        if (disposed || current !== generation) {
          return;
        }
        if (result) {
          if (!meters) {
            meters = createNativeMeters(
              {
                // Requests are owned by this paint loop, not the Library host.
                setDspHostAnalysis: async () => true,
                onDspHostAnalysis: (listener) => {
                  accept = listener;
                  return () => {
                    accept = undefined;
                  };
                },
              },
              ANALYSIS_BINS,
            );
          }
          setDspSampleRate(result.sampleRate);
          accept?.(result.frame);
        } else if (result === null) {
          release();
        }
      } catch (error) {
        reportError('reading system DSP meters', error);
        stop();
        return;
      }
      if (!disposed && current === generation) {
        animation = requestAnimationFrame(paint);
      }
    };
    const start = async () => {
      stop();
      if (disposed || document.hidden) {
        return;
      }
      const current = generation;
      try {
        const devices = await getAudioDevices();
        if (disposed || current !== generation) {
          return;
        }
        endpoint = devices.find((device) => device.isDefault)?.guid;
        if (endpoint) {
          animation = requestAnimationFrame(paint);
        }
      } catch (error) {
        reportError('finding the output for system DSP meters', error);
      }
    };
    start();
    window.addEventListener('fluideq-output-changed', start);
    document.addEventListener('visibilitychange', start);
    return () => {
      disposed = true;
      stop();
      window.removeEventListener('fluideq-output-changed', start);
      document.removeEventListener('visibilitychange', start);
    };
  }, [enabled]);
};

export default useSystemMeters;
