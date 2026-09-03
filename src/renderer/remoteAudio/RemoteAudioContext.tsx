/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  ILanPairingOption,
  ILanRemoteAudioChunk,
  ILanRemoteAudioSignal,
} from '../../common/remoteAudio';
import {
  useLiveAudioCapture,
  useLiveAudioControl,
} from '../audio/LiveAudioContext';
import { IRemoteAudioOutput, listRemoteAudioOutputs } from './outputs';
import { createPcmMixer, IPcmMixer } from './pcmMixer';
import { createPcmSender, IPcmSender } from './pcmSender';

export type TRemoteAudioRole = 'listener' | 'sender';
export type TRemoteAudioPhase =
  | 'idle'
  | 'preparing'
  | 'waiting'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'playback-blocked'
  | 'error';
export type TRemoteAudioError = 'lan' | 'capture' | 'connection';

interface IRemoteAudioValue {
  connectedCount: number;
  error?: TRemoteAudioError;
  lanOptions: ILanPairingOption[];
  outputs: IRemoteAudioOutput[];
  outputId: string;
  phase: TRemoteAudioPhase;
  role?: TRemoteAudioRole;
  startListening(): Promise<void>;
  startSending(code: string): Promise<void>;
  stop(): Promise<void>;
  resumePlayback(): Promise<void>;
  setOutput(id: string): Promise<void>;
}

const RemoteAudioContext = createContext<IRemoteAudioValue | undefined>(
  undefined,
);

export const RemoteAudioProvider = ({ children }: { children: ReactNode }) => {
  const { capture } = useLiveAudioControl();
  const [role, setRole] = useState<TRemoteAudioRole | undefined>(undefined);
  const [phase, setPhase] = useState<TRemoteAudioPhase>('idle');
  const [error, setError] = useState<TRemoteAudioError | undefined>(undefined);
  const [lanOptions, setLanOptions] = useState<ILanPairingOption[]>([]);
  const [outputs, setOutputs] = useState<IRemoteAudioOutput[]>([]);
  const [outputId, setOutputId] = useState('');
  const [connectedCount, setConnectedCount] = useState(0);

  const roleRef = useRef<TRemoteAudioRole | undefined>(undefined);
  const outputIdRef = useRef('');
  const mixerRef = useRef<IPcmMixer | undefined>(undefined);
  const senderRef = useRef<IPcmSender | undefined>(undefined);
  const senderPeerIdRef = useRef<string | undefined>(undefined);
  const peerIdsRef = useRef(new Set<string>());
  const connectedPeerIdsRef = useRef(new Set<string>());
  const playbackBlockedRef = useRef(false);
  const stoppingRef = useRef(false);

  useLiveAudioCapture(
    role === 'sender' &&
      phase !== 'idle' &&
      phase !== 'disconnected' &&
      phase !== 'error',
    'work',
  );

  const publishListenerState = useCallback(() => {
    if (roleRef.current !== 'listener' || stoppingRef.current) {
      return;
    }
    const count = connectedPeerIdsRef.current.size;
    setConnectedCount(count);
    if (playbackBlockedRef.current && count > 0) {
      setPhase('playback-blocked');
    } else if (count > 0) {
      setPhase('connected');
    } else if (peerIdsRef.current.size > 0) {
      setPhase('connecting');
    } else {
      setPhase('waiting');
    }
  }, []);

  const startPcmSender = useCallback(() => {
    const peerId = senderPeerIdRef.current;
    if (
      roleRef.current !== 'sender' ||
      senderRef.current ||
      !peerId ||
      !capture
    ) {
      return;
    }
    try {
      senderRef.current = createPcmSender(capture, (chunk) => {
        window.electron.ipcRenderer.sendRemoteAudioLanAudio({
          peerId,
          ...chunk,
        });
      });
      setConnectedCount(1);
      setPhase('connected');
    } catch {
      setError(capture ? 'connection' : 'capture');
      setPhase('error');
    }
  }, [capture]);

  useEffect(() => {
    startPcmSender();
  }, [startPcmSender]);

  const acceptSignal = useCallback(
    ({ peerId, signal }: ILanRemoteAudioSignal) => {
      const activeRole = roleRef.current;
      if (!activeRole || stoppingRef.current) {
        return;
      }
      if (signal.kind === 'peer-ready') {
        setError(undefined);
        if (activeRole === 'listener') {
          peerIdsRef.current.add(peerId);
          publishListenerState();
        } else {
          senderPeerIdRef.current = peerId;
          setPhase(capture ? 'connecting' : 'preparing');
          startPcmSender();
        }
        return;
      }

      if (activeRole === 'listener') {
        mixerRef.current?.removePeer(peerId);
        peerIdsRef.current.delete(peerId);
        connectedPeerIdsRef.current.delete(peerId);
        publishListenerState();
      } else if (senderPeerIdRef.current === peerId) {
        senderRef.current?.close();
        senderRef.current = undefined;
        senderPeerIdRef.current = undefined;
        setConnectedCount(0);
        setPhase('disconnected');
        window.electron.ipcRenderer.stopRemoteAudioLan().catch(() => undefined);
      }
    },
    [capture, publishListenerState, startPcmSender],
  );
  const acceptSignalRef = useRef(acceptSignal);
  acceptSignalRef.current = acceptSignal;

  const acceptAudio = useCallback(
    (chunk: ILanRemoteAudioChunk) => {
      if (
        roleRef.current !== 'listener' ||
        stoppingRef.current ||
        !peerIdsRef.current.has(chunk.peerId)
      ) {
        return;
      }
      connectedPeerIdsRef.current.add(chunk.peerId);
      mixerRef.current?.push(chunk);
      publishListenerState();
    },
    [publishListenerState],
  );
  const acceptAudioRef = useRef(acceptAudio);
  acceptAudioRef.current = acceptAudio;

  useEffect(() => {
    // Unit tests and non-Electron previews use a deliberately small bridge.
    // The real preload always supplies these listeners, but a missing optional
    // feature must not stop the rest of the window from mounting.
    const bridge = window.electron?.ipcRenderer;
    const unsubscribeSignal =
      bridge?.onRemoteAudioLanSignal?.((signal) => {
        acceptSignalRef.current(signal);
      }) ?? (() => undefined);
    const unsubscribeAudio =
      bridge?.onRemoteAudioLanAudio?.((chunk) => {
        acceptAudioRef.current(chunk);
      }) ?? (() => undefined);
    const unsubscribeError =
      bridge?.onRemoteAudioLanError?.(() => {
        if (!roleRef.current || stoppingRef.current) {
          return;
        }
        if (roleRef.current === 'sender') {
          senderRef.current?.close();
          senderRef.current = undefined;
        }
        setConnectedCount(0);
        setError('connection');
        setPhase('error');
      }) ?? (() => undefined);
    return () => {
      unsubscribeSignal();
      unsubscribeAudio();
      unsubscribeError();
    };
  }, []);

  useEffect(() => {
    const refresh = () => {
      listRemoteAudioOutputs()
        .then(setOutputs)
        .catch(() => setOutputs([]));
    };
    refresh();
    navigator.mediaDevices?.addEventListener?.('devicechange', refresh);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', refresh);
    };
  }, []);

  const clearConnection = useCallback(async (notify: boolean) => {
    if (stoppingRef.current) {
      return;
    }
    stoppingRef.current = true;
    const peerIds = [...peerIdsRef.current];
    const senderPeerId = senderPeerIdRef.current;
    if (notify) {
      await Promise.allSettled(
        [...peerIds, ...(senderPeerId ? [senderPeerId] : [])].map((peerId) =>
          window.electron.ipcRenderer.sendRemoteAudioLanSignal({
            peerId,
            signal: { kind: 'stop' },
          }),
        ),
      );
    }
    senderRef.current?.close();
    senderRef.current = undefined;
    senderPeerIdRef.current = undefined;
    const mixer = mixerRef.current;
    mixerRef.current = undefined;
    await mixer?.close().catch(() => undefined);
    await window.electron.ipcRenderer
      .stopRemoteAudioLan()
      .catch(() => undefined);
    peerIdsRef.current.clear();
    connectedPeerIdsRef.current.clear();
    playbackBlockedRef.current = false;
    roleRef.current = undefined;
    setRole(undefined);
    setPhase('idle');
    setLanOptions([]);
    setConnectedCount(0);
    setError(undefined);
    stoppingRef.current = false;
  }, []);

  const startListening = useCallback(async () => {
    await clearConnection(false);
    roleRef.current = 'listener';
    setRole('listener');
    setPhase('preparing');
    try {
      mixerRef.current = createPcmMixer(outputIdRef.current, () => {
        playbackBlockedRef.current = true;
        publishListenerState();
      });
      const details =
        await window.electron.ipcRenderer.startRemoteAudioLanHost();
      if (roleRef.current === 'listener') {
        setLanOptions(details.options);
        setPhase('waiting');
      }
    } catch {
      await mixerRef.current?.close().catch(() => undefined);
      mixerRef.current = undefined;
      if (roleRef.current === 'listener') {
        setError('lan');
        setPhase('error');
      }
    }
  }, [clearConnection, publishListenerState]);

  const startSending = useCallback(
    async (code: string) => {
      await clearConnection(false);
      roleRef.current = 'sender';
      setRole('sender');
      setPhase('preparing');
      try {
        await window.electron.ipcRenderer.joinRemoteAudioLan(code.trim());
      } catch {
        if (roleRef.current === 'sender') {
          setError('lan');
          setPhase('error');
        }
      }
    },
    [clearConnection],
  );

  const setOutput = useCallback(async (id: string) => {
    outputIdRef.current = id;
    setOutputId(id);
    try {
      await mixerRef.current?.setOutput(id);
    } catch {
      setError('connection');
    }
  }, []);

  const resumePlayback = useCallback(async () => {
    try {
      await mixerRef.current?.resume();
      playbackBlockedRef.current = false;
      publishListenerState();
    } catch {
      setError('connection');
    }
  }, [publishListenerState]);

  const value = useMemo<IRemoteAudioValue>(
    () => ({
      connectedCount,
      error,
      lanOptions,
      outputs,
      outputId,
      phase,
      role,
      startListening,
      startSending,
      stop: () => clearConnection(true),
      resumePlayback,
      setOutput,
    }),
    [
      clearConnection,
      connectedCount,
      error,
      lanOptions,
      outputId,
      outputs,
      phase,
      resumePlayback,
      role,
      setOutput,
      startListening,
      startSending,
    ],
  );

  return (
    <RemoteAudioContext.Provider value={value}>
      {children}
    </RemoteAudioContext.Provider>
  );
};

export const useRemoteAudio = (): IRemoteAudioValue => {
  const value = useContext(RemoteAudioContext);
  if (!value) {
    throw new Error('useRemoteAudio must be used inside RemoteAudioProvider');
  }
  return value;
};
