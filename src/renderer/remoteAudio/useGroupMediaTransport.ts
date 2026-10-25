/* FluidEQ — GPL-3.0-or-later */
import { useEffect, useRef } from 'react';
import type { TRemoteTransportCommand } from '../../common/remoteAudio';
import { usePlaybackOwner } from '../audio/playbackOwner';
import {
  useLastTransportOwner,
  useTransportSources,
} from '../audio/transportSource';
import createGroupMediaTransport from './groupMediaTransport';
import installGroupMediaSession from './groupMediaSession';
import { linkPaused } from './linkRecords';
import type { IRemoteAudioLink } from './remoteAudioState';
import { pickSourceForRemote } from './useRemoteNowPlayingBroadcast';

/** Mounted with the provider, so headset controls keep working in the tray.
 * Receive commands use a different path: they cannot re-enter this router. */
const useGroupMediaTransport = (
  links: readonly IRemoteAudioLink[],
  perform: (command: TRemoteTransportCommand) => void,
) => {
  const sources = useTransportSources();
  const owner = usePlaybackOwner();
  const last = useLastTransportOwner();
  const local = pickSourceForRemote(sources, owner, last);
  const bridge = window.electron?.ipcRenderer;
  // A reconnect can briefly expose both the old and new socket. Route one
  // command per lasting computer, using its newest connection, or Next can
  // skip two tracks. Preserve its description until the new socket has one.
  const peers = new Map<string, IRemoteAudioLink>();
  links
    .filter((link) => !linkPaused(link))
    .forEach((peer) => {
      const key = peer.computerId ?? peer.id;
      peers.set(key, {
        ...peer,
        nowPlaying: peer.nowPlaying ?? peers.get(key)?.nowPlaying,
      });
    });
  const snapshot = {
    local: {
      isPlaying: local?.isPlaying === true,
      canToggle: local !== undefined && local.canToggle !== false,
    },
    peers: [...peers].map(([key, peer]) => ({
      id: key,
      isPlaying: peer.nowPlaying?.isPlaying === true,
      canToggle: peer.nowPlaying !== undefined,
    })),
    preferLocal: last !== 'remote',
  };
  const state = useRef({ snapshot, perform, bridge, peers });
  state.current = { snapshot, perform, bridge, peers };
  const router = useRef<
    ReturnType<typeof createGroupMediaTransport> | undefined
  >(undefined);
  router.current ??= createGroupMediaTransport(
    () => state.current.snapshot,
    (command) => state.current.perform(command),
    (key, command) => {
      const peerId = state.current.peers.get(key)?.id;
      if (!peerId) {
        return;
      }
      state.current.bridge
        ?.sendRemoteAudioLanSignal({
          peerId,
          signal: { kind: 'transport', ...command },
        })
        .catch(() => undefined);
    },
  );
  useEffect(() => {
    router.current?.observe();
  });
  const wanted = peers.size > 0;
  useEffect(() => {
    if (
      !wanted ||
      !bridge?.onGroupMediaCommand ||
      !bridge.watchGroupMediaKeys
    ) {
      return undefined;
    }
    const off = bridge.onGroupMediaCommand((command) =>
      router.current?.execute(command),
    );
    const clearSession = installGroupMediaSession(
      navigator.mediaSession,
      (command) => router.current?.execute(command),
    );
    bridge.watchGroupMediaKeys(true).catch(() => undefined);
    return () => {
      off();
      clearSession();
      if (navigator.mediaSession) {
        navigator.mediaSession.playbackState = 'none';
      }
      bridge.watchGroupMediaKeys(false).catch(() => undefined);
    };
  }, [bridge, wanted]);
  const playing =
    snapshot.local.isPlaying || snapshot.peers.some((peer) => peer.isPlaying);
  useEffect(() => {
    if (wanted && navigator.mediaSession) {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    }
  }, [wanted, playing]);
};
export default useGroupMediaTransport;
