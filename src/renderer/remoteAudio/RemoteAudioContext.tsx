/* FluidEQ — GPL-3.0-or-later */

import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  ILanPairingOption,
  ILanRemoteComputer,
  ILanRemoteAudioChunk,
  ILanRemoteAudioSignal,
} from '../../common/remoteAudio';
import {
  useLiveAudioCapture,
  useLiveAudioControl,
} from '../audio/LiveAudioContext';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { createPcmMixer, IPcmMixer } from './pcmMixer';
import { createPcmSender, IPcmSender } from './pcmSender';
import { measureRemoteAudioChunk } from './meter';
import listenerState from './listenerState';
import type {
  TRemoteAudioError,
  TRemoteAudioPhase,
  TRemoteAudioRole,
} from './remoteAudioState';
import RemoteAudioContext from './remoteAudioValueContext';
import restoreRemoteAudioSender from './restoreRemoteAudioSender';
import useSelectedRemoteAudioOutput from './useSelectedRemoteAudioOutput';
import useRemoteAudioMeterBus from './useRemoteAudioMeterBus';

const RemoteAudioProvider = ({ children }: { children: ReactNode }) => {
  const { capture } = useLiveAudioControl();
  const { activeDeviceId } = useFluidEqContext();
  const [role, setRole] = useState<TRemoteAudioRole | undefined>(undefined);
  const [phase, setPhase] = useState<TRemoteAudioPhase>('idle');
  const [error, setError] = useState<TRemoteAudioError | undefined>(undefined);
  const [lanOptions, setLanOptions] = useState<ILanPairingOption[]>([]);
  const [connectedCount, setConnectedCount] = useState(0);
  const [connectedComputers, setConnectedComputers] = useState<
    { address?: string; id: string; name: string }[]
  >([]);
  const [deviceName, setDeviceName] = useState<string | undefined>(undefined);

  const roleRef = useRef<TRemoteAudioRole | undefined>(undefined);
  const outputSinkIdRef = useRef('default');
  const mixerRef = useRef<IPcmMixer | undefined>(undefined);
  const senderRef = useRef<IPcmSender | undefined>(undefined);
  const senderStartingRef = useRef(false);
  const senderPeerIdRef = useRef<string | undefined>(undefined);
  const peerIdsRef = useRef(new Set<string>());
  const peerNamesRef = useRef(new Map<string, string>());
  const peerAddressesRef = useRef(new Map<string, string>());
  const connectedPeerIdsRef = useRef(new Set<string>());
  const playbackBlockedRef = useRef(false);
  const stoppingRef = useRef(false);
  const restoreAttemptedRef = useRef(false);
  const { publishMeter, subscribeMeter } = useRemoteAudioMeterBus();

  useSelectedRemoteAudioOutput(activeDeviceId, mixerRef, outputSinkIdRef);

  useLiveAudioCapture(
    window.electron.platform !== 'win32' &&
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
    const next = listenerState(
      peerIdsRef.current,
      peerNamesRef.current,
      peerAddressesRef.current,
      connectedPeerIdsRef.current,
      playbackBlockedRef.current,
    );
    setConnectedCount(next.connectedCount);
    setConnectedComputers(next.computers);
    setPhase(next.phase);
  }, []);

  const startPcmSender = useCallback(async () => {
    const peerId = senderPeerIdRef.current;
    if (
      roleRef.current !== 'sender' ||
      senderRef.current ||
      senderStartingRef.current ||
      !peerId ||
      window.electron.platform === 'win32' ||
      !capture
    ) {
      return;
    }
    senderStartingRef.current = true;
    try {
      const sender = await createPcmSender(capture, (chunk) => {
        publishMeter(measureRemoteAudioChunk(chunk));
        window.electron.ipcRenderer.sendRemoteAudioLanAudio({
          peerId,
          ...chunk,
        });
      });
      if (roleRef.current !== 'sender' || senderPeerIdRef.current !== peerId) {
        sender.close();
        return;
      }
      senderRef.current = sender;
      setConnectedCount(1);
      setPhase('connected');
    } catch {
      setError(capture ? 'connection' : 'capture');
      setPhase('error');
    } finally {
      senderStartingRef.current = false;
    }
  }, [capture, publishMeter]);

  useEffect(() => {
    startPcmSender().catch(() => undefined);
  }, [startPcmSender]);

  const publishSenderConnection = useCallback((name: string) => {
    setDeviceName(name);
    if (window.electron.platform === 'win32') {
      setConnectedCount(1);
      setPhase('connected');
    }
  }, []);

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
          peerNamesRef.current.set(peerId, signal.deviceName);
          if (signal.address) {
            peerAddressesRef.current.set(peerId, signal.address);
          }
          publishListenerState();
        } else {
          senderPeerIdRef.current = peerId;
          setPhase('connecting');
          startPcmSender().catch(() => undefined);
        }
        return;
      }

      if (activeRole === 'listener') {
        mixerRef.current?.removePeer(peerId);
        peerIdsRef.current.delete(peerId);
        peerNamesRef.current.delete(peerId);
        peerAddressesRef.current.delete(peerId);
        connectedPeerIdsRef.current.delete(peerId);
        publishListenerState();
      } else if (senderPeerIdRef.current === peerId) {
        senderRef.current?.close();
        senderRef.current = undefined;
        senderPeerIdRef.current = undefined;
        setConnectedCount(0);
        setPhase('connecting');
        restoreRemoteAudioSender({
          isActive: () => roleRef.current === 'sender' && !stoppingRef.current,
          onConnected: publishSenderConnection,
          onDisconnected: () => setPhase('disconnected'),
          onFailure: () => {
            setPhase('disconnected');
            setError('connection');
          },
        }).catch(() => undefined);
      }
    },
    [publishListenerState, publishSenderConnection, startPcmSender],
  );
  const acceptSignalRef = useRef(acceptSignal);
  acceptSignalRef.current = acceptSignal;

  const acceptAudio = useCallback(
    (chunk: ILanRemoteAudioChunk) => {
      if (
        roleRef.current === 'sender' &&
        senderPeerIdRef.current === chunk.peerId
      ) {
        publishMeter(measureRemoteAudioChunk(chunk));
        return;
      }
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
    [publishListenerState, publishMeter],
  );
  const acceptAudioRef = useRef(acceptAudio);
  acceptAudioRef.current = acceptAudio;

  useEffect(() => {
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
        senderRef.current?.close();
        senderRef.current = undefined;
        senderPeerIdRef.current = undefined;
        const mixer = mixerRef.current;
        mixerRef.current = undefined;
        mixer?.close().catch(() => undefined);
        peerIdsRef.current.clear();
        peerNamesRef.current.clear();
        peerAddressesRef.current.clear();
        connectedPeerIdsRef.current.clear();
        roleRef.current = undefined;
        setRole(undefined);
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
    if (restoreAttemptedRef.current) {
      return undefined;
    }
    restoreAttemptedRef.current = true;
    const bridge = window.electron?.ipcRenderer;
    if (!bridge?.getSavedRemoteAudioLanRole || !bridge.restoreRemoteAudioLan) {
      return undefined;
    }
    let cancelled = false;
    const restore = async () => {
      const savedRole = await bridge.getSavedRemoteAudioLanRole();
      if (cancelled || !savedRole || roleRef.current) {
        return;
      }
      roleRef.current = savedRole;
      setRole(savedRole);
      setPhase('preparing');
      let restoreError: TRemoteAudioError = 'connection';
      try {
        if (savedRole === 'listener') {
          restoreError = 'playback';
          const mixer = await createPcmMixer(
            outputSinkIdRef.current,
            () => {
              playbackBlockedRef.current = true;
              publishListenerState();
            },
            publishMeter,
          );
          if (cancelled || roleRef.current !== 'listener') {
            await mixer.close().catch(() => undefined);
            return;
          }
          mixerRef.current = mixer;
        }
        restoreError = 'connection';
        const restored = await bridge.restoreRemoteAudioLan();
        if (cancelled || roleRef.current !== savedRole) {
          if (!cancelled) {
            return;
          }
          await mixerRef.current?.close().catch(() => undefined);
          mixerRef.current = undefined;
          return;
        }
        if (!restored || restored.role !== savedRole) {
          throw new Error('Saved LAN audio session is unavailable.');
        }
        if (restored.role === 'listener') {
          setDeviceName(restored.details.deviceName);
          setLanOptions(restored.details.options);
          setPhase('waiting');
        } else {
          publishSenderConnection(restored.listener.deviceName);
        }
      } catch {
        if (!cancelled && roleRef.current === savedRole) {
          await mixerRef.current?.close().catch(() => undefined);
          mixerRef.current = undefined;
          roleRef.current = undefined;
          setRole(undefined);
          setError(restoreError);
          setPhase('error');
        }
      }
    };
    restore().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [publishListenerState, publishMeter, publishSenderConnection]);

  const clearConnection = useCallback(
    async (notify: boolean, forget: boolean) => {
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
      senderStartingRef.current = false;
      senderPeerIdRef.current = undefined;
      const mixer = mixerRef.current;
      mixerRef.current = undefined;
      await mixer?.close().catch(() => undefined);
      await window.electron.ipcRenderer
        .stopRemoteAudioLan(forget)
        .catch(() => undefined);
      peerIdsRef.current.clear();
      peerNamesRef.current.clear();
      peerAddressesRef.current.clear();
      connectedPeerIdsRef.current.clear();
      playbackBlockedRef.current = false;
      roleRef.current = undefined;
      setRole(undefined);
      setPhase('idle');
      setLanOptions([]);
      setConnectedCount(0);
      setConnectedComputers([]);
      setDeviceName(undefined);
      setError(undefined);
      stoppingRef.current = false;
    },
    [],
  );

  const startListening = useCallback(async () => {
    await clearConnection(false, false);
    roleRef.current = 'listener';
    setRole('listener');
    setPhase('preparing');
    let mixer: IPcmMixer;
    try {
      mixer = await createPcmMixer(
        outputSinkIdRef.current,
        () => {
          playbackBlockedRef.current = true;
          publishListenerState();
        },
        publishMeter,
      );
    } catch {
      if (roleRef.current === 'listener') {
        roleRef.current = undefined;
        setRole(undefined);
        setError('playback');
        setPhase('error');
      }
      return;
    }
    if (roleRef.current !== 'listener') {
      await mixer.close().catch(() => undefined);
      return;
    }
    mixerRef.current = mixer;
    try {
      const details =
        await window.electron.ipcRenderer.startRemoteAudioLanHost();
      if (roleRef.current === 'listener') {
        setDeviceName(details.deviceName);
        setLanOptions(details.options);
        setPhase('waiting');
      }
    } catch {
      await mixerRef.current?.close().catch(() => undefined);
      mixerRef.current = undefined;
      if (roleRef.current === 'listener') {
        roleRef.current = undefined;
        setRole(undefined);
        setError('lan');
        setPhase('error');
      }
    }
  }, [clearConnection, publishListenerState, publishMeter]);

  const startSending = useCallback(
    async (code: string) => {
      await clearConnection(false, false);
      roleRef.current = 'sender';
      setRole('sender');
      setPhase('preparing');
      try {
        const listener: ILanRemoteComputer =
          await window.electron.ipcRenderer.joinRemoteAudioLan(code.trim());
        if (roleRef.current === 'sender') {
          publishSenderConnection(listener.deviceName);
        }
      } catch {
        if (roleRef.current === 'sender') {
          roleRef.current = undefined;
          setRole(undefined);
          setError('lan');
          setPhase('error');
        }
      }
    },
    [clearConnection, publishSenderConnection],
  );

  const resumePlayback = useCallback(async () => {
    try {
      await mixerRef.current?.resume();
      playbackBlockedRef.current = false;
      publishListenerState();
    } catch {
      setError('connection');
    }
  }, [publishListenerState]);

  const value = useMemo(
    () => ({
      connectedCount,
      connectedComputers,
      deviceName,
      error,
      lanOptions,
      phase,
      role,
      startListening,
      startSending,
      stop: () => clearConnection(true, true),
      resumePlayback,
      subscribeMeter,
    }),
    [
      clearConnection,
      connectedCount,
      connectedComputers,
      deviceName,
      error,
      lanOptions,
      phase,
      resumePlayback,
      role,
      subscribeMeter,
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

export default RemoteAudioProvider;
