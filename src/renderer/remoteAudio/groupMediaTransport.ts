/* FluidEQ — GPL-3.0-or-later */
import type { TRemoteTransportCommand } from '../../common/remoteAudio';

export interface IGroupMediaSnapshot {
  local: { isPlaying: boolean; canToggle: boolean };
  peers: readonly { id: string; isPlaying: boolean; canToggle: boolean }[];
  preferLocal: boolean;
}

const LOCAL = Symbol('local-player');
type TTarget = string | typeof LOCAL;

/** Resolve a physical toggle once for the whole group. Sending a toggle to
 * every PC starts the paused ones while pausing the playing ones. Only the
 * origin sends; recipients execute locally and never rebroadcast commands. */
const createGroupMediaTransport = (
  read: () => IGroupMediaSnapshot,
  perform: (command: TRemoteTransportCommand) => void,
  send: (peerId: string, command: TRemoteTransportCommand) => void,
) => {
  let previous: TTarget[] = [];
  let lastPlaying: TTarget[] = [];
  const observe = () => {
    const snapshot = read();
    const playing: TTarget[] = snapshot.peers
      .filter((peer) => peer.isPlaying)
      .map((peer) => peer.id);
    if (snapshot.local.isPlaying) {
      playing.unshift(LOCAL);
    }
    // Pauses arrive from different machines in different renders. Keep the
    // cohort that was playing until a new source starts, rather than losing
    // the first PC paused while the last PC's acknowledgment is still coming.
    if (playing.some((target) => !previous.includes(target))) {
      lastPlaying = playing;
    }
    previous = playing;
    return { snapshot, playing };
  };
  return {
    observe,
    execute(input: TRemoteTransportCommand) {
      const { snapshot, playing } = observe();
      const command: TRemoteTransportCommand =
        input.command === 'toggle'
          ? { command: playing.length > 0 ? 'pause' : 'play' }
          : input;
      const peers = new Set(snapshot.peers.map((peer) => peer.id));
      const apply = (target: TTarget) => {
        if (target === LOCAL) {
          perform(command);
        } else if (peers.has(target)) {
          send(target, command);
        }
      };
      if (command.command === 'pause' || command.command === 'stop') {
        // No metadata is also a possible player. Pause/Stop must reach every
        // connected computer without making an inactive computer start.
        if (playing.length > 0) {
          lastPlaying = playing;
        }
        perform(command);
        peers.forEach(apply);
        return;
      }
      const remembered = lastPlaying.filter((target) =>
        target === LOCAL ? snapshot.local.canToggle : peers.has(target),
      );
      let targets = playing.length > 0 ? playing : remembered;
      if (targets.length === 0) {
        const peer = snapshot.peers.find((entry) => entry.canToggle);
        if (snapshot.local.canToggle && (snapshot.preferLocal || !peer)) {
          targets = [LOCAL];
        } else if (peer) {
          targets = [peer.id];
        }
      }
      [...new Set(targets)].forEach(apply);
    },
  };
};
export default createGroupMediaTransport;
