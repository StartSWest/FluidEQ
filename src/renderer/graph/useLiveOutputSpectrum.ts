import { useCallback, useEffect, useRef, useState } from 'react';
import { IChartPointData } from './ChartController';

const FFT_SIZE = 4096;
const MIN_FREQUENCY = 20;
const MAX_FREQUENCY = 20000;
const POINT_COUNT = 160;
const UPDATE_INTERVAL_MS = 60;
const MIN_DISPLAY_DB = -40;

const createFrequencyPoints = (
  frequencyData: Float32Array,
  sampleRate: number
): IChartPointData[] => {
  const binWidth = sampleRate / FFT_SIZE;
  const logMin = Math.log10(MIN_FREQUENCY);
  const logMax = Math.log10(Math.min(MAX_FREQUENCY, sampleRate / 2));

  return Array.from({ length: POINT_COUNT }, (_value, index) => {
    const frequency =
      10 ** (logMin + (index / (POINT_COUNT - 1)) * (logMax - logMin));
    const bin = Math.min(
      Math.round(frequency / binWidth),
      frequencyData.length - 1
    );
    const level = frequencyData[bin];
    return {
      x: frequency,
      y: Number.isFinite(level) ? Math.max(level, MIN_DISPLAY_DB) : MIN_DISPLAY_DB,
    };
  });
};

const useLiveOutputSpectrum = () => {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState('');
  const [points, setPoints] = useState<IChartPointData[]>([]);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const audioContextRef = useRef<AudioContext | undefined>(undefined);
  const animationFrameRef = useRef<number | undefined>(undefined);

  const stop = useCallback(() => {
    if (animationFrameRef.current !== undefined) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
    void audioContextRef.current?.close();
    audioContextRef.current = undefined;
    setIsActive(false);
    setPoints([]);
  }, []);

  const start = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: true,
      });
      stream.getVideoTracks().forEach((track) => track.stop());

      const [audioTrack] = stream.getAudioTracks();
      if (!audioTrack) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('Windows did not provide a system-audio stream.');
      }

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.minDecibels = -100;
      analyser.maxDecibels = 0;
      analyser.smoothingTimeConstant = 0.72;
      audioContext.createMediaStreamSource(stream).connect(analyser);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      setIsActive(true);

      const frequencyData = new Float32Array(analyser.frequencyBinCount);
      let lastUpdate = 0;
      const update = (timestamp: number) => {
        if (timestamp - lastUpdate >= UPDATE_INTERVAL_MS) {
          analyser.getFloatFrequencyData(frequencyData);
          setPoints(createFrequencyPoints(frequencyData, audioContext.sampleRate));
          lastUpdate = timestamp;
        }
        animationFrameRef.current = requestAnimationFrame(update);
      };
      animationFrameRef.current = requestAnimationFrame(update);
      audioTrack.addEventListener('ended', stop, { once: true });
    } catch (captureError) {
      stop();
      setError(
        captureError instanceof Error
          ? captureError.message
          : 'Unable to capture the processed system output.'
      );
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { error, isActive, points, start, stop };
};

export default useLiveOutputSpectrum;
