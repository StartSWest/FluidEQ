import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import {
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

/**
 * The analyser window, and the one source of lag nothing downstream can undo.
 *
 * An FFT describes a whole window of audio at once, so the result is only ever
 * as current as the middle of it: 4096 samples is 85ms of sound at 48kHz, and
 * a kick inside it is reported some 43ms after it actually hit. Easing,
 * interpolation and frame rate all sit after that and can only ever make the
 * delay smoother, never shorter.
 *
 * Halved, so the delay halves with it. The cost is resolution — 23Hz per bin
 * rather than 12 — which the log-spaced display bins down anyway everywhere
 * except the very bottom of the range, and which is a fair trade for a curve
 * that moves when the music does.
 */
const FFT_SIZE = 2048;
const MIN_FREQUENCY = 20;
const MAX_FREQUENCY = 20000;
const POINT_COUNT = 320;
const WAVEFORM_POINT_COUNT = 96;
/**
 * How often the analyser is read, which is most of how late the picture is.
 *
 * This used to be `BALANCE_FRAME_INTERVAL_MS` — the Smart EQ measurement's
 * cadence — and the two have no reason to be the same number. Forty-five
 * milliseconds is a fine rate at which to accumulate minutes of listening; it
 * is a poor one at which to watch a kick, because the tick alone puts the
 * drawing up to a frame behind before anything eases it.
 *
 * Safe to shorten because the measurement is driven by elapsed time rather than
 * by frame count: it reads `timestampMs` and clamps the real delta, so more
 * frames give it the same answer in more pieces. The constant stays where it is
 * and keeps doing its other job, which is bounding a stalled tick.
 */
const UPDATE_INTERVAL_MS = 20;

// The live trace shows real decibels referenced to THE TRACK, not to the
// volume knob. Windows loopback carries whatever volume is set, so an absolute
// dBFS scale would make the curve collapse the moment the user turns the
// system down — which says nothing about the music.
//
// Instead a slow peak-follower tracks the programme's own level and becomes
// the 0 dB line at the top of the plot. Every dB below that is a real dB below
// the track's own peak, so the shape and the height both mean something at any
// volume. Actual distortion is detected separately, from railed samples, so
// clipping still shows even though the reference moves.
const LIVE_FULL_SCALE_DB = MAX_GAIN;
/**
 * Reference release, in dB per frame. Rises instantly to a new peak so a louder
 * passage cannot overshoot the top, then falls about 1 dB per second — slow
 * enough to ride out a quiet bar, fast enough to follow a track change within a
 * few seconds.
 *
 * Derived from the tick rather than written as a number, because it is a rate
 * per frame and the frames got shorter. Left at the old 0.045 it would have
 * fallen at two and a half dB a second the moment the interval was cut, which
 * is the sort of thing that changes how the whole plot behaves while looking
 * like a performance fix.
 */
const TRACK_REFERENCE_RELEASE_DB = UPDATE_INTERVAL_MS / 1000;
/** Below this the output is silence; there is no meaningful shape to show. */
const LIVE_SILENCE_DB = -95;

/**
 * Digital full scale, in the 0..255 byte domain the analyser reports.
 * A run of samples pinned to either rail is the signature of a signal that has
 * been clipped somewhere upstream — usually too much EQ boost or preamp.
 */
const CLIP_RAIL_LOW = 1;
const CLIP_RAIL_HIGH = 254;
/** Consecutive railed samples before it counts. One is just a loud peak. */
const CLIP_RUN_LENGTH = 3;
/** How long a clip indication stays up after the last railed frame. */
const CLIP_HOLD_MS = 1200;

const detectClipping = (timeDomainData: Uint8Array): boolean => {
  let run = 0;
  for (let index = 0; index < timeDomainData.length; index += 1) {
    const sample = timeDomainData[index];
    if (sample <= CLIP_RAIL_LOW || sample >= CLIP_RAIL_HIGH) {
      run += 1;
      if (run >= CLIP_RUN_LENGTH) {
        return true;
      }
    } else {
      run = 0;
    }
  }
  return false;
};

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

/**
 * How long a muted capture is given before it is treated as a lost device.
 *
 * Long enough that ordinary gaps — a track change, a stream buffering, the
 * moment Equalizer APO reloads its config — pass without a restart, and short
 * enough that somebody who has just reinstalled the audio engine does not sit
 * watching a flat line wondering whether the app noticed.
 */
const DEVICE_LOST_GRACE_MS = 2500;

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

/**
 * Buffers for a frame of curve or waveform, allocated once per capture and
 * filled in place.
 *
 * The pump publishes 320 points and 96 waveform samples ~22 times a second.
 * Building them fresh meant roughly 7,100 short-lived point objects a second
 * for a curve where only the numbers changed. They come in pairs because React
 * still needs a changed array identity to re-render: the pump alternates, so
 * the array React is holding is never the one being overwritten.
 */
interface IFrameBuffers {
  points: [IChartPointData[], IChartPointData[]];
  waveform: [number[], number[]];
}

const createFrameBuffers = (): IFrameBuffers => {
  const makePoints = () =>
    Array.from({ length: POINT_COUNT }, () => ({ x: 0, y: 0 }));
  return {
    points: [makePoints(), makePoints()],
    waveform: [
      new Array(WAVEFORM_POINT_COUNT).fill(0),
      new Array(WAVEFORM_POINT_COUNT).fill(0),
    ],
  };
};

/** Shared empties, so silence and teardown never mint a fresh array. */
const NO_POINTS: IChartPointData[] = [];
const NO_WAVEFORM: number[] = [];

const writeFrequencyPoints = (
  target: IChartPointData[],
  axis: number[],
  levels: Float64Array,
  trackReferenceDb: number,
): IChartPointData[] => {
  for (let index = 0; index < target.length; index += 1) {
    const level = levels[index];
    // The track's own peak lands on the top gridline; everything below it is
    // a real dB below that peak.
    const plotted = Number.isFinite(level)
      ? level - trackReferenceDb + LIVE_FULL_SCALE_DB
      : MIN_GAIN;
    const point = target[index];
    point.x = axis[index];
    point.y = Math.min(MAX_GAIN, Math.max(MIN_GAIN, plotted));
  }
  return target;
};

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

const writeWaveformPoints = (
  target: number[],
  timeDomainData: Uint8Array,
): number[] => {
  const bucketSize = timeDomainData.length / WAVEFORM_POINT_COUNT;
  for (let index = 0; index < WAVEFORM_POINT_COUNT; index += 1) {
    const start = Math.floor(index * bucketSize);
    const end = Math.max(start + 1, Math.floor((index + 1) * bucketSize));
    let peak = 0;
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      peak = Math.max(peak, Math.abs(timeDomainData[sampleIndex] - 128) / 128);
    }
    target[index] = peak;
  }
  return target;
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
  const [isClipping, setIsClipping] = useState(false);
  const [balanceProgress, setBalanceProgress] = useState<
    IBalanceProgress | undefined
  >(undefined);
  const isClippingRef = useRef(false);
  const clipUntilRef = useRef(0);
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
  const pointsRef = useRef<IChartPointData[]>(NO_POINTS);
  const isHiddenRef = useRef(
    typeof document !== 'undefined' && document.hidden,
  );

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
    setBalanceProgress(undefined);
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
    clipUntilRef.current = 0;
    isClippingRef.current = false;
    setIsClipping(false);
    pointsRef.current = NO_POINTS;
    setPoints(NO_POINTS);
    setWaveform(NO_WAVEFORM);
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
          const flip = {
            percent: session.lastPercent,
            weakestLabel: '',
            isSettling: false,
            isSilent: silent,
            isPaused: paused,
            listenedMs: session.state.listenedMs,
            regions: [],
          };
          setBalanceProgress(flip);
          session.onProgress?.(flip);
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
      setBalanceProgress(progress);
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
      // STOPPED, not disabled — and the difference is gigabytes.
      //
      // Windows only hands out loopback audio through `getDisplayMedia`, so a
      // video track arrives whether or not anything wants one. Setting
      // `enabled = false` mutes what the track delivers and does nothing at
      // all to the source behind it: Chromium carries on capturing the screen,
      // frame after full-resolution frame, for as long as the app is open.
      // Nothing reads them, and the memory climbs without limit.
      //
      // `stop()` releases the capture itself. The audio track is unaffected —
      // a stream stays live while any of its tracks is live — and the audio is
      // the only part that was ever wanted.
      stream.getVideoTracks().forEach((track) => {
        track.stop();
        stream?.removeTrack(track);
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
      // The analyser's own averaging, and the last place lag was hiding.
      //
      // This blends each FFT with the one before it, so at 0.62 a transient
      // reached only 38% of its real height on the frame it happened, 62% on
      // the next and 76% on the third — around 135ms to mostly arrive. That is
      // ahead of everything the display does, so no amount of attack further
      // down could recover it: the peak had already been averaged away before
      // anything drew it.
      //
      // At 0.4 the same transient is 60% there immediately and 94% by the
      // third frame. That was measured against a forty-five millisecond tick,
      // where three frames is 135ms of lag on its own — and it was the largest
      // single term in a delay somebody could hear as the bass arriving before
      // the graph did.
      //
      // 0.2 is 80% there immediately and 99% by the third, and the tick above
      // is now 20ms, so the two compound the other way: the same steadying
      // costs about a fifth of the delay it used to. Still not zero, because a
      // raw FFT bin jitters frame to frame and a curve made of pure noise is
      // worse than a slow one.
      analyser.smoothingTimeConstant = 0.2;
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
      const buffers = createFrameBuffers();
      let bufferSlot = 0;
      const axisKey = String(Math.round(activeAudioContext.sampleRate));
      let trackReferenceDb: number | undefined;

      const pump = () => {
        const session = sessionRef.current;
        // Nothing to draw on and nothing to measure: the entire frame is
        // waste, down to the FFT the analyser only computes when it is read.
        // A running measurement is deliberately exempt — surviving a minimised
        // window is why this is an interval rather than requestAnimationFrame.
        const isHidden = isHiddenRef.current;
        if (isHidden && !session) {
          return;
        }

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

        let reference: number | undefined;
        if (peak !== undefined) {
          // Instant attack, slow release: follows the track, ignores the
          // volume knob, and never lets a transient push the curve off-scale.
          // Kept running while hidden so the curve is already referenced
          // correctly the moment the window comes back.
          trackReferenceDb =
            trackReferenceDb === undefined
              ? peak
              : Math.max(peak, trackReferenceDb - TRACK_REFERENCE_RELEASE_DB);
          reference = trackReferenceDb;
        }

        // Everything from here to the measurement is presentation. Behind a
        // hidden window it would publish frames nobody can see and re-render
        // every consumer to draw them.
        if (!isHidden) {
          // Alternate buffers: React needs a changed identity to re-render, so
          // the frame it is holding must not be the one being overwritten.
          bufferSlot = bufferSlot === 0 ? 1 : 0;
          if (reference === undefined) {
            if (pointsRef.current.length > 0) {
              pointsRef.current = NO_POINTS;
              setPoints(pointsRef.current);
            }
          } else {
            pointsRef.current = writeFrequencyPoints(
              buffers.points[bufferSlot],
              axis,
              levelBuffer,
              reference,
            );
            setPoints(pointsRef.current);
          }
          setWaveform(
            writeWaveformPoints(buffers.waveform[bufferSlot], timeDomainData),
          );

          // Held briefly so a single clipped frame is actually seen: at 45 ms a
          // flash would be gone before the eye registers it.
          if (detectClipping(timeDomainData)) {
            clipUntilRef.current = performance.now() + CLIP_HOLD_MS;
          }
          const clipping = performance.now() < clipUntilRef.current;
          if (clipping !== isClippingRef.current) {
            isClippingRef.current = clipping;
            setIsClipping(clipping);
          }
        }

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

      /**
       * The device went away without the track noticing.
       *
       * `ended` covers a track that stops. It does not cover the case that
       * actually happens here, which is Windows invalidating the endpoint
       * underneath a track that stays live — reinstalling Equalizer APO,
       * restarting the audio service, changing the default device. Chromium
       * reports `AUDCLNT_E_DEVICE_INVALIDATED`, quietly substitutes a *fake*
       * audio path, and carries on. The track is still there, still "live",
       * and delivering digital silence for ever.
       *
       * Which is why the trace simply stopped moving and nothing recovered it:
       * the one event being listened for was the one that never fired.
       *
       * `mute` is what does fire. It is also fired for ordinary gaps, so the
       * restart waits — a source that comes back on its own sends `unmute` and
       * cancels it, and only a mute that persists is treated as a device that
       * has gone.
       */
      let muteTimer: ReturnType<typeof setTimeout> | undefined;
      audioTrack.addEventListener('mute', () => {
        if (muteTimer !== undefined) {
          return;
        }
        muteTimer = setTimeout(() => {
          muteTimer = undefined;
          // Still muted after the wait, so this is not a gap in the audio.
          if (audioTrack.muted && streamRef.current) {
            stop();
            setTimeout(() => scheduleStartRef.current(), 0);
          }
        }, DEVICE_LOST_GRACE_MS);
      });

      audioTrack.addEventListener('unmute', () => {
        if (muteTimer !== undefined) {
          clearTimeout(muteTimer);
          muteTimer = undefined;
        }
      });

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
    // Minimising or fully occluding the window hides the document. The pump
    // reads this rather than reacting to it: nothing needs to happen at the
    // moment of the flip, and the next tick is at most 45 ms away.
    const trackVisibility = () => {
      isHiddenRef.current = document.hidden;
    };
    document.addEventListener('visibilitychange', trackVisibility);
    return () =>
      document.removeEventListener('visibilitychange', trackVisibility);
  }, []);

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

  // Split by publication rate, not by topic. `frame` is replaced ~22 times a
  // second; `control` only when the capture starts, stops, pauses or fails.
  // Handed out as one object they were indistinguishable to React, so a
  // consumer reading nothing but `isActive` still re-rendered at frame rate.
  const frame = useMemo(
    () => ({ balanceProgress, isClipping, points, waveform }),
    [balanceProgress, isClipping, points, waveform],
  );

  const control = useMemo(
    () => ({
      captureBalanceProfile,
      error,
      isActive,
      isPaused,
      togglePaused,
      // So the notice about a failed capture can offer to try again rather
      // than only saying it went wrong. Windows refuses the loopback grab for
      // transient reasons — a device changing mid-start, a permission prompt
      // dismissed — and a second attempt very often works.
      retry: start,
    }),
    [captureBalanceProfile, error, isActive, isPaused, start, togglePaused],
  );

  return { control, frame };
};

export default useLiveOutputSpectrum;
