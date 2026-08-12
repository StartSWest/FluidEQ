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

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  describePitch,
  detectPitchYin,
  IKaraokePitchEstimate,
  medianPitch,
} from '../../common/karaoke/pitch';
import pitchWorkletUrl from './pitch-worklet.worklet';

const MICROPHONE_STORAGE_KEY = 'fluideq.karaoke.microphoneId';
const MICROPHONE_GAIN_STORAGE_KEY = 'fluideq.karaoke.microphoneGain';
const DEFAULT_MICROPHONE_ID = 'default';
const METER_INTERVAL_MS = 50;
const DEFAULT_MICROPHONE_GAIN = 1;
const MAX_MICROPHONE_GAIN = 2;
const PITCH_HOLD_MS = 260;
const FALLBACK_PITCH_INTERVAL_MS = 90;

export type TKaraokeMicrophoneStatus =
  | 'off'
  | 'requesting'
  | 'live'
  | 'denied'
  | 'unavailable'
  | 'disconnected'
  | 'error';

export type TKaraokePitchAnalysisStatus =
  'idle' | 'loading' | 'ready' | 'unsupported' | 'error';

export interface IKaraokeLivePitch extends IKaraokePitchEstimate {
  capturedAtMs: number;
  processingMs: number;
}

interface IKaraokeRawPitchMessage {
  frequencyHz: number;
  confidence: number;
  rms: number;
  capturedAtMs: number;
  processingMs: number;
}

export interface IKaraokeMicrophoneDevice {
  deviceId: string;
  label: string;
}

const readSelectedMicrophone = (): string => {
  try {
    return (
      window.localStorage.getItem(MICROPHONE_STORAGE_KEY) ||
      DEFAULT_MICROPHONE_ID
    );
  } catch {
    return DEFAULT_MICROPHONE_ID;
  }
};

const rememberSelectedMicrophone = (deviceId: string) => {
  try {
    window.localStorage.setItem(MICROPHONE_STORAGE_KEY, deviceId);
  } catch {
    // The selection remains valid for this session even without persistence.
  }
};

const readMicrophoneGain = (): number => {
  try {
    const raw = window.localStorage.getItem(MICROPHONE_GAIN_STORAGE_KEY);
    if (raw === null) {
      return DEFAULT_MICROPHONE_GAIN;
    }
    const stored = Number(raw);
    return Number.isFinite(stored)
      ? Math.max(0, Math.min(MAX_MICROPHONE_GAIN, stored))
      : DEFAULT_MICROPHONE_GAIN;
  } catch {
    return DEFAULT_MICROPHONE_GAIN;
  }
};

const rememberMicrophoneGain = (gain: number) => {
  try {
    window.localStorage.setItem(MICROPHONE_GAIN_STORAGE_KEY, String(gain));
  } catch {
    // The gain remains valid for this session without persistence.
  }
};

/** Turn browser MediaDeviceInfo rows into one stable, selectable input list. */
export const normalizeMicrophoneDevices = (
  devices: readonly MediaDeviceInfo[],
): IKaraokeMicrophoneDevice[] => {
  const inputs = devices.filter((device) => device.kind === 'audioinput');
  const defaultInput = inputs.find(
    (device) => device.deviceId === DEFAULT_MICROPHONE_ID,
  );
  const normalized: IKaraokeMicrophoneDevice[] = [
    {
      deviceId: DEFAULT_MICROPHONE_ID,
      label: defaultInput?.label || '',
    },
  ];
  const seen = new Set([DEFAULT_MICROPHONE_ID]);

  inputs.forEach((device) => {
    if (!device.deviceId || seen.has(device.deviceId)) {
      return;
    }
    seen.add(device.deviceId);
    normalized.push({ deviceId: device.deviceId, label: device.label });
  });
  return normalized;
};

const statusForMicrophoneError = (error: unknown): TKaraokeMicrophoneStatus => {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'denied';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'unavailable';
  }
  return 'error';
};

interface IKaraokeMicrophoneResources {
  stream?: MediaStream;
  context?: AudioContext;
  source?: MediaStreamAudioSourceNode;
  inputGain?: GainNode;
  analyser?: AnalyserNode;
  pitchWorklet?: AudioWorkletNode;
  silentGain?: GainNode;
  endedTrack?: MediaStreamTrack;
  endedListener?: () => void;
  animationFrame?: number;
}

/**
 * Owns Karaoke's microphone and nothing else.
 *
 * No request occurs on mount. A user action opens one input, the graph is used
 * only for a local level reading, and no node is connected to the speakers.
 * Leaving Karaoke releases every track and never reopens it automatically.
 */
export const useKaraokeMicrophone = (isActive: boolean) => {
  const [devices, setDevices] = useState<IKaraokeMicrophoneDevice[]>([
    { deviceId: DEFAULT_MICROPHONE_ID, label: '' },
  ]);
  const [selectedDeviceId, setSelectedDeviceIdState] = useState(
    readSelectedMicrophone,
  );
  const [status, setStatus] = useState<TKaraokeMicrophoneStatus>('off');
  const [level, setLevel] = useState(0);
  const [inputGain, setInputGainState] = useState(readMicrophoneGain);
  const [pitch, setPitch] = useState<IKaraokeLivePitch>();
  const [pitchAnalysisStatus, setPitchAnalysisStatus] =
    useState<TKaraokePitchAnalysisStatus>('idle');
  const resourcesRef = useRef<IKaraokeMicrophoneResources>({});
  const requestGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const isActiveRef = useRef(isActive);
  const statusRef = useRef<TKaraokeMicrophoneStatus>('off');
  const lastPitchAtRef = useRef(0);

  const updateStatus = useCallback((next: TKaraokeMicrophoneStatus) => {
    statusRef.current = next;
    if (mountedRef.current) {
      setStatus(next);
    }
    lastPitchAtRef.current = 0;
  }, []);

  const disposeResources = useCallback(() => {
    const resources = resourcesRef.current;
    resourcesRef.current = {};

    if (resources.animationFrame !== undefined) {
      cancelAnimationFrame(resources.animationFrame);
    }
    if (resources.endedTrack && resources.endedListener) {
      resources.endedTrack.removeEventListener(
        'ended',
        resources.endedListener,
      );
    }
    if (resources.pitchWorklet) {
      resources.pitchWorklet.port.onmessage = null;
      resources.pitchWorklet.port.close();
    }
    resources.source?.disconnect();
    resources.inputGain?.disconnect();
    resources.analyser?.disconnect();
    resources.pitchWorklet?.disconnect();
    resources.silentGain?.disconnect();
    resources.stream?.getTracks().forEach((track) => track.stop());
    if (resources.context && resources.context.state !== 'closed') {
      resources.context.close().catch(() => undefined);
    }
    if (mountedRef.current) {
      setLevel(0);
      setPitch(undefined);
      setPitchAnalysisStatus('idle');
    }
  }, []);

  const startPitchAnalysis = useCallback(
    async (
      context: AudioContext,
      source: AudioNode,
      resources: IKaraokeMicrophoneResources,
    ) => {
      if (
        !context.audioWorklet ||
        typeof globalThis.AudioWorkletNode === 'undefined'
      ) {
        if (resourcesRef.current === resources && mountedRef.current) {
          // The analyser fallback below still provides real pitch frames.
          setPitchAnalysisStatus('ready');
        }
        return;
      }

      setPitchAnalysisStatus('loading');
      try {
        await context.audioWorklet.addModule(pitchWorkletUrl);
        if (resourcesRef.current !== resources || !mountedRef.current) {
          return;
        }

        const pitchWorklet = new AudioWorkletNode(
          context,
          'fluideq-karaoke-pitch',
          {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [1],
          },
        );
        const silentGain = context.createGain();
        silentGain.gain.value = 0;
        const recentFrequencies: number[] = [];
        pitchWorklet.port.onmessage = (
          event: MessageEvent<IKaraokeRawPitchMessage>,
        ) => {
          if (resourcesRef.current !== resources || !mountedRef.current) {
            return;
          }
          const frame = event.data;
          if (
            !frame ||
            !Number.isFinite(frame.frequencyHz) ||
            frame.frequencyHz <= 0
          ) {
            recentFrequencies.length = 0;
            if (performance.now() - lastPitchAtRef.current > PITCH_HOLD_MS) {
              setPitch(undefined);
            }
            return;
          }

          recentFrequencies.push(frame.frequencyHz);
          if (recentFrequencies.length > 5) {
            recentFrequencies.shift();
          }
          const estimate = describePitch(
            medianPitch(recentFrequencies),
            frame.confidence,
            frame.rms,
          );
          if (estimate) {
            lastPitchAtRef.current = performance.now();
            setPitch({
              ...estimate,
              capturedAtMs: frame.capturedAtMs,
              processingMs: frame.processingMs,
            });
          }
        };

        // A Web Audio graph must reach a destination for Chromium to pull it.
        // The zero gain keeps the microphone completely inaudible while the
        // worklet observes it on Chromium's realtime audio thread.
        source.connect(pitchWorklet);
        pitchWorklet.connect(silentGain);
        silentGain.connect(context.destination);
        resources.pitchWorklet = pitchWorklet;
        resources.silentGain = silentGain;
        setPitchAnalysisStatus('ready');
      } catch {
        if (resourcesRef.current === resources && mountedRef.current) {
          // Loading a worklet can fail on individual Chromium builds. The
          // analyser fallback is already connected and keeps the feature live.
          setPitchAnalysisStatus('ready');
        }
      }
    },
    [],
  );

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      updateStatus('unavailable');
      return;
    }

    try {
      const next = normalizeMicrophoneDevices(
        await navigator.mediaDevices.enumerateDevices(),
      );
      if (!mountedRef.current) {
        return;
      }
      setDevices(next);
      setSelectedDeviceIdState((current) => {
        if (
          current === DEFAULT_MICROPHONE_ID ||
          next.some((device) => device.deviceId === current)
        ) {
          return current;
        }
        rememberSelectedMicrophone(DEFAULT_MICROPHONE_ID);
        return DEFAULT_MICROPHONE_ID;
      });
    } catch {
      // Enumeration is retried on the next devicechange or explicit start.
    }
  }, [updateStatus]);

  const startMeter = useCallback(
    async (
      stream: MediaStream,
      resources: IKaraokeMicrophoneResources,
    ): Promise<boolean> => {
      if (typeof AudioContext === 'undefined') {
        return true;
      }

      try {
        const context = new AudioContext({ latencyHint: 'interactive' });
        const source = context.createMediaStreamSource(stream);
        const gain = context.createGain();
        gain.gain.value = inputGain;
        const analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.68;
        source.connect(gain);
        gain.connect(analyser);

        resources.context = context;
        resources.source = source;
        resources.inputGain = gain;
        resources.analyser = analyser;
        await context.resume();
        if (resourcesRef.current !== resources || !mountedRef.current) {
          return false;
        }

        const samples = new Float32Array(analyser.fftSize);
        const pitchScratch = new Float32Array(
          Math.floor(samples.length / 2) + 1,
        );
        const fallbackFrequencies: number[] = [];
        let lastPaint = 0;
        let lastFallbackPitch = 0;

        const paint = (now: number) => {
          if (resourcesRef.current !== resources) {
            return;
          }
          if (now - lastPaint >= METER_INTERVAL_MS) {
            analyser.getFloatTimeDomainData(samples);
            let energy = 0;
            for (let index = 0; index < samples.length; index += 1) {
              energy += samples[index] * samples[index];
            }
            const rms = Math.sqrt(energy / samples.length);
            setLevel(Math.min(1, rms * 3.2));
            lastPaint = now;

            if (now - lastFallbackPitch >= FALLBACK_PITCH_INTERVAL_MS) {
              const startedAt = performance.now();
              const estimate = detectPitchYin(
                samples,
                context.sampleRate,
                {
                  minFrequencyHz: 55,
                  maxFrequencyHz: 1_100,
                  threshold: 0.24,
                  minimumConfidence: 0.3,
                  minimumRms: 0.0025,
                },
                pitchScratch,
              );
              if (estimate) {
                fallbackFrequencies.push(estimate.frequencyHz);
                if (fallbackFrequencies.length > 3) {
                  fallbackFrequencies.shift();
                }
                const smoothed = describePitch(
                  medianPitch(fallbackFrequencies),
                  estimate.confidence,
                  estimate.rms,
                );
                if (smoothed) {
                  lastPitchAtRef.current = now;
                  setPitch({
                    ...smoothed,
                    capturedAtMs: now,
                    processingMs: performance.now() - startedAt,
                  });
                }
              } else if (now - lastPitchAtRef.current > PITCH_HOLD_MS) {
                fallbackFrequencies.length = 0;
                setPitch(undefined);
              }
              lastFallbackPitch = now;
            }
          }
          resources.animationFrame = requestAnimationFrame(paint);
        };

        resources.animationFrame = requestAnimationFrame(paint);
        startPitchAnalysis(context, gain, resources);
        return true;
      } catch {
        return false;
      }
    },
    [inputGain, startPitchAnalysis],
  );

  const stop = useCallback(() => {
    requestGenerationRef.current += 1;
    disposeResources();
    updateStatus('off');
  }, [disposeResources, updateStatus]);

  const start = useCallback(
    async (deviceId = selectedDeviceId) => {
      const { mediaDevices } = navigator;
      if (!mediaDevices?.getUserMedia || !isActiveRef.current) {
        updateStatus('unavailable');
        return;
      }

      const generation = requestGenerationRef.current + 1;
      requestGenerationRef.current = generation;
      disposeResources();
      updateStatus('requesting');

      try {
        const stream = await mediaDevices.getUserMedia({
          audio: {
            ...(deviceId === DEFAULT_MICROPHONE_ID
              ? {}
              : { deviceId: { exact: deviceId } }),
            autoGainControl: false,
            channelCount: 1,
            echoCancellation: false,
            noiseSuppression: false,
          },
          video: false,
        });

        if (
          !mountedRef.current ||
          !isActiveRef.current ||
          generation !== requestGenerationRef.current
        ) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const resources: IKaraokeMicrophoneResources = { stream };
        resourcesRef.current = resources;
        const [track] = stream.getAudioTracks();
        if (!track) {
          disposeResources();
          updateStatus('unavailable');
          return;
        }

        const onEnded = () => {
          if (resourcesRef.current !== resources) {
            return;
          }
          disposeResources();
          updateStatus('disconnected');
          refreshDevices();
        };
        resources.endedTrack = track;
        resources.endedListener = onEnded;
        track.addEventListener('ended', onEnded);
        const analysisStarted = await startMeter(stream, resources);
        if (
          !mountedRef.current ||
          !isActiveRef.current ||
          generation !== requestGenerationRef.current
        ) {
          return;
        }
        if (!analysisStarted) {
          disposeResources();
          updateStatus('error');
          return;
        }
        updateStatus('live');
        refreshDevices();
      } catch (error) {
        if (mountedRef.current && generation === requestGenerationRef.current) {
          disposeResources();
          updateStatus(statusForMicrophoneError(error));
          refreshDevices();
        }
      }
    },
    [
      disposeResources,
      refreshDevices,
      selectedDeviceId,
      startMeter,
      updateStatus,
    ],
  );

  const selectDevice = useCallback(
    (deviceId: string) => {
      setSelectedDeviceIdState(deviceId);
      rememberSelectedMicrophone(deviceId);
      if (statusRef.current === 'live') {
        start(deviceId);
      }
    },
    [start],
  );

  const setInputGain = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(MAX_MICROPHONE_GAIN, next));
    setInputGainState(clamped);
    rememberMicrophoneGain(clamped);
    if (resourcesRef.current.inputGain) {
      resourcesRef.current.inputGain.gain.value = clamped;
    }
  }, []);

  const toggle = useCallback(() => {
    if (statusRef.current === 'live' || statusRef.current === 'requesting') {
      stop();
      return;
    }
    start();
  }, [start, stop]);

  useEffect(() => {
    isActiveRef.current = isActive;
    if (!isActive) {
      stop();
    }
  }, [isActive, stop]);

  useEffect(() => {
    refreshDevices();
    const { mediaDevices } = navigator;
    if (!mediaDevices?.addEventListener) {
      return undefined;
    }
    mediaDevices.addEventListener('devicechange', refreshDevices);
    return () =>
      mediaDevices.removeEventListener('devicechange', refreshDevices);
  }, [refreshDevices]);

  useEffect(() => {
    // React may intentionally replay effect setup/cleanup in development.
    // Restore this guard on setup so that a replay cannot leave every later
    // microphone button action looking successful while all state updates are
    // silently discarded as though the component were still unmounted.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestGenerationRef.current += 1;
      disposeResources();
    };
  }, [disposeResources]);

  return {
    devices,
    selectedDeviceId,
    status,
    level,
    inputGain,
    pitch,
    pitchAnalysisStatus,
    selectDevice,
    setInputGain,
    toggle,
  };
};

export type TKaraokeMicrophoneController = ReturnType<
  typeof useKaraokeMicrophone
>;
