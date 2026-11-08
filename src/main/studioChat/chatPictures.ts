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
import { LOOK_SCHEMA } from '../studioAgent/lookRequest';
import type { IMcpTool } from '../studioAgent/mcpProtocol';
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
 * sign-in, and the chat's tool servers (`chatServer.ts`) that carry them to
 * Claude beside the door's look and hear.
 *
 * One server a project, each with its own key and its tools bound to that
 * project (Ivan, 2026-11-07: "all chats needs to be parallel and take its
 * own captures"). There was one for every chat, and its tools asked which
 * project the Studio was showing: with Claude at work on two scenes, a look
 * that named no folder drew the scene the member had switched to, and
 * pack_artwork wrote one scene's artwork into the other.
 */

/** The look offers no folder to name: a chat's look is its own project's. */
const LOOK_WITHOUT_FOLDER = {
  ...LOOK_SCHEMA,
  properties: Object.fromEntries(
    Object.entries(LOOK_SCHEMA.properties).filter(([key]) => key !== 'folder'),
  ),
};

/** The door's look and hear, bound to the project in `folder`. */
const ownLookTools = (door: IStudioLook, folder: string): IMcpTool[] =>
  createStudioTools({
    look: (request) => door.look({ ...request, folder }),
    hear: door.hear,
  }).map((tool) =>
    tool.name === 'look_at_scene'
      ? { ...tool, inputSchema: LOOK_WITHOUT_FOLDER }
      : tool,
  );

export interface IChatPicturesDeps {
  root: string;
  pageOf(): WebContents | undefined;
  fromWindow(event: IpcMainInvokeEvent): boolean;
  /** The Studio's project in `folder`, if the member may use it now. */
  projectAt(folder: string): TAgentProject;
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
  projectAt,
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
    projectId: string,
    what: Omit<IStudioChatPackAsk, 'id'>,
  ): Promise<TStudioChatPackAnswer | 'no-window'> => {
    const page = pageOf();
    if (!page) {
      return Promise.resolve('no-window');
    }
    nextPack += 1;
    const ask: IStudioChatPackAsk = { ...what, id: nextPack };
    const signal = signalOf(projectId);
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

  /**
   * The project as its chat started on it, asked again on every call: a
   * project taken off the list, locked, or moved since is no project of
   * this chat's, and never the one the Studio happens to show instead.
   */
  const boundProject = (projectId: string, folder: string): TAgentProject => {
    const found = projectAt(folder);
    return found.ok && found.id !== projectId
      ? { ok: false, reason: 'not-a-project' }
      : found;
  };

  const servers = new Map<
    string,
    { folder: string; server: ReturnType<typeof createChatServer> }
  >();

  /** The project's own server, made on its chat's first message. */
  const serverFor = (projectId: string, folder: string) => {
    const known = servers.get(projectId);
    if (known?.folder === folder) {
      return known.server;
    }
    known?.server.close().catch(() => undefined);
    const server = createChatServer({
      tools: [
        ...ownLookTools(door, folder),
        ...createPictureTools({
          project: () => boundProject(projectId, folder),
          asks,
          signalOf,
          packInWindow: (what) => packInWindow(projectId, what),
          ...(logger ? { logger } : {}),
        }),
      ],
      version,
      ...(logger ? { logger } : {}),
    });
    servers.set(projectId, { folder, server });
    return server;
  };

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
    /** Where the project's Claude Code reaches its tools. */
    address: (projectId: string, folder: string) =>
      serverFor(projectId, folder).address(),
    /** The project's chat let go: its server stops listening. */
    close: async (projectId: string) => {
      const known = servers.get(projectId);
      servers.delete(projectId);
      await known?.server.close();
    },
    dispose: async () => {
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
      packing.forEach(({ resolve }) => resolve('no-window'));
      packing.clear();
      const closing = [...servers.values()].map(({ server }) => server.close());
      servers.clear();
      await Promise.all(closing);
    },
  };
};
