/* FluidEQ — GPL-3.0-or-later */
import log from 'electron-log/renderer';
import {
  REMOTE_NUDGE_LIMIT_MS,
  type TRemoteTransportCommand,
} from '../../common/remoteAudio';

/** OS media surfaces may deliver explicit Play/Pause or seek actions rather
 * than a keyboard accelerator. They enter the same origin-only group router. */
const installGroupMediaSession = (
  session: MediaSession | undefined,
  execute: (command: TRemoteTransportCommand) => void,
) => {
  const registered: MediaSessionAction[] = [];
  const actions: [MediaSessionAction, MediaSessionActionHandler][] = [
    ['play', () => execute({ command: 'play' })],
    ['pause', () => execute({ command: 'pause' })],
    ['stop', () => execute({ command: 'stop' })],
    ['nexttrack', () => execute({ command: 'next' })],
    ['previoustrack', () => execute({ command: 'previous' })],
    ...(['seekbackward', 'seekforward'] as const).map(
      (action): [MediaSessionAction, MediaSessionActionHandler] => [
        action,
        (details) => {
          const offset = details.seekOffset ?? 5;
          if (Number.isFinite(offset) && offset > 0) {
            execute({
              command: 'nudge',
              deltaMs:
                Math.min(REMOTE_NUDGE_LIMIT_MS, offset * 1000) *
                (action === 'seekbackward' ? -1 : 1),
            });
          }
        },
      ],
    ),
    [
      'seekto',
      (details) => {
        const positionMs = Math.round((details.seekTime ?? Number.NaN) * 1000);
        if (Number.isSafeInteger(positionMs) && positionMs >= 0) {
          execute({ command: 'seek', positionMs });
        }
      },
    ],
  ];
  if (session && typeof session.setActionHandler === 'function') {
    actions.forEach(([action, handler]) => {
      try {
        session.setActionHandler(action, handler);
        registered.push(action);
      } catch (error) {
        log.info(
          'OS media action is unavailable for Share Audio',
          action,
          error,
        );
      }
    });
  }
  return () => {
    registered.forEach((action) => session?.setActionHandler(action, null));
  };
};
export default installGroupMediaSession;
