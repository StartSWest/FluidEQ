/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron';
import {
  isStudioChatAnswer,
  type IStudioChatCodexState,
  type IStudioChatPackAsk,
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
import { CHATGPT_PICTURES_OPEN } from '../../common/studioChatPictures';
import { createChatAsks } from './chatAsks';
import { createChatServer } from './chatServer';
import { codexAccount, type ICodexAccount } from './codexAccount';
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

  /**
   * Whose ChatGPT the signed-in Codex is, asked once per Codex and kept until
   * a sign-in through the chat could have changed it: an app-server started
   * for every look at the head would be a second or so each time.
   */
  let account: { executable: string; account: ICodexAccount } | undefined;
  const accountOf = async (executable: string) => {
    if (account?.executable !== executable) {
      account = { executable, account: await codexAccount(executable) };
    }
    return account.account;
  };

  /** What the chat's head shows: Codex here, whose it is, and if connected. */
  const codexOf = async (): Promise<IStudioChatCodexState> => {
    const { state, executable } = await codexState();
    const known =
      state === 'ready' && executable ? await accountOf(executable) : {};
    return { codex: state, connected: asks.isConnected(), ...known };
  };

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

  // Closed (`studioChatPictures.ts`), each answers nothing and starts no
  // Codex: `codexState` runs `codex login status`, and the account is read
  // from `codex app-server`.
  ipcMain.handle('studio-chat-codex', (event) =>
    CHATGPT_PICTURES_OPEN && fromWindow(event) ? codexOf() : undefined,
  );

  ipcMain.handle('studio-chat-codex-sign-in', async (event) => {
    if (!CHATGPT_PICTURES_OPEN || !fromWindow(event)) {
      return undefined;
    }
    const { executable } = await codexState();
    if (executable) {
      await signInToCodex(executable);
    }
    // Possibly someone else now: asked again.
    account = undefined;
    return codexOf();
  });

  ipcMain.handle('studio-chat-codex-disconnect', (event) => {
    if (!CHATGPT_PICTURES_OPEN || !fromWindow(event)) {
      return undefined;
    }
    asks.disconnect();
    return codexOf();
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
