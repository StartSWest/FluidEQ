/* FluidEQ — GPL-3.0-or-later */
import fs from 'fs';
import path from 'path';
import type { TRemoteAudioStreamMode } from '../common/remoteAudio';

const FILE_NAME = 'remote-audio-smooth.json';

/**
 * Share Audio's Smooth playback switch, as this computer last left it.
 *
 * On, every link this computer is on plays with a cushion that rides out
 * Wi-Fi stalls: about half a second later, and never a cut. The other
 * computer is told with the `music` word of the `stream-mode` signal, which
 * every version reads, so the link is smooth at both ends whichever one
 * asked.
 */
export const createSmoothSwitch = (userDataDir: string) => {
  const filePath = path.join(userDataDir, FILE_NAME);
  let on = false;
  try {
    const stored: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    on =
      typeof stored === 'object' &&
      stored !== null &&
      (stored as { smooth?: unknown }).smooth === true;
  } catch {
    // Never switched, or a file that is not ours: today's playback.
  }
  return {
    get: () => on,
    set: (next: boolean) => {
      on = next;
      const temporary = `${filePath}.tmp`;
      try {
        fs.mkdirSync(userDataDir, { recursive: true });
        fs.writeFileSync(temporary, JSON.stringify({ smooth: on }), 'utf8');
        fs.renameSync(temporary, filePath);
      } catch {
        // A switch that could not be saved still holds for this session.
      }
    },
  };
};

/**
 * Which links play smooth: all of them while this computer's switch is on,
 * and any whose other end said `music`. `apply` hears each link's answer
 * once, when it changes.
 */
export const createSmoothLinks = (
  apply: (peerId: string, smooth: boolean) => void,
) => {
  let local = false;
  const heard = new Map<string, TRemoteAudioStreamMode>();
  const applied = new Map<string, boolean>();
  const smooth = (peerId: string) => local || heard.get(peerId) === 'music';
  const update = (peerId: string) => {
    const want = smooth(peerId);
    if (applied.get(peerId) !== want) {
      applied.set(peerId, want);
      apply(peerId, want);
    }
  };
  return {
    smooth,
    setLocal: (on: boolean) => {
      local = on;
      [...heard.keys()].forEach(update);
    },
    heard: (peerId: string, mode: TRemoteAudioStreamMode) => {
      heard.set(peerId, mode);
      update(peerId);
    },
    forget: (peerId: string) => {
      heard.delete(peerId);
      applied.delete(peerId);
    },
    clear: () => {
      heard.clear();
      applied.clear();
    },
  };
};
