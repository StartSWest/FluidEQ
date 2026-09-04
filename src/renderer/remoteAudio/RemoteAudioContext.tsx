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
  TRemoteAudioStopMode,
  TRemoteAudioStreamMode,
} from '../../common/remoteAudio';
import {
  useLiveAudioCapture,
  useLiveAudioControl,
} from '../audio/LiveAudioContext';
import { useFluidEqContext } from '../utils/FluidEqContext';
import type { IPcmMixer } from './pcmMixer';
import { createPcmSender, IPcmSender } from './pcmSender';
import { measureRemoteAudioChunk } from './meter';
import listenerState from './listenerState';
import type {
  TRemoteAudioError,
  TRemoteAudioPhase,
  TRemoteAudioRole,
} from './remoteAudioState';
import RemoteAudioContext from './remoteAudioValueContext';
import restoreRemoteAudioSession from './restoreRemoteAudioSession';
import routeRemoteAudioChunk from './routeRemoteAudioChunk';
import useSelectedRemoteAudioOutput from './useSelectedRemoteAudioOutput';
import useRemoteAudioMeterBus from './useRemoteAudioMeterBus';
import useRemoteAudioNetworkStats from './useRemoteAudioNetworkStats';
import useRemoteAudioBridgeSubscriptions from './useRemoteAudioBridgeSubscriptions';
import useRemoteAudioListenerActions from './useRemoteAudioListenerActions';
import useRemoteAudioListenerReconnect from './useRemoteAudioListenerReconnect';
import useRemoteAudioSenderActions from './useRemoteAudioSenderActions';
import useRemoteAudioSenderReconnect from './useRemoteAudioSenderReconnect';
import useRemoteAudioRecovery from './useRemoteAudioRecovery';
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
  const senderReconnectGenerationRef = useRef(0);
  const senderReconnectRef = useRef<
    ((mode: TRemoteAudioStreamMode) => Promise<void>) | undefined
  >(undefined);
  const { setStreamMode, streamMode, streamModeRef } = useRemoteAudioStreamMode(
    roleRef,
    senderReconnectRef,
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
      senderRef.current?.close();
      senderRef.current = undefined;
      senderPeerIdRef.current = undefined;
      removeNetworkPeer(peerId);
      await window.electron.ipcRenderer
        .stopRemoteAudioLan('keep-active')
        .catch(() => undefined);
      roleRef.current = undefined;
      setRole(undefined);
      setConnectedCount(0);
      setError(capture ? 'connection' : 'capture');
      setPhase('error');
    } finally {
      senderStartingRef.current = false;
    }
  }, [capture, publishMeter, removeNetworkPeer]);

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
  const reconnectSender = useRemoteAudioSenderReconnect({
    publishConnected: publishSenderConnection,
    removeNetworkPeer,
    roleRef,
    senderPeerIdRef,
    senderReconnectGenerationRef,
    senderRef,
    senderStartingRef,
    setConnectedCount,
    setError,
    setPhase,
    stoppingRef,
    streamModeRef,
  });
  senderReconnectRef.current = reconnectSender;
  const reconnectListener = useRemoteAudioListenerReconnect({
    reconnectGenerationRef: senderReconnectGenerationRef,
    roleRef,
    setConnectedCount,
    setDeviceName,
    setError,
    setLanOptions,
    setPhase,
    stoppingRef,
    streamModeRef,
  });
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
        reconnectSender(streamModeRef.current).catch(() => undefined);
      }
    },
    [
      publishListenerState,
      reconnectSender,
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

  const handleLanError = useRemoteAudioRecovery({
    clearNetworkStats,
    connectedPeerIdsRef,
    lanOptionsCount: lanOptions.length,
    mixerRef,
    peerAddressesRef,
    peerIdsRef,
    peerNamesRef,
    phase,
    reconnectListener,
    reconnectSender,
    role,
    roleRef,
    stoppingRef,
    streamModeRef,
  });
  useRemoteAudioBridgeSubscriptions({
    acceptAudioRef,
    acceptSignalRef,
    handleError: handleLanError,
  });

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
    async (notify: boolean, stopMode: TRemoteAudioStopMode) => {
      if (stoppingRef.current) {
        return;
      }
      stoppingRef.current = true;
      senderReconnectGenerationRef.current += 1;
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
        .stopRemoteAudioLan(stopMode)
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

  const startListening = useRemoteAudioListenerActions({
    clearConnection,
    mixerRef,
    outputSinkIdRef,
    playbackBlockedRef,
    publishListenerState,
    publishMeter,
    reconnectGenerationRef: senderReconnectGenerationRef,
    roleRef,
    setDeviceName,
    setError,
    setLanOptions,
    setPhase,
    setRole,
  });

  const { startSending } = useRemoteAudioSenderActions({
    clearConnection,
    publishConnected: publishSenderConnection,
    reconnectGenerationRef: senderReconnectGenerationRef,
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
      setStreamMode,
      startListening,
      startSending,
      stop: () => clearConnection(true, 'pause'),
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
