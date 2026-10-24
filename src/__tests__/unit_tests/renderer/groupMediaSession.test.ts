/* FluidEQ — GPL-3.0-or-later */
import installGroupMediaSession from '../../../renderer/remoteAudio/groupMediaSession';

it('routes explicit OS media actions and bounded seeks, then removes only its handlers', () => {
  const handlers = new Map<MediaSessionAction, MediaSessionActionHandler>();
  const session = {
    setActionHandler: (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler | null,
    ) => {
      if (handler) {
        handlers.set(action, handler);
      } else {
        handlers.delete(action);
      }
    },
  } as MediaSession;
  const execute = jest.fn();
  const close = installGroupMediaSession(session, execute);
  (['play', 'pause', 'stop', 'nexttrack', 'previoustrack'] as const).forEach(
    (action) => {
      handlers.get(action)?.({ action });
    },
  );
  handlers.get('seekbackward')?.({ action: 'seekbackward', seekOffset: 500 });
  handlers.get('seekforward')?.({ action: 'seekforward' });
  handlers.get('seekto')?.({ action: 'seekto', seekTime: 10.5 });
  expect(execute.mock.calls.map(([command]) => command)).toEqual([
    { command: 'play' },
    { command: 'pause' },
    { command: 'stop' },
    { command: 'next' },
    { command: 'previous' },
    { command: 'nudge', deltaMs: -60000 },
    { command: 'nudge', deltaMs: 5000 },
    { command: 'seek', positionMs: 10500 },
  ]);
  execute.mockClear();
  handlers.get('seekto')?.({ action: 'seekto', seekTime: Number.NaN });
  handlers.get('seekbackward')?.({ action: 'seekbackward', seekOffset: -3 });
  expect(execute).not.toHaveBeenCalled();
  close();
  expect(handlers.size).toBe(0);
});
