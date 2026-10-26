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
  ILanRemoteAudioChunk,
  ILanRemoteAudioSignal,
  ILanSavedJoin,
} from '../../common/remoteAudio';
import { useFluidEqShell } from '../utils/FluidEqContext';
import { setSinglePlayerFromLink } from '../utils/singlePlayer';
import { measureRemoteAudioChunk } from './meter';
import {
  ALL_ON,
  applySwitches,
  type ILinkRecord,
  linkPaused,
  linkPhase,
  linkViews,
  heardHere,
  playsHere,
  sendsThere,
} from './linkRecords';
import type {
  ILinkSwitches,
  IRemoteAudioLink,
  TRemoteAudioError,
  TRemoteAudioPhase,
} from './remoteAudioState';
import RemoteAudioContext, {
  IncomingSoundContext,
  RemoteAudioReceivingContext,
} from './remoteAudioValueContext';
import useArrivingSound from './useArrivingSound';
import useLinuxShareDevices from './useLinuxShareDevices';
import useSelectedRemoteAudioOutput from './useSelectedRemoteAudioOutput';
import useRemoteAudioMeterBus from './useRemoteAudioMeterBus';
import useRemoteAudioNetworkStats from './useRemoteAudioNetworkStats';
import useRemoteAudioBridgeSubscriptions from './useRemoteAudioBridgeSubscriptions';
import useRemoteAudioMixer from './useRemoteAudioMixer';
import useRemoteAudioPcmSender from './useRemoteAudioPcmSender';
import useRemoteAudioSending from './useRemoteAudioSending';
import useRemoteNowPlayingBroadcast from './useRemoteNowPlayingBroadcast';
import useRemoteNowPlayingSource from './useRemoteNowPlayingSource';
import createLinkSwitchWrites from './linkSwitchWrites';
import useRemoteAudioRecovery from './useRemoteAudioRecovery';
import GroupMediaTransportHost from './GroupMediaTransportHost';

/**
 * Share Audio: the computers linked with this one, both ways, all to all.
 *
 * Every computer has one code and keeps it. A link is made once — either
 * computer pastes the other's code — and from then on each sends its own
 * sound and plays the other's, each direction on its own switch; any number
 * of computers link the same way, and unlinking one leaves the rest. Main
 * does the listening, the joining, the sending and the playing
 * (`ipc/remoteAudio.ts`, `remoteAudioLan.ts`, `remoteAudioLinks.ts`); the
 * window keeps the picture of every link, opens the output the other
 * computers' sound plays through, and runs the one-player rule across the
 * wire in both directions.
 */
const RemoteAudioProvider = ({ children }: { children: ReactNode }) => {
  const { activeDeviceId } = useFluidEqShell();
  const platform = window.electron?.platform;
  const bridge = window.electron?.ipcRenderer;
  const writeSwitches = useMemo(
    () =>
      createLinkSwitchWrites((key, value) =>
        bridge.setRemoteAudioLinkSwitches(key, value),
      ),
    [bridge],
  );
  const linuxShare = useLinuxShareDevices();
  // Both ways where nothing received can go back out: Windows' process
  // loopback, or the Linux engine's own Send and Share In.
  const bothWays =
    platform === 'win32' ||
    (platform === 'linux' &&
      linuxShare.shareOutputId !== undefined &&
      linuxShare.sendInputId !== undefined);
  useEffect(() => {
    if (platform === 'linux') {
      bridge?.setRemoteAudioBothWays?.(bothWays).catch(() => undefined);
    }
  }, [bothWays, bridge, platform]);
  const [phase, setPhaseState] = useState<TRemoteAudioPhase>('idle');
  const phaseRef = useRef<TRemoteAudioPhase>('idle');
  const setPhase = useCallback((next: TRemoteAudioPhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);
  const [error, setError] = useState<TRemoteAudioError | undefined>();
  const [code, setCode] = useState<string | undefined>();
  const [deviceName, setDeviceName] = useState<string | undefined>();
  const [joins, setJoins] = useState<ILanSavedJoin[]>([]);
  const [sharing, setSharingState] = useState(true);
  const [recoveryAttempt, setRecoveryAttempt] = useState(0);
  const recoverAudio = useCallback(
    () => setRecoveryAttempt((value) => value + 1),
    [],
  );
  const setSharing = useCallback(
    async (enabled: boolean) => {
      await bridge.setRemoteAudioLinkSwitches('@source', {
        ...ALL_ON,
        send: enabled,
      });
      setSharingState(enabled);
    },
    [bridge],
  );
  const recordsRef = useRef(new Map<string, ILinkRecord>());
  const [links, setLinks] = useState<IRemoteAudioLink[]>([]);
  const playbackBlockedRef = useRef(false);
  const generationRef = useRef(0);
  const outputSinkIdRef = useRef('default');
  const { publishMeter, subscribeMeter } = useRemoteAudioMeterBus();
  const { clearNetworkStats, networkStats, removeNetworkPeer } =
    useRemoteAudioNetworkStats(phase !== 'idle');

  /** The picture of every link, and the page's one word for it, redrawn. */
  const publish = useCallback(() => {
    const records = recordsRef.current;
    setLinks(linkViews(records));
    const settled = phaseRef.current;
    if (settled === 'ready' || settled === 'playback-blocked') {
      setPhase(linkPhase(records, playbackBlockedRef.current));
    }
  }, [setPhase]);

  const clearLinks = useCallback(() => {
    recordsRef.current.clear();
    clearNetworkStats();
    setLinks([]);
  }, [clearNetworkStats]);

  const playedHere = links.some((link) => playsHere(link, bothWays));
  const { mixerRef, removePeer, resume } = useRemoteAudioMixer({
    recoveryAttempt,
    wanted: phase !== 'idle' && playedHere,
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
  useSelectedRemoteAudioOutput(
    activeDeviceId,
    mixerRef,
    outputSinkIdRef,
    bothWays && platform === 'linux' ? linuxShare.shareOutputId : undefined,
  );

  const { receiving, delays, incoming } = useArrivingSound(
    links,
    bothWays,
    subscribeMeter,
  );
  const { sending, sendingFailed, markSending, markSendingFailed } =
    useRemoteAudioSending({
      bothWays,
      receiving,
    });
  // Off Windows the window sends, to every computer that is to hear it.
  const sendTo = links
    .filter((link) => sharing && sendsThere(link, bothWays))
    .map((link) => link.id);
  const sendToKey = sendTo.join('\n');
  const sendToIds = useMemo(
    () => (sendToKey ? sendToKey.split('\n') : []),
    [sendToKey],
  );
  useRemoteAudioPcmSender({
    recoveryAttempt,
    peerIds: sendToIds,
    sendInputId: bothWays ? linuxShare.sendInputId : undefined,
    publishMeter,
    onSending: markSending,
    onFailure: markSendingFailed,
  });

  // A paused link hears nothing of this computer's players either; it hears
  // the description as it stands again the moment it resumes.
  const performRemoteTransport = useRemoteNowPlayingBroadcast(
    links.filter((link) => !linkPaused(link)).map((link) => link.id),
  );
  const acceptRemoteStart = useRemoteNowPlayingSource(
    links.filter((link) => heardHere(link, bothWays)),
    links.filter((link) => !link.joined).map((link) => link.id),
    delays,
  );

  /**
   * This computer's code on the network, and every pasted computer looked
   * for. Asked again while running, main answers from the running session,
   * so this never drops a link — it is how the page opens.
   */
  // The links outlive this window; the first start in it hears them again.
  const replayRef = useRef<(message: ILanRemoteAudioSignal) => void>(
    () => undefined,
  );
  const heardLinksRef = useRef(false);
  const start = useCallback(async () => {
    generationRef.current += 1;
    const attempt = generationRef.current;
    if (phaseRef.current === 'idle' || phaseRef.current === 'error') {
      setPhase('preparing');
    }
    try {
      const replay = !heardLinksRef.current;
      const started = await bridge.startRemoteAudioLan(replay);
      if (generationRef.current !== attempt) {
        return;
      }
      setDeviceName(started.details.deviceName);
      setCode(started.details.code);
      setJoins(started.joins);
      const source = await bridge.getRemoteAudioLinkSwitches?.('@source');
      if (generationRef.current !== attempt) {
        return;
      }
      // Restoring saved links and opening the page can overlap. Mark the
      // snapshot heard only after this attempt's final await; a superseded
      // start must not make its replacement skip the live-link replay.
      heardLinksRef.current = true;
      setSharingState(source?.send !== false);
      setError(undefined);
      if (phaseRef.current === 'preparing') {
        setPhase('ready');
      }
      started.links.forEach((message) => replayRef.current(message));
      publish();
    } catch {
      if (generationRef.current === attempt) {
        setError('lan');
        setPhase('error');
      }
    }
  }, [bridge, publish, setPhase]);

  // Whatever was linked last time is linked again at launch, under the same
  // code, from either side.
  const restoreAttemptedRef = useRef(false);
  useEffect(() => {
    if (restoreAttemptedRef.current || !bridge?.hasSavedRemoteAudioLan) {
      return;
    }
    restoreAttemptedRef.current = true;
    bridge
      .hasSavedRemoteAudioLan()
      .then((saved) => (saved ? start() : undefined))
      .catch(() => undefined);
  }, [bridge, start]);

  useRemoteAudioRecovery(
    phase,
    sendingFailed || playbackBlockedRef.current,
    start,
    recoverAudio,
  );

  useEffect(
    () => bridge?.onRemoteAudioLanJoins?.((next) => setJoins(next)),
    [bridge],
  );

  const acceptSignal = useCallback(
    ({ peerId, signal }: ILanRemoteAudioSignal) => {
      if (phaseRef.current === 'idle') {
        return;
      }
      const records = recordsRef.current;
      if (signal.kind === 'peer-ready') {
        const record: ILinkRecord = {
          name: signal.deviceName,
          address: signal.address,
          joined: signal.joined === true,
          computerId: signal.computerId,
          switches: ALL_ON,
          receiving: false,
        };
        records.set(peerId, record);
        setError(undefined);
        // The switches are main's, remembered by name; it is already acting
        // on them, and the page shows what it acts on.
        bridge
          ?.getRemoteAudioLinkSwitches?.(
            record.computerId ? `id:${record.computerId}` : record.name,
          )
          .then((switches) => {
            const current = records.get(peerId);
            if (current && switches && current.switches === ALL_ON) {
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
      if (
        signal.kind === 'stream-mode' &&
        signal.group &&
        signal.group.endpoint.computerId === record.computerId
      ) {
        record.name = signal.group.endpoint.deviceName;
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
        // Paused, its players and its one-player switch reach nothing here.
        if (linkPaused(record)) {
          return;
        }
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
          heardHere(record, bothWays)
        ) {
          acceptRemoteStart(peerId);
        }
        return;
      }
      if (signal.kind === 'transport') {
        // A press on the other computer's bar, carried out on this one's —
        // never while the link is paused.
        if (!linkPaused(record)) {
          performRemoteTransport(signal);
        }
        return;
      }
      if (signal.kind === 'stop') {
        // Main goes looking for a computer this one joined by itself; the
        // card waits under "looking" until it is back.
        records.delete(peerId);
        removePeer(peerId);
        removeNetworkPeer(peerId);
        publish();
      }
    },
    [
      acceptRemoteStart,
      bothWays,
      bridge,
      performRemoteTransport,
      publish,
      removeNetworkPeer,
      removePeer,
    ],
  );
  const acceptSignalRef = useRef(acceptSignal);
  acceptSignalRef.current = acceptSignal;
  replayRef.current = acceptSignal;

  // What arrives on this channel is this computer's own sound on its way out,
  // decimated for the meter: the other computers' sound never comes back up.
  const acceptAudioRef = useRef((chunk: ILanRemoteAudioChunk) => {
    publishMeter(measureRemoteAudioChunk(chunk));
  });
  const acceptStreamingRef = useRef<(peerId: string) => void>(() => undefined);
  acceptStreamingRef.current = (peerId) => {
    const record = recordsRef.current.get(peerId);
    if (record && !record.receiving) {
      record.receiving = true;
      publish();
    }
  };
  const handleLanError = useCallback(() => {
    if (phaseRef.current === 'idle') {
      return;
    }
    recordsRef.current.forEach((_record, peerId) => removePeer(peerId));
    clearLinks();
    setError('connection');
    setPhase('error');
    // Straight back on the network; failing that, when it comes back.
    start().catch(() => undefined);
  }, [clearLinks, removePeer, setPhase, start]);
  useRemoteAudioBridgeSubscriptions({
    acceptAudioRef,
    acceptSignalRef,
    acceptStreamingRef,
    handleError: handleLanError,
  });

  const link = useCallback(
    async (pasted: string) => {
      setError(undefined);
      if (phaseRef.current === 'idle' || phaseRef.current === 'error') {
        await start();
      }
      try {
        const joined = await bridge.joinRemoteAudioLan(pasted.trim());
        setJoins((current) => [
          ...current.filter((entry) => entry.computerId !== joined.computerId),
          joined,
        ]);
        if (phaseRef.current !== 'playback-blocked') {
          setPhase('ready');
        }
        return true;
      } catch {
        setError('code');
        return false;
      }
    },
    [bridge, setPhase, start],
  );

  /**
   * Ends the link with one computer, for good, and only that one. The other
   * computer is told to forget this computer's code, and is refused if it
   * comes back with it unless somebody pastes it there again.
   */
  const unlink = useCallback(
    async (target: { peerId?: string; computerId?: string }) => {
      await bridge.unlinkRemoteAudioLan(target);
      const records = recordsRef.current;
      const named =
        target.computerId ??
        (target.peerId === undefined
          ? undefined
          : records.get(target.peerId)?.computerId);
      [...records.entries()].forEach(([peerId, record]) => {
        if (
          peerId === target.peerId ||
          (named !== undefined && record.computerId === named)
        ) {
          records.delete(peerId);
          removePeer(peerId);
          removeNetworkPeer(peerId);
        }
      });
      if (named !== undefined) {
        setJoins((current) =>
          current.filter((entry) => entry.computerId !== named),
        );
      }
      publish();
    },
    [bridge, publish, removeNetworkPeer, removePeer],
  );

  const setSwitches = useCallback(
    async (name: string, switches: ILinkSwitches) => {
      // Shown first, so a volume drag follows the hand; main acts on it as
      // it arrives.
      applySwitches(recordsRef.current.values(), name, switches);
      publish();
      await writeSwitches(name, switches);
    },
    [writeSwitches, publish],
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

  const looking = useMemo(
    () =>
      joins.filter(
        (entry) => !links.some((link) => link.computerId === entry.computerId),
      ),
    [joins, links],
  );

  const value = useMemo(
    () => ({
      bothWays,
      code,
      sharing,
      setSharing,
      deviceName,
      error,
      links,
      looking,
      networkStats,
      phase,
      sending,
      sendingFailed,
      start,
      link,
      unlink,
      setSwitches,
      resumePlayback,
      subscribeMeter,
    }),
    [
      bothWays,
      code,
      sharing,
      setSharing,
      deviceName,
      error,
      link,
      links,
      looking,
      networkStats,
      phase,
      resumePlayback,
      sending,
      sendingFailed,
      setSwitches,
      start,
      subscribeMeter,
      unlink,
    ],
  );

  return (
    <RemoteAudioContext.Provider value={value}>
      <GroupMediaTransportHost links={links} perform={performRemoteTransport} />
      <RemoteAudioReceivingContext.Provider value={receiving}>
        <IncomingSoundContext.Provider value={incoming}>
          {children}
        </IncomingSoundContext.Provider>
      </RemoteAudioReceivingContext.Provider>
    </RemoteAudioContext.Provider>
  );
};

export default RemoteAudioProvider;
