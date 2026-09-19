/* FluidEQ — GPL-3.0-or-later */
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import log from 'electron-log';
import type { ILanRemoteAudioChunk } from '../../common/remoteAudio';
import {
  REMOTE_PLAYBACK_EVENT,
  TRemotePlaybackEvent,
} from '../../common/remoteAudioPlayback';
import {
  INativeRemoteAudioPlayback,
  startNativeRemoteAudioPlayback,
} from '../nativeRemoteAudioPlayback';

export const registerRemoteAudioPlayback = (
  getWindow: () => BrowserWindow | null,
) => {
  let session = 0;
  let player: INativeRemoteAudioPlayback | undefined;
  const emit = (event: TRemotePlaybackEvent) => {
    const window = getWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send(REMOTE_PLAYBACK_EVENT, event);
    }
  };
  const authorize = (event: IpcMainInvokeEvent) => {
    const window = getWindow();
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame
    ) {
      throw new Error('Playback request did not come from the app window.');
    }
  };
  const close = async () => {
    session += 1;
    const previous = player;
    player = undefined;
    await previous?.close();
  };
  ipcMain.handle(
    'remote-audio-playback-open',
    async (event, output: unknown, volume: unknown) => {
      authorize(event);
      if (
        process.platform !== 'win32' ||
        typeof output !== 'string' ||
        typeof volume !== 'number' ||
        !Number.isFinite(volume) ||
        volume < 0 ||
        volume > 1
      ) {
        throw new Error('Invalid playback request.');
      }
      const previous = player;
      player = undefined;
      session += 1;
      const id = session;
      await previous?.close();
      if (id !== session) {
        throw new Error('Playback request was replaced.');
      }
      const next = await startNativeRemoteAudioPlayback(
        (meter) => {
          if (id === session) {
            emit({ session: id, kind: 'meter', meter });
          }
        },
        () => {
          if (id === session) {
            player = undefined;
            emit({ session: id, kind: 'failed' });
          }
        },
      );
      try {
        if (id !== session) {
          throw new Error('Playback request was replaced.');
        }
        next.setVolume(volume);
        await next.setOutput(output);
        if (id !== session) {
          throw new Error('Playback request was replaced.');
        }
        player = next;
        return id;
      } catch (error) {
        await next.close();
        throw error;
      }
    },
  );
  ipcMain.handle(
    'remote-audio-playback-command',
    async (event, id: unknown, action: unknown, value: unknown) => {
      authorize(event);
      // Closing an old mixer after a new one opened must not stop its playback.
      if (id !== session) {
        return;
      }
      if (!player && action === 'close') {
        await close();
        return;
      }
      if (!player) {
        throw new Error('Shared-audio playback must be reopened.');
      }
      if (action === 'close') {
        await close();
      } else if (action === 'output' && typeof value === 'string') {
        await player.setOutput(value);
      } else if (action === 'volume' && typeof value === 'number') {
        player.setVolume(value);
      } else if (action === 'remove' && typeof value === 'string') {
        player.remove(value);
      } else {
        throw new Error('Invalid playback command.');
      }
    },
  );
  const run = (operation: (current: INativeRemoteAudioPlayback) => void) => {
    const current = player;
    if (!current) {
      return;
    }
    try {
      operation(current);
    } catch {
      // A failed local output must not break the authenticated network session
      // or prevent Stop from resetting it. The receiver offers Resume.
      if (player === current) {
        player = undefined;
        emit({ session, kind: 'failed' });
      }
      current
        .close()
        .catch((error) =>
          log.error('Could not close failed shared-audio playback', error),
        );
    }
  };
  return {
    push: (chunk: ILanRemoteAudioChunk) =>
      run((current) => current.push(chunk)),
    remove: (peerId: string) => run((current) => current.remove(peerId)),
    reset: () => run((current) => current.reset()),
    close,
  };
};
