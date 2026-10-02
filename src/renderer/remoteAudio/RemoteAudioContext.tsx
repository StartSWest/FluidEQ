/* FluidEQ — GPL-3.0-or-later */

import { ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import type {
  ILanPairingOption,
  ILanRemoteAudioChunk,
  ILanRemoteAudioSignal,
} from '../../common/remoteAudio';
import { useFluidEqShell } from '../utils/FluidEqContext';
import { setSinglePlayerFromLink } from '../utils/singlePlayer';
import { measureRemoteAudioChunk } from './meter';
import {
  ALL_ON,
  type ILinkRecord,
  linkPhase,
  linkViews,
  playsHere,
  sendsThere,
} from './linkRecords';
import type {
  ILinkSwitches,
  IRemoteAudioLink,
  TRemoteAudioError,
  TRemoteAudioPhase,
  TRemoteAudioRole,
} from './remoteAudioState';
import RemoteAudioContext, {
  type IIncomingSound,
  IncomingSoundContext,
  RemoteAudioReceivingContext,
} from './remoteAudioValueContext';
import useIncomingDelays from './useIncomingDelays';
import useSelectedRemoteAudioOutput from './useSelectedRemoteAudioOutput';
import useRemoteAudioMeterBus from './useRemoteAudioMeterBus';
import useRemoteAudioNetworkStats from './useRemoteAudioNetworkStats';
import useRemoteAudioBridgeSubscriptions from './useRemoteAudioBridgeSubscriptions';
import useRemoteAudioMixer from './useRemoteAudioMixer';
import useRemoteAudioPcmSender from './useRemoteAudioPcmSender';
import useRemoteAudioRestore from './useRemoteAudioRestore';
import useRemoteAudioSending from './useRemoteAudioSending';
import useRemoteNowPlayingBroadcast from './useRemoteNowPlayingBroadcast';
import useRemoteNowPlayingSource from './useRemoteNowPlayingSource';

/**
 * Share Audio: the computers linked with this one, both ways.
 *
 * A link is made once — one computer shows its code, the other pastes it —
 * and from then on each computer sends its own sound and plays the other's,
 * each direction on its own switch. Main does the sending and the playing
 * (`ipc/remoteAudio.ts`, `remoteAudioLinks.ts`); the window keeps the picture
 * of every link, opens the output the other computers' sound plays through,
 * and runs the one-player rule across the wire in both directions.
 */
const RemoteAudioProvider = ({ children }: { children: ReactNode }) => {
  const { activeDeviceId } = useFluidEqShell();
  const bothWays = window.electron?.platform === 'win32';
  const bridge = window.electron?.ipcRenderer;
  const [role, setRoleState] = useState<TRemoteAudioRole | undefined>();
  const roleRef = useRef<TRemoteAudioRole | undefined>(undefined);
  const setRole = useCallback((next: TRemoteAudioRole | undefined) => {
    roleRef.current = next;
    setRoleState(next);
  }, []);
  const [phase, setPhaseState] = useState<TRemoteAudioPhase>('idle');
  const phaseRef = useRef<TRemoteAudioPhase>('idle');
  const setPhase = useCallback((next: TRemoteAudioPhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);
  const [error, setError] = useState<TRemoteAudioError | undefined>();
  const [lanOptions, setLanOptions] = useState<ILanPairingOption[]>([]);
  const [deviceName, setDeviceName] = useState<string | undefined>();
  const recordsRef = useRef(new Map<string, ILinkRecord>());
  const [links, setLinks] = useState<IRemoteAudioLink[]>([]);
  const playbackBlockedRef = useRef(false);
  const stoppingRef = useRef(false);
  const generationRef = useRef(0);
  const outputSinkIdRef = useRef('default');
  const { publishMeter, subscribeMeter } = useRemoteAudioMeterBus();
  const { clearNetworkStats, networkStats, removeNetworkPeer } =
    useRemoteAudioNetworkStats(role !== undefined);

  /** The picture of every link, and the page's one word for it, redrawn. */
  const publish = useCallback(() => {
    const records = recordsRef.current;
    setLinks(linkViews(records));
    const settled = phaseRef.current;
    if (
      roleRef.current &&
      !stoppingRef.current &&
      (records.size > 0 ||
        (settled !== 'preparing' &&
          settled !== 'error' &&
          settled !== 'disconnected'))
    ) {
      setPhase(linkPhase(roleRef.current, records, playbackBlockedRef.current));
    }
  }, [setPhase]);

  const clearLinks = useCallback(() => {
    recordsRef.current.clear();
    clearNetworkStats();
    setLinks([]);
  }, [clearNetworkStats]);

  const playedHere = links.some((link) => playsHere(link, bothWays));
  const { mixerRef, removePeer, resume } = useRemoteAudioMixer({
    wanted: role !== undefined && playedHere,
    outputSinkIdRef,
    onBlocked: (blocked) => {
      playbackBlockedRef.current = blocked;
      publish();
    },
    onMeter: publishMeter,
    onFailure: () => {
      setError('playback');
      playbackBlockedRef.current = true;
      publish();
    },
  });
  useSelectedRemoteAudioOutput(activeDeviceId, mixerRef, outputSinkIdRef);

  const arriving = links.filter(
    (link) => link.receiving && playsHere(link, bothWays),
  );
  const receiving = arriving.length > 0;
  const delays = useIncomingDelays(
    subscribeMeter,
    arriving.map((link) => link.id),
  );
  const incomingKey = arriving
    .map((link) => `${link.id}\n${link.name}\n${delays[link.id] ?? ''}`)
    .join('\n');
  const incoming = useMemo<IIncomingSound[]>(
    () =>
      arriving.map((link) => ({
        id: link.id,
        name: link.name,
        delayMs: delays[link.id],
      })),
    // The key is the list as far as anyone reading it can tell: a new
    // array each render would redraw every reader for nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed exactly when incomingKey changes, see above
    [incomingKey],
  );
  const { sending, sendingFailed, markSendingFailed } = useRemoteAudioSending({
    bothWays,
    receiving,
  });
  // Off Windows the window sends, to the computer this one joined.
  const joinedLink = links.find((link) => link.joined);
  useRemoteAudioPcmSender({
    peerId:
      joinedLink && sendsThere(joinedLink, bothWays)
        ? joinedLink.id
        : undefined,
    publishMeter,
    onFailure: markSendingFailed,
  });

  const performRemoteTransport = useRemoteNowPlayingBroadcast(
    links.map((link) => link.id),
  );
  const acceptRemoteStart = useRemoteNowPlayingSource(
    links.filter((link) => playsHere(link, bothWays)),
    role === 'listener',
    delays,
  );

  const { rejoin, rehost } = useRemoteAudioRestore({
    phase,
    roleRef,
    stoppingRef,
    generationRef,
    setRole,
    setPhase,
    setError,
    setDeviceName,
    setLanOptions,
    publish,
  });

  const acceptSignal = useCallback(
    ({ peerId, signal }: ILanRemoteAudioSignal) => {
      if (!roleRef.current || stoppingRef.current) {
        return;
      }
      const records = recordsRef.current;
      if (signal.kind === 'peer-ready') {
        const record: ILinkRecord = {
          name: signal.deviceName,
          address: signal.address,
          joined: signal.joined === true,
          switches: ALL_ON,
          receiving: false,
        };
        records.set(peerId, record);
        setError(undefined);
        if (record.joined) {
          setDeviceName(record.name);
        }
        // The switches are main's, remembered by name; it is already acting
        // on them, and the page shows what it acts on.
        bridge
          ?.getRemoteAudioLinkSwitches?.(record.name)
          .then((switches) => {
            const current = records.get(peerId);
            if (current && switches) {
              current.switches = switches;
              publish();
            }
            return undefined;
          })
          .catch(() => undefined);
        publish();
        return;
      }
      const record = records.get(peerId);
      if (!record) {
        return;
      }
      if (signal.kind === 'stream-mode') {
        if (signal.duplex) {
          record.theirs = signal.duplex;
          if (!signal.duplex.sends) {
            record.receiving = false;
          }
          publish();
        }
        return;
      }
      if (signal.kind === 'now-playing') {
        record.nowPlaying = signal.playing;
        publish();
        // The one-player switch, changed over there: the same switch here.
        if (signal.singlePlayer !== undefined) {
          setSinglePlayerFromLink(signal.singlePlayer, peerId);
        }
        // The press, acted on as it arrives and never stored: a description
        // kept in state gets re-read every time anything else changes, and
        // reading a press twice is what stopping the music twice looks like.
        // `started` is the other computer's word that somebody pressed play
        // there — see `startedHere` — and it counts only where that
        // computer's sound is played here.
        if (
          signal.started === true &&
          signal.playing?.isPlaying === true &&
          playsHere(record, bothWays)
        ) {
          acceptRemoteStart(peerId);
        }
        return;
      }
      if (signal.kind === 'transport') {
        // A press on the other computer's bar, carried out on this one's.
        performRemoteTransport(signal);
        return;
      }
      if (signal.kind === 'stop') {
        records.delete(peerId);
        removePeer(peerId);
        removeNetworkPeer(peerId);
        publish();
        if (record.joined) {
          rejoin().catch(() => undefined);
        }
      }
    },
    [
      acceptRemoteStart,
      bothWays,
      bridge,
      performRemoteTransport,
      publish,
      rejoin,
      removeNetworkPeer,
      removePeer,
    ],
  );
  const acceptSignalRef = useRef(acceptSignal);
  acceptSignalRef.current = acceptSignal;

  // What arrives on this channel is this computer's own sound on its way out,
  // decimated for the meter: the other computers' sound never comes back up.
  const acceptAudioRef = useRef((chunk: ILanRemoteAudioChunk) => {
    publishMeter(measureRemoteAudioChunk(chunk));
  });
  const acceptStreamingRef = useRef<(peerId: string) => void>(() => undefined);
  acceptStreamingRef.current = (peerId) => {
    const record = recordsRef.current.get(peerId);
    if (record && !record.receiving && !stoppingRef.current) {
      record.receiving = true;
      publish();
    }
  };
  const handleLanError = useCallback(() => {
    if (!roleRef.current || stoppingRef.current) {
      return;
    }
    recordsRef.current.forEach((_record, peerId) => removePeer(peerId));
    clearLinks();
    if (roleRef.current === 'sender') {
      rejoin().catch(() => undefined);
    } else {
      rehost().catch(() => undefined);
    }
  }, [clearLinks, rehost, rejoin, removePeer]);
  useRemoteAudioBridgeSubscriptions({
    acceptAudioRef,
    acceptSignalRef,
    acceptStreamingRef,
    handleError: handleLanError,
  });

  const showCode = useCallback(
    async (replaceCode = false) => {
      if (
        roleRef.current === 'listener' &&
        !replaceCode &&
        phaseRef.current !== 'error' &&
        phaseRef.current !== 'disconnected'
      ) {
        return;
      }
      generationRef.current += 1;
      const attempt = generationRef.current;
      clearLinks();
      setRole('listener');
      setError(undefined);
      setPhase('preparing');
      try {
        const details = await bridge.startRemoteAudioLanHost(replaceCode);
        if (generationRef.current !== attempt) {
          return;
        }
        setDeviceName(details.deviceName);
        setLanOptions(details.options);
        setPhase('waiting');
      } catch {
        if (generationRef.current === attempt) {
          setRole(undefined);
          setError('lan');
          setPhase('error');
        }
      }
    },
    [bridge, clearLinks, setPhase, setRole],
  );

  const link = useCallback(
    async (code: string) => {
      generationRef.current += 1;
      const attempt = generationRef.current;
      clearLinks();
      setLanOptions([]);
      setRole('sender');
      setError(undefined);
      setPhase('connecting');
      try {
        const joined = await bridge.joinRemoteAudioLan(code.trim());
        if (generationRef.current !== attempt) {
          return;
        }
        setDeviceName(joined.deviceName);
        publish();
      } catch {
        if (generationRef.current === attempt) {
          setRole(undefined);
          setError('lan');
          setPhase('error');
        }
      }
    },
    [bridge, clearLinks, publish, setPhase, setRole],
  );

  /**
   * Ends every link of this computer's, for good.
   *
   * A computer that joined forgets the code it pasted and shows its own
   * again. A computer whose code was used gets a new one: anybody holding the
   * old code could otherwise come straight back, because a code is the whole
   * of what a link needs.
   */
  const unlink = useCallback(async () => {
    if (stoppingRef.current) {
      return;
    }
    const wasJoined = roleRef.current === 'sender';
    stoppingRef.current = true;
    generationRef.current += 1;
    await Promise.allSettled(
      [...recordsRef.current.keys()].map((peerId) =>
        bridge.sendRemoteAudioLanSignal({ peerId, signal: { kind: 'stop' } }),
      ),
    );
    clearLinks();
    if (wasJoined) {
      await bridge.stopRemoteAudioLan('unlink').catch(() => undefined);
    }
    setRole(undefined);
    setDeviceName(undefined);
    setPhase('idle');
    stoppingRef.current = false;
    await showCode(!wasJoined);
  }, [bridge, clearLinks, setPhase, setRole, showCode]);

  const setSwitches = useCallback(
    async (name: string, switches: ILinkSwitches) => {
      await bridge.setRemoteAudioLinkSwitches(name, switches);
      recordsRef.current.forEach((record) => {
        if (record.name === name) {
          Object.assign(record, {
            switches,
            receiving: switches.play ? record.receiving : false,
          });
        }
      });
      publish();
    },
    [bridge, publish],
  );

  const resumePlayback = useCallback(async () => {
    try {
      await resume();
      playbackBlockedRef.current = false;
      setError(undefined);
      publish();
    } catch {
      setError('playback');
    }
  }, [publish, resume]);

  const value = useMemo(
    () => ({
      bothWays,
      deviceName,
      error,
      lanOptions,
      links,
      networkStats,
      phase,
      role,
      sending,
      sendingFailed,
      showCode,
      link,
      unlink,
      setSwitches,
      resumePlayback,
      subscribeMeter,
    }),
    [
      bothWays,
      deviceName,
      error,
      lanOptions,
      link,
      links,
      networkStats,
      phase,
      resumePlayback,
      role,
      sending,
      sendingFailed,
      setSwitches,
      showCode,
      subscribeMeter,
      unlink,
    ],
  );

  return (
    <RemoteAudioContext.Provider value={value}>
      <RemoteAudioReceivingContext.Provider value={receiving}>
        <IncomingSoundContext.Provider value={incoming}>
          {children}
        </IncomingSoundContext.Provider>
      </RemoteAudioReceivingContext.Provider>
    </RemoteAudioContext.Provider>
  );
};

export default RemoteAudioProvider;
