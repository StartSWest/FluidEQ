import { useCallback, useEffect, useRef, useState } from 'react';
import { IChartPointData } from './ChartController';

const FFT_SIZE = 4096;
const MIN_FREQUENCY = 20;
const MAX_FREQUENCY = 20000;
const POINT_COUNT = 320;
const WAVEFORM_POINT_COUNT = 96;
const UPDATE_INTERVAL_MS = 45;
const MIN_DISPLAY_DB = -40;

const createFrequencyPoints = (
  frequencyData: Float32Array,
  sampleRate: number,
): IChartPointData[] => {
  const binWidth = sampleRate / FFT_SIZE;
  const logMin = Math.log10(MIN_FREQUENCY);
  const logMax = Math.log10(Math.min(MAX_FREQUENCY, sampleRate / 2));

  return Array.from({ length: POINT_COUNT }, (_value, index) => {
    const frequency =
      10 ** (logMin + (index / (POINT_COUNT - 1)) * (logMax - logMin));
    const bin = Math.min(
      Math.round(frequency / binWidth),
      frequencyData.length - 1,
    );
    const level = frequencyData[bin];
    return {
      x: frequency,
      y: Number.isFinite(level)
        ? Math.max(level, MIN_DISPLAY_DB)
        : MIN_DISPLAY_DB,
    };
  });
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

const useLiveOutputSpectrum = () => {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState('');
  const [points, setPoints] = useState<IChartPointData[]>([]);
  const [waveform, setWaveform] = useState<number[]>([]);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const audioContextRef = useRef<AudioContext | undefined>(undefined);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const isStartingRef = useRef(false);
  const autoStartRef = useRef(true);
  const isPausedRef = useRef(false);
  const scheduleStartRef = useRef<() => void>(() => undefined);

  const togglePaused = useCallback(() => {
    setIsPaused((current) => {
      const next = !current;
      isPausedRef.current = next;
      return next;
    });
  }, []);

  const stop = useCallback(() => {
    if (animationFrameRef.current !== undefined) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = undefined;
    setIsActive(false);
    isPausedRef.current = false;
    setIsPaused(false);
    setPoints([]);
    setWaveform([]);
  }, []);

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
      let lastUpdate = 0;
      const update = (timestamp: number) => {
        if (timestamp - lastUpdate >= UPDATE_INTERVAL_MS) {
          if (!isPausedRef.current) {
            analyser.getFloatFrequencyData(frequencyData);
            analyser.getByteTimeDomainData(timeDomainData);
            setPoints(
              createFrequencyPoints(
                frequencyData,
                activeAudioContext.sampleRate,
              ),
            );
            setWaveform(createWaveformPoints(timeDomainData));
          }
          lastUpdate = timestamp;
        }
        animationFrameRef.current = requestAnimationFrame(update);
      };
      animationFrameRef.current = requestAnimationFrame(update);
      audioTrack.addEventListener(
        'ended',
        () => {
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
  }, [stop]);

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
      stop();
    };
  }, [scheduleStart, stop]);

  return { error, isActive, isPaused, points, togglePaused, waveform };
};

export default useLiveOutputSpectrum;
