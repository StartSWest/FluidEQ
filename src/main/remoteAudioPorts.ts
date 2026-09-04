/* FluidEQ — GPL-3.0-or-later */

import {
  ipcMain,
  type BrowserWindow,
  type IpcMainEvent,
  type MessagePortMain,
} from 'electron';
import type {
  ILanRemoteAudioChunk,
  ILanRemoteAudioSignal,
} from '../common/remoteAudio';
import {
  isRemoteAudioPortKind,
  REMOTE_AUDIO_PORT_CHANNEL,
  type TRemoteAudioPortKind,
} from '../common/remoteAudioPorts';

/** Audio goes directly to its worklet/worker after this one-time handoff. */
const createRemoteAudioPorts = (
  getWindow: () => BrowserWindow | null,
  onStreaming: (peerId: string) => void,
) => {
  const ports = new Map<TRemoteAudioPortKind, MessagePortMain>();
  const modes = new Map<string, 'music' | 'video'>();
  const streaming = new Set<string>();
  const post = (kind: TRemoteAudioPortKind, data: unknown) => {
    const port = ports.get(kind);
    try {
      port?.postMessage(data);
    } catch (error) {
      // A terminated visual worker must never stop capture or disconnect its
      // network peer. The next visual subscriber replaces its closed port.
      console.error(`Remote audio ${kind} port closed during delivery`, error);
      if (ports.get(kind) === port) {
        ports.delete(kind);
      }
      port?.close();
    }
  };
  const receivePort = (event: IpcMainEvent, kind: unknown) => {
    const window = getWindow();
    const [port] = event.ports;
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      !isRemoteAudioPortKind(kind) ||
      !port ||
      event.ports.length !== 1
    ) {
      event.ports.forEach((candidate) => candidate.close());
      return;
    }
    ports.get(kind)?.close();
    ports.set(kind, port);
    port.on('close', () => {
      if (ports.get(kind) === port) {
        ports.delete(kind);
      }
    });
    port.start();
    post(kind, { kind: 'ready' });
    if (kind === 'playback') {
      modes.forEach((mode, peerId) =>
        post('playback', { kind: 'configure', mode, peerId }),
      );
    }
  };
  ipcMain.on(REMOTE_AUDIO_PORT_CHANNEL, receivePort);
  return {
    audio: (chunk: ILanRemoteAudioChunk) => {
      post('playback', { kind: 'push', ...chunk });
      if (!streaming.has(chunk.peerId)) {
        streaming.add(chunk.peerId);
        onStreaming(chunk.peerId);
      }
    },
    analyze: (chunk: ILanRemoteAudioChunk) => {
      post('analysis', chunk);
    },
    signal: ({ peerId, signal }: ILanRemoteAudioSignal) => {
      if (signal.kind === 'stream-mode') {
        modes.set(peerId, signal.mode);
        post('playback', { kind: 'configure', mode: signal.mode, peerId });
      } else if (signal.kind === 'stop') {
        streaming.delete(peerId);
        modes.delete(peerId);
        post('playback', { kind: 'remove-peer', peerId });
      }
    },
    reset: () => {
      modes.clear();
      streaming.clear();
      ports.forEach((_port, kind) => post(kind, { kind: 'reset' }));
    },
    close: () => {
      ipcMain.removeListener(REMOTE_AUDIO_PORT_CHANNEL, receivePort);
      ports.forEach((port) => port.close());
      ports.clear();
    },
  };
};

export default createRemoteAudioPorts;
