/* FluidEQ — GPL-3.0-or-later */
import { EventEmitter } from 'events';
import type { IAudioWorkerTransport } from './host';
import { SHARE_AUDIO_PROCESS_NAME } from '../utilityProcessNames';

/** A separate Node owner lets Windows schedule just its time-critical thread
 * as Audio, without loading a native addon into Electron's concurrent workers. */
export const createAudioProcess = (
  entry: string,
  resourcesPath?: string,
): IAudioWorkerTransport => {
  // This factory only runs in Electron main, after the backend is selected.
  // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports -- utility APIs cannot be loaded in the Node audio child
  const electron = require('electron') as typeof import('electron');
  const { app, utilityProcess } = electron;
  const events = new EventEmitter();
  const queued: unknown[] = [];
  let child: ReturnType<typeof utilityProcess.fork> | undefined;
  let live = false;
  let ended = false;
  const send = (message: unknown) => {
    if (ended) {
      throw new Error('Share Audio process stopped.');
    }
    if (live && child) {
      child.postMessage(message);
    } else {
      if (queued.length >= 128) {
        throw new Error('Share Audio startup queue is full.');
      }
      queued.push(message);
    }
  };
  app
    .whenReady()
    .then(() => {
      if (ended) {
        return undefined;
      }
      child = utilityProcess.fork(entry, [resourcesPath ?? ''], {
        serviceName: SHARE_AUDIO_PROCESS_NAME,
        // Its only host traffic is the bounded message port. An unread stdout
        // must never become a second path that can block the audio service.
        stdio: 'ignore',
      });
      child.on('spawn', () => {
        live = true;
        queued.splice(0).forEach(send);
      });
      child.on('message', (message) => events.emit('message', message));
      // Electron says what went wrong and where; kept in the message, or a
      // failed service reached the log as nothing but its name.
      child.on('error', (type, location) =>
        events.emit(
          'error',
          new Error(`Share Audio process failed: ${type} at ${location}.`),
        ),
      );
      child.on('exit', (code) => {
        ended = true;
        queued.length = 0;
        events.emit('exit', code);
      });
      return undefined;
    })
    .catch(() =>
      events.emit('error', new Error('Share Audio process could not start.')),
    );
  return Object.assign(events, {
    postMessage: send,
    ref: () => undefined,
    unref: () => undefined,
    terminate: async () => {
      ended = true;
      queued.length = 0;
      child?.kill();
      return 0;
    },
  });
};
