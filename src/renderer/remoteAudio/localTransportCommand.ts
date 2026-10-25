/* FluidEQ — GPL-3.0-or-later */
import type { TRemoteTransportCommand } from '../../common/remoteAudio';
import { stopAllPlayback } from '../audio/playbackOwner';
import type { ITransportSource } from '../audio/transportSource';

/** A command arriving over a link affects local players only. In particular,
 * neither the registered remote player nor a synthesized media key may send
 * it back out. Pause also reaches players hidden behind the current bar. */
const performLocalTransport = (
  source: ITransportSource | undefined,
  command: TRemoteTransportCommand,
) => {
  const bridge = window.electron?.ipcRenderer;
  if (command.command === 'pause' || command.command === 'stop') {
    if (command.command === 'stop' && source?.owner !== 'remote') {
      source?.stop?.();
    }
    stopAllPlayback('remote');
    bridge?.pauseOtherSystemPlayers?.()?.catch(() => undefined);
    return;
  }
  if (!source || source.owner === 'remote') {
    return;
  }
  if (command.command === 'toggle' || command.command === 'play') {
    if (
      source.canToggle === false ||
      (command.command === 'play' && source.isPlaying)
    ) {
      return;
    }
    if (source.owner === 'system') {
      bridge
        ?.sendSystemMediaCommand?.(
          command.command === 'toggle' && source.isPlaying ? 'pause' : 'play',
        )
        ?.catch(() => undefined);
    } else {
      source.toggle();
    }
    return;
  }
  if (command.command === 'next') {
    source.next?.();
    return;
  }
  if (command.command === 'previous') {
    source.previous?.();
    return;
  }
  if (command.command === 'nudge' && source.nudge) {
    source.nudge(command.deltaMs);
    return;
  }
  if (
    source.seek &&
    source.durationMs > 0 &&
    (command.command === 'seek' || command.command === 'nudge')
  ) {
    const position =
      command.command === 'seek'
        ? command.positionMs
        : source.positionMs + command.deltaMs;
    source.seek(Math.min(source.durationMs, Math.max(0, position)));
  }
};
export default performLocalTransport;
