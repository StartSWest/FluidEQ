/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron';
import {
  isStudioChatAnswer,
  type IStudioChatPackAsk,
  type TStudioChatCodex,
  type TStudioChatPackAnswer,
} from '../../common/studioChat';
import {
  MAX_SCENE_ARTWORK_BYTES,
  readWebpSize,
} from '../../common/sceneArtwork';
import type { TAgentProject } from '../studioAgent/agentProject';
import {
  createStudioTools,
  type IStudioLook,
} from '../studioAgent/studioTools';
import { createChatAsks } from './chatAsks';
import { createChatServer } from './chatServer';
import { codexState, signInToCodex } from './codexPictures';
import { createPictureTools } from './pictureTools';

/**
 * Everything the chat needs for ChatGPT's pictures, wired to the window:
 * the asks and their cards, the packing the window does, Codex's state and
 * sign-in, and the chat's own tool server (`chatServer.ts`) that carries
 * them to Claude beside the door's look and hear.
 */

export interface IChatPicturesDeps {
  root: string;
  pageOf(): WebContents | undefined;
  fromWindow(event: IpcMainInvokeEvent): boolean;
  project(): TAgentProject;
  /** The member's Stop for the reply in progress on a project. */
  signalOf(projectId: string): AbortSignal;
  door: IStudioLook;
  version: string;
  logger?: { info(message: string): void; warn(message: string): void };
}

const CHANNELS = [
  'studio-chat-answer',
  'studio-chat-codex',
  'studio-chat-codex-sign-in',
  'studio-chat-codex-disconnect',
  'studio-chat-packed',
];

/** The window's packed artwork, read as nothing unless it is what was asked. */
const readPacked = (
  raw: unknown,
  ask: IStudioChatPackAsk,
): TStudioChatPackAnswer => {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, reason: 'failed' };
  }
  const answer = raw as Record<string, unknown>;
  if (answer.ok === false) {
    return answer.reason === 'too-big' || answer.reason === 'unreadable'
      ? { ok: false, reason: answer.reason }
      : { ok: false, reason: 'failed' };
  }
  const { webp } = answer;
  if (
    !(webp instanceof Uint8Array) ||
    webp.byteLength > MAX_SCENE_ARTWORK_BYTES
  ) {
    return { ok: false, reason: 'failed' };
  }
  const size = readWebpSize((at) => webp[at], webp.byteLength);
  return size && size.width === ask.width && size.height === ask.height
    ? { ok: true, webp }
    : { ok: false, reason: 'failed' };
};

export const createChatPictures = ({
  root,
  pageOf,
  fromWindow,
  project,
  signalOf,
  door,
  version,
  logger,
}: IChatPicturesDeps) => {
  const asks = createChatAsks({
    root,
    show: (projectId, ask) =>
      pageOf()?.send('studio-chat-ask', { projectId, ask }),
  });

  let nextPack = 0;
  const packing = new Map<
    number,
    {
      ask: IStudioChatPackAsk;
      resolve: (answer: TStudioChatPackAnswer | 'no-window') => void;
    }
  >();

  const packInWindow = (
    what: Omit<IStudioChatPackAsk, 'id'>,
  ): Promise<TStudioChatPackAnswer | 'no-window'> => {
    const page = pageOf();
    const open = project();
    if (!page || !open.ok) {
      return Promise.resolve('no-window');
    }
    nextPack += 1;
    const ask: IStudioChatPackAsk = { ...what, id: nextPack };
    const signal = signalOf(open.id);
    return new Promise((resolve) => {
      const settle = (answer: TStudioChatPackAnswer | 'no-window') => {
        signal.removeEventListener('abort', gone);
        page.removeListener('destroyed', gone);
        packing.delete(ask.id);
        resolve(answer);
      };
      // Stopped, or the page that was asked going away, answers nothing.
      function gone() {
        settle('no-window');
      }
      signal.addEventListener('abort', gone, { once: true });
      page.once('destroyed', gone);
      packing.set(ask.id, { ask, resolve: settle });
      page.send('studio-chat-pack', ask);
    });
  };

  const server = createChatServer({
    tools: [
      ...createStudioTools(door),
      ...createPictureTools({
        project,
        asks,
        signalOf,
        packInWindow,
        ...(logger ? { logger } : {}),
      }),
    ],
    version,
    ...(logger ? { logger } : {}),
  });

  /** What the chat's head shows: Codex here, and whether it is connected. */
  const codexOf = async (): Promise<{
    codex: TStudioChatCodex;
    connected: boolean;
  }> => ({
    codex: (await codexState()).state,
    connected: asks.isConnected(),
  });

  ipcMain.handle(
    'studio-chat-answer',
    (event, id: unknown, answer: unknown) => {
      if (
        fromWindow(event) &&
        typeof id === 'string' &&
        isStudioChatAnswer(answer)
      ) {
        asks.answer(id, answer);
      }
    },
  );

  ipcMain.handle('studio-chat-codex', (event) =>
    fromWindow(event) ? codexOf() : undefined,
  );

  ipcMain.handle('studio-chat-codex-sign-in', async (event) => {
    if (!fromWindow(event)) {
      return undefined;
    }
    const { executable } = await codexState();
    if (executable) {
      await signInToCodex(executable);
    }
    return codexOf();
  });

  ipcMain.handle('studio-chat-codex-disconnect', (event) => {
    if (fromWindow(event)) {
      asks.disconnect();
    }
    return fromWindow(event) ? codexOf() : undefined;
  });

  ipcMain.handle(
    'studio-chat-packed',
    (event, id: unknown, answer: unknown) => {
      const pending = typeof id === 'number' ? packing.get(id) : undefined;
      if (!fromWindow(event) || !pending || typeof id !== 'number') {
        return;
      }
      packing.delete(id);
      pending.resolve(readPacked(answer, pending.ask));
    },
  );

  return {
    asks,
    address: server.address,
    dispose: async () => {
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
      packing.forEach(({ resolve }) => resolve('no-window'));
      packing.clear();
      await server.close();
    },
  };
};
