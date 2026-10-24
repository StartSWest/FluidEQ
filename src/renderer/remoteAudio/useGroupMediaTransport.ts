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
  const peers = links.filter((link) => !linkPaused(link));
  const snapshot = {
    local: {
      isPlaying: local?.isPlaying === true,
      canToggle: local !== undefined && local.canToggle !== false,
    },
    peers: peers.map((peer) => ({
      id: peer.id,
      isPlaying: peer.nowPlaying?.isPlaying === true,
      canToggle: peer.nowPlaying !== undefined,
    })),
    preferLocal: last !== 'remote',
  };
  const state = useRef({ snapshot, perform, bridge });
  state.current = { snapshot, perform, bridge };
  const router = useRef<
    ReturnType<typeof createGroupMediaTransport> | undefined
  >(undefined);
  router.current ??= createGroupMediaTransport(
    () => state.current.snapshot,
    (command) => state.current.perform(command),
    (peerId, command) => {
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
  const wanted = peers.length > 0;
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
