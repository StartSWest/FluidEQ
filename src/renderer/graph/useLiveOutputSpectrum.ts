import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import {
  BALANCE_FRAME_INTERVAL_MS,
  IAxisCell,
  IBalanceCaptureState,
  IBalanceProgress,
  IBalanceResult,
  accumulateBalanceFrame,
  buildBalanceProgress,
  buildBalanceResult,
  createAxisCells,
  createBalanceCaptureState,
  evaluateBalanceCapture,
  isBalanceCheckDue,
  readAbsoluteLevels,
  shouldFinishBalanceCapture,
} from '../utils/autoBalance';
import { IChartPointData } from './ChartController';

const FFT_SIZE = 4096;
const MIN_FREQUENCY = 20;
const MAX_FREQUENCY = 20000;
const POINT_COUNT = 320;
const WAVEFORM_POINT_COUNT = 96;
const UPDATE_INTERVAL_MS = BALANCE_FRAME_INTERVAL_MS;

// The analyser reports dBFS (roughly -100..0) but the response graph's y axis
// is EQ gain (-20..+20 dB). Plotting dBFS straight onto it pushed the trace
// far below the plot at any sane listening level, so the curve only appeared
// when the output was pinned near full scale.
//
// Instead the spectrum is drawn relative to its own loudest bin: the peak sits
// near the top of the plot and everything below it keeps its true relative
// level. The shape stays readable at any volume, and the curve still rises and
// falls with EQ changes because only the reference moves, not the shape.
/** Chart position, in dB, given to the loudest bin of the current frame. */
const LIVE_PEAK_DISPLAY_DB = MAX_GAIN - 4;
/** Below this the output is silence; there is no meaningful shape to show. */
const LIVE_SILENCE_DB = -95;
/** Smoothing for the reference level so the trace does not jump frame to
 * frame. Higher keeps more of the previous reference. */
const LIVE_REFERENCE_SMOOTHING = 0.86;

/** Wall-clock silence after which the capture status says so. */
const SILENCE_HINT_MS = 3000;
/** Wall-clock silence after which the capture gives up rather than hang. */
const SILENCE_ABORT_MS = 15000;
/**
 * Independent wall-clock backstop. Every other timer counts *listened* time,
 * which stops advancing entirely if the renderer is starved; this guarantees
 * the promise settles even then.
 */
const WATCHDOG_MS = 120000;

/** Log-spaced analysis frequencies. Constant for a given sample rate. */
const createFrequencyAxis = (sampleRate: number): number[] => {
  const logMin = Math.log10(MIN_FREQUENCY);
  const logMax = Math.log10(Math.min(MAX_FREQUENCY, sampleRate / 2));
  return Array.from(
    { length: POINT_COUNT },
    (_value, index) =>
      10 ** (logMin + (index / (POINT_COUNT - 1)) * (logMax - logMin)),
  );
};

const createFrequencyPoints = (
  axis: number[],
  levels: Float64Array,
  referenceDb: number,
): IChartPointData[] =>
  axis.map((frequency, index) => {
    const level = levels[index];
    const relative = Number.isFinite(level)
      ? level - referenceDb + LIVE_PEAK_DISPLAY_DB
      : MIN_GAIN;
    return {
      x: frequency,
      y: Math.min(MAX_GAIN, Math.max(MIN_GAIN, relative)),
    };
  });

/** Loudest finite bin in the frame, or undefined when the output is silent. */
const getPeakLevel = (frequencyData: Float32Array): number | undefined => {
  let peak = -Infinity;
  for (let index = 0; index < frequencyData.length; index += 1) {
    const level = frequencyData[index];
    if (Number.isFinite(level) && level > peak) {
      peak = level;
    }
  }
  return peak > LIVE_SILENCE_DB ? peak : undefined;
};

const createWaveformPoints = (timeDomainData: Uint8Array) => {
  const bucketSize = timeDomainData.length / WAVEFORM_POINT_COUNT;
  return Array.from({ length: WAVEFORM_POINT_COUNT }, (_value, index) => {
    const start = Math.floor(index * bucketSize);
    const end = Math.max(start + 1, Math.floor((index + 1) * bucketSize));
    let peak = 0;
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      peak = Math.max(peak, Math.abs(timeDomainData[sampleIndex] - 128) / 128);
    }
    return peak;
  });
};

const captureSystemOutput = async (): Promise<MediaStream> => {
  if (!navigator.mediaDevices) {
    throw new Error('Media capture is not available in this environment.');
  }

  let displayCaptureError: unknown;
  // Prefer getDisplayMedia. Electron's main-process handler supplies a
  // harmless window video source plus the Windows loopback audio stream. This
  // avoids the legacy desktop constraints trying to open a physical monitor.
  if (navigator.mediaDevices.getDisplayMedia) {
    try {
      return await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: true,
      });
    } catch (captureError) {
      displayCaptureError = captureError;
    }
  }

  if (!navigator.mediaDevices.getUserMedia) {
    throw (
      displayCaptureError ||
      new Error(
        'Desktop loopback capture is not available in this environment.',
      )
    );
  }

  try {
    // Legacy fallback for older Electron builds. Newer builds use the
    // display-media handler above, but keeping this path makes the analyser
    // usable in a preview/portable environment too.
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop',
        },
      },
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
        },
      },
    } as MediaStreamConstraints);
  } catch (legacyCaptureError) {
    throw legacyCaptureError || displayCaptureError;
  }
};

export interface IBalanceCaptureOptions {
  signal?: AbortSignal;
  onProgress?: (progress: IBalanceProgress) => void;
}

/** An auto-balance measurement in flight. */
interface IBalanceSession {
  state: IBalanceCaptureState;
  /** Identifies the analysis axis; a change means the device changed. */
  axisKey: string;
  onProgress?: (progress: IBalanceProgress) => void;
  detachAbort: () => void;
  watchdog: ReturnType<typeof setTimeout>;
  lastAcceptedWallMs: number;
  lastPercent: number;
  wasSilent: boolean;
  wasPaused: boolean;
  settled: boolean;
  resolve: (value: IBalanceResult) => void;
  reject: (reason: Error) => void;
}

const useLiveOutputSpectrum = () => {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState('');
  const [points, setPoints] = useState<IChartPointData[]>([]);
  const [waveform, setWaveform] = useState<number[]>([]);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const audioContextRef = useRef<AudioContext | undefined>(undefined);
  const pumpRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const isStartingRef = useRef(false);
  const autoStartRef = useRef(true);
  const isPausedRef = useRef(false);
  const scheduleStartRef = useRef<() => void>(() => undefined);
  const sessionRef = useRef<IBalanceSession | undefined>(undefined);
  // Mirrors `points` so the silence branch can avoid publishing a fresh empty
  // array 22 times a second for the whole of a long capture.
  const pointsRef = useRef<IChartPointData[]>([]);

  const togglePaused = useCallback(() => {
    // Derived from the ref rather than the state updater: React may invoke an
    // updater more than once, which would flip the ref out of sync.
    const next = !isPausedRef.current;
    isPausedRef.current = next;
    setIsPaused(next);
  }, []);

  /** The only place a capture promise is settled. Idempotent. */
  const settleBalance = useCallback((outcome: IBalanceResult | Error) => {
    const session = sessionRef.current;
    if (!session || session.settled) {
      return;
    }
    session.settled = true;
    clearTimeout(session.watchdog);
    session.detachAbort();
    sessionRef.current = undefined;
    if (outcome instanceof Error) {
      session.reject(outcome);
    } else {
      session.resolve(outcome);
    }
  }, []);

  const abortBalance = useCallback(
    (message: string) => settleBalance(new Error(message)),
    [settleBalance],
  );

  const stop = useCallback(() => {
    // A capture must never outlive the stream it is measuring.
    abortBalance('The output stream stopped before the measurement finished.');
    if (pumpRef.current !== undefined) {
      clearInterval(pumpRef.current);
      pumpRef.current = undefined;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = undefined;
    setIsActive(false);
    isPausedRef.current = false;
    setIsPaused(false);
    pointsRef.current = [];
    setPoints([]);
    setWaveform([]);
  }, [abortBalance]);

  /**
   * Score the running capture, publish progress, and finish it when the
   * measurement has heard enough.
   */
  const evaluateSession = useCallback(
    (session: IBalanceSession, nowMs: number) => {
      const silentFor = nowMs - session.lastAcceptedWallMs;
      const paused = isPausedRef.current;
      const silent = !paused && silentFor >= SILENCE_HINT_MS;

      if (silentFor >= SILENCE_ABORT_MS) {
        if (session.state.acceptedFrames === 0) {
          abortBalance(
            paused
              ? 'The analyser is paused, so the measurement stopped.'
              : 'No sound was playing. Start some music and measure again.',
          );
        } else {
          // Something was heard: keep it rather than throwing the work away.
          settleBalance(
            buildBalanceResult(evaluateBalanceCapture(session.state)),
          );
        }
        return;
      }

      if (!isBalanceCheckDue(session.state)) {
        // Still surface a paused/silent flip immediately, so the status does
        // not sit on a stale "Listening 40%" while nothing is playing.
        if (silent !== session.wasSilent || paused !== session.wasPaused) {
          session.wasSilent = silent;
          session.wasPaused = paused;
          session.onProgress?.({
            percent: session.lastPercent,
            weakestLabel: '',
            isSettling: false,
            isSilent: silent,
            isPaused: paused,
            listenedMs: session.state.listenedMs,
          });
        }
        return;
      }

      const report = evaluateBalanceCapture(session.state);
      const progress = buildBalanceProgress(report, session.lastPercent, {
        isSilent: silent,
        isPaused: paused,
      });
      session.lastPercent = progress.percent;
      session.wasSilent = silent;
      session.wasPaused = paused;
      session.onProgress?.(progress);

      if (shouldFinishBalanceCapture(report)) {
        settleBalance(buildBalanceResult(report));
      }
    },
    [abortBalance, settleBalance],
  );

  const start = useCallback(async (): Promise<boolean> => {
    if (!autoStartRef.current || streamRef.current || isStartingRef.current) {
      return Boolean(streamRef.current);
    }

    isStartingRef.current = true;
    setError('');
    let stream: MediaStream | undefined;
    let audioContext: AudioContext | undefined;
    try {
      stream = await captureSystemOutput();
      stream.getVideoTracks().forEach((track) => {
        track.enabled = false;
      });

      const [audioTrack] = stream.getAudioTracks();
      if (!audioTrack) {
        throw new Error('Windows did not provide a system-audio stream.');
      }

      audioContext = new AudioContext();
      const activeAudioContext = audioContext;
      await activeAudioContext.resume();
      const analyser = activeAudioContext.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.minDecibels = -100;
      analyser.maxDecibels = 0;
      analyser.smoothingTimeConstant = 0.62;
      activeAudioContext.createMediaStreamSource(stream).connect(analyser);

      streamRef.current = stream;
      audioContextRef.current = activeAudioContext;
      setIsActive(true);

      const frequencyData = new Float32Array(analyser.frequencyBinCount);
      const timeDomainData = new Uint8Array(analyser.fftSize);
      const axis = createFrequencyAxis(activeAudioContext.sampleRate);
      const cells: IAxisCell[] = createAxisCells(
        axis,
        activeAudioContext.sampleRate,
        FFT_SIZE,
      );
      const levelBuffer = new Float64Array(axis.length);
      const axisKey = String(Math.round(activeAudioContext.sampleRate));
      let referenceDb: number | undefined;

      const pump = () => {
        const session = sessionRef.current;

        if (isPausedRef.current) {
          // Keep the silence/pause clock running so a paused capture still
          // reports and eventually gives up.
          if (session) {
            evaluateSession(session, performance.now());
          }
          return;
        }

        analyser.getFloatFrequencyData(frequencyData);
        analyser.getByteTimeDomainData(timeDomainData);
        readAbsoluteLevels(frequencyData, cells, levelBuffer);
        const peak = getPeakLevel(frequencyData);

        if (peak === undefined) {
          referenceDb = undefined;
          if (pointsRef.current.length > 0) {
            pointsRef.current = [];
            setPoints(pointsRef.current);
          }
        } else {
          referenceDb =
            referenceDb === undefined
              ? peak
              : referenceDb * LIVE_REFERENCE_SMOOTHING +
                peak * (1 - LIVE_REFERENCE_SMOOTHING);
          pointsRef.current = createFrequencyPoints(
            axis,
            levelBuffer,
            referenceDb,
          );
          setPoints(pointsRef.current);
        }
        setWaveform(createWaveformPoints(timeDomainData));

        if (!session) {
          return;
        }
        if (session.axisKey !== axisKey) {
          // Index-to-frequency changed underneath the accumulator. Mixing two
          // axes yields frequency-shifted garbage, which is the worst possible
          // input to an EQ writer. Never resample — abort.
          abortBalance('The output format changed while measuring. Try again.');
          return;
        }
        if (peak !== undefined) {
          accumulateBalanceFrame(session.state, {
            levels: levelBuffer,
            peakDb: peak,
            timestampMs: performance.now(),
          });
          session.lastAcceptedWallMs = performance.now();
        }
        evaluateSession(session, performance.now());
      };

      // An interval rather than requestAnimationFrame: rAF stops completely
      // while the window is minimised, which is exactly what a user does
      // during a long measurement.
      pumpRef.current = setInterval(pump, UPDATE_INTERVAL_MS);

      audioTrack.addEventListener(
        'ended',
        () => {
          abortBalance('The audio device changed while measuring. Try again.');
          stop();
          // Let the current capture promise finish before retrying. This
          // avoids the in-flight guard suppressing the restart.
          setTimeout(() => scheduleStartRef.current(), 0);
        },
        { once: true },
      );
      return true;
    } catch (captureError) {
      stream?.getTracks().forEach((track) => track.stop());
      audioContext?.close().catch(() => undefined);
      stop();
      setError(
        captureError instanceof Error
          ? captureError.message
          : 'Unable to capture the processed system output.',
      );
      return false;
    } finally {
      isStartingRef.current = false;
    }
  }, [abortBalance, evaluateSession, stop]);

  /**
   * Listen until every frequency region has been heard well enough to correct,
   * then resolve with the averaged spectrum.
   *
   * There is no fixed duration: a broadband track settles in a few seconds,
   * sparse material takes longer, and a source that never covers the range
   * resolves as `partial` with the range it did measure.
   */
  const captureBalanceProfile = useCallback(
    (options: IBalanceCaptureOptions = {}) =>
      new Promise<IBalanceResult>((resolve, reject) => {
        const audioContext = audioContextRef.current;
        if (!streamRef.current || !audioContext) {
          reject(
            new Error(
              'The live output analyser is not running, so there is nothing to measure.',
            ),
          );
          return;
        }
        if (sessionRef.current) {
          reject(new Error('A measurement is already running.'));
          return;
        }
        if (options.signal?.aborted) {
          reject(new DOMException('Measurement cancelled.', 'AbortError'));
          return;
        }

        const axis = createFrequencyAxis(audioContext.sampleRate);
        const onAbort = () =>
          settleBalance(
            new DOMException('Measurement cancelled.', 'AbortError'),
          );
        options.signal?.addEventListener('abort', onAbort);

        sessionRef.current = {
          state: createBalanceCaptureState(axis),
          axisKey: String(Math.round(audioContext.sampleRate)),
          onProgress: options.onProgress,
          detachAbort: () =>
            options.signal?.removeEventListener('abort', onAbort),
          watchdog: setTimeout(
            () => abortBalance('The measurement timed out. Try again.'),
            WATCHDOG_MS,
          ),
          lastAcceptedWallMs: performance.now(),
          lastPercent: 0,
          wasSilent: false,
          wasPaused: isPausedRef.current,
          settled: false,
          resolve,
          reject,
        };
      }),
    [abortBalance, settleBalance],
  );

  const scheduleStart = useCallback(() => {
    if (
      !autoStartRef.current ||
      streamRef.current ||
      isStartingRef.current ||
      retryTimerRef.current !== undefined
    ) {
      return;
    }

    start().then((didStart) => {
      if (!didStart && autoStartRef.current) {
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = undefined;
          scheduleStartRef.current();
        }, 2500);
      }
      return didStart;
    });
  }, [start]);

  useEffect(() => {
    scheduleStartRef.current = scheduleStart;
  }, [scheduleStart]);

  useEffect(() => {
    autoStartRef.current = true;
    // JSDOM and non-Electron preview environments do not expose media
    // capture. Avoid scheduling a failing retry loop there; Electron's
    // renderer always has mediaDevices when the live analyser is available.
    if (navigator.mediaDevices) {
      scheduleStart();
    }

    return () => {
      autoStartRef.current = false;
      if (retryTimerRef.current !== undefined) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = undefined;
      }
      abortBalance('FluidEQ closed the measurement.');
      stop();
    };
  }, [abortBalance, scheduleStart, stop]);

  return {
    captureBalanceProfile,
    error,
    isActive,
    isPaused,
    points,
    togglePaused,
    waveform,
  };
};

export default useLiveOutputSpectrum;
