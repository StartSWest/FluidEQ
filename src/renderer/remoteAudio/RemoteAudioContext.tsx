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
import restoreRemoteAudioSession from './restoreRemoteAudioSession';
import routeRemoteAudioChunk from './routeRemoteAudioChunk';
import useSelectedRemoteAudioOutput from './useSelectedRemoteAudioOutput';
import useRemoteAudioMeterBus from './useRemoteAudioMeterBus';
import useRemoteAudioNetworkStats from './useRemoteAudioNetworkStats';
import useRemoteAudioSenderActions from './useRemoteAudioSenderActions';
import useRemoteAudioStreamMode from './useRemoteAudioStreamMode';

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
  const { setStreamMode, streamMode, streamModeRef } = useRemoteAudioStreamMode(
    roleRef,
    senderPeerIdRef,
  );
  const { publishMeter, subscribeMeter } = useRemoteAudioMeterBus();
  const { clearNetworkStats, networkStats, removeNetworkPeer } =
    useRemoteAudioNetworkStats(role !== undefined);
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
      if (signal.kind === 'stream-mode') {
        if (activeRole === 'listener') {
          mixerRef.current?.setPeerMode(peerId, signal.mode);
        }
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
          window.electron.ipcRenderer
            .sendRemoteAudioLanSignal({
              peerId,
              signal: { kind: 'stream-mode', mode: streamModeRef.current },
            })
            .catch(() => undefined);
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
        removeNetworkPeer(peerId);
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
          streamMode: streamModeRef.current,
        }).catch(() => undefined);
      }
    },
    [
      publishListenerState,
      publishSenderConnection,
      removeNetworkPeer,
      startPcmSender,
      streamModeRef,
    ],
  );
  const acceptSignalRef = useRef(acceptSignal);
  acceptSignalRef.current = acceptSignal;

  const acceptAudio = useCallback(
    (chunk: ILanRemoteAudioChunk) => {
      routeRemoteAudioChunk({
        chunk,
        connectedPeerIds: connectedPeerIdsRef.current,
        isStopping: stoppingRef.current,
        mixer: mixerRef.current,
        peerIds: peerIdsRef.current,
        publishListenerState,
        publishMeter,
        role: roleRef.current,
        senderPeerId: senderPeerIdRef.current,
      });
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
        clearNetworkStats();
        setError('connection');
        setPhase('error');
      }) ?? (() => undefined);
    return () => {
      unsubscribeSignal();
      unsubscribeAudio();
      unsubscribeError();
    };
  }, [clearNetworkStats]);

  useEffect(() => {
    if (restoreAttemptedRef.current) {
      return undefined;
    }
    restoreAttemptedRef.current = true;
    let cancelled = false;
    restoreRemoteAudioSession({
      isCancelled: () => cancelled,
      isCurrentRole: (savedRole) =>
        roleRef.current === undefined || roleRef.current === savedRole,
      onBegin: (savedRole) => {
        roleRef.current = savedRole;
        setRole(savedRole);
        setPhase('preparing');
      },
      onFailure: (restoreError) => {
        mixerRef.current = undefined;
        roleRef.current = undefined;
        setRole(undefined);
        setError(restoreError);
        setPhase('error');
      },
      onListenerMixer: (mixer) => {
        mixerRef.current = mixer;
      },
      onListenerRestored: (restoredDeviceName, options) => {
        setDeviceName(restoredDeviceName);
        setLanOptions(options);
        setPhase('waiting');
      },
      onPlaybackBlocked: () => {
        playbackBlockedRef.current = true;
        publishListenerState();
      },
      onSenderRestored: publishSenderConnection,
      outputSinkId: outputSinkIdRef.current,
      publishMeter,
      streamMode: streamModeRef.current,
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [
    publishListenerState,
    publishMeter,
    publishSenderConnection,
    streamModeRef,
  ]);

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
      clearNetworkStats();
      setDeviceName(undefined);
      setError(undefined);
      stoppingRef.current = false;
    },
    [clearNetworkStats],
  );

  const startListening = useCallback(
    async (replaceCode = false) => {
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
          await window.electron.ipcRenderer.startRemoteAudioLanHost(
            replaceCode,
          );
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
    },
    [clearConnection, publishListenerState, publishMeter],
  );

  const { resumeSending, startSending } = useRemoteAudioSenderActions({
    clearConnection,
    publishConnected: publishSenderConnection,
    roleRef,
    setError,
    setPhase,
    setRole,
    streamModeRef,
  });

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
      networkStats,
      phase,
      role,
      resumeSending,
      setStreamMode,
      startListening,
      startSending,
      stop: () => clearConnection(true, false),
      resumePlayback,
      subscribeMeter,
      streamMode,
    }),
    [
      clearConnection,
      connectedCount,
      connectedComputers,
      deviceName,
      error,
      lanOptions,
      networkStats,
      phase,
      resumePlayback,
      resumeSending,
      role,
      setStreamMode,
      subscribeMeter,
      startListening,
      startSending,
      streamMode,
    ],
  );

  return (
    <RemoteAudioContext.Provider value={value}>
      {children}
    </RemoteAudioContext.Provider>
  );
};

export default RemoteAudioProvider;
