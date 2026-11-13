/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron';
import {
  isStudioChatAnswer,
  type IStudioChatPackAsk,
  type IStudioChatVideoAsk,
  type TStudioChatPackAnswer,
  type TStudioChatVideoAnswer,
} from '../../common/studioChat';
import {
  MAX_SCENE_ARTWORK_BYTES,
  readWebpSize,
} from '../../common/sceneArtwork';
import type { TAgentProject } from '../studioAgent/agentProject';
import { LOOK_SCHEMA } from '../studioAgent/lookRequest';
import { VIEWS_SCHEMA } from '../studioAgent/viewsTool';
import watchPictures from '../studioAgent/watchPictures';
import { SONG_SCHEMA } from '../studioAgent/songTool';
import { WATCH_SCHEMA } from '../studioAgent/watchTool';
import type { IMcpTool } from '../studioAgent/mcpProtocol';
import {
  createStudioTools,
  type IStudioLook,
} from '../studioAgent/studioTools';
import type { THiggsfieldAccount } from '../../common/studioMakers';
import { createChatAsks } from './chatAsks';
import {
  addHiggsfield,
  higgsfieldServers,
  signInToHiggsfield,
  signOutOfHiggsfield,
} from './higgsfieldMcp';
import {
  chooseHiggsfield,
  isConnector,
  type TServersSeen,
} from './studioMakers';
import { createChatServer } from './chatServer';
import lookAnimationTool from './lookAnimationTool';
import { createPictureTools } from './pictureTools';
import sheetCodec from './sheetCodec';
import { createSheetTools } from './sheetTools';
import createVideoFramesTool from './videoFramesTool';
import createWhatsNewTool from './whatsNewTool';
import createWindowAsks from './windowAsks';

/**
 * Everything the chat needs for pictures, wired to the window: the asks
 * and their cards, the packing the window does, Higgsfield's state and
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

/** The same for the three views: they are this project's. */
const VIEWS_WITHOUT_FOLDER = {
  ...VIEWS_SCHEMA,
  properties: Object.fromEntries(
    Object.entries(VIEWS_SCHEMA.properties).filter(([key]) => key !== 'folder'),
  ),
};

/** The same for the frames watched: they are this project's too. */
const WATCH_WITHOUT_FOLDER = {
  ...WATCH_SCHEMA,
  properties: Object.fromEntries(
    Object.entries(WATCH_SCHEMA.properties).filter(([key]) => key !== 'folder'),
  ),
};

/** And for the song watched. */
const SONG_WITHOUT_FOLDER = {
  ...SONG_SCHEMA,
  properties: Object.fromEntries(
    Object.entries(SONG_SCHEMA.properties).filter(([key]) => key !== 'folder'),
  ),
};

/** The door's look, watch and hear, bound to the project in `folder`. */
const ownLookTools = (door: IStudioLook, folder: string): IMcpTool[] =>
  createStudioTools({
    look: (request) => door.look({ ...request, folder }),
    hear: door.hear,
    ...(door.shapeNow ? { shapeNow: door.shapeNow } : {}),
    pictures: watchPictures,
  }).map((tool) => {
    if (tool.name === 'look_at_scene') {
      return { ...tool, inputSchema: LOOK_WITHOUT_FOLDER };
    }
    if (tool.name === 'look_at_views') {
      return { ...tool, inputSchema: VIEWS_WITHOUT_FOLDER };
    }
    if (tool.name === 'watch_the_song') {
      return { ...tool, inputSchema: SONG_WITHOUT_FOLDER };
    }
    return tool.name === 'watch_scene'
      ? { ...tool, inputSchema: WATCH_WITHOUT_FOLDER }
      : tool;
  });

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
  'studio-chat-packed',
  'studio-chat-video-frames',
  'studio-chat-makers',
  'studio-chat-higgsfield-connect',
];

/**
 * The window's frames of a video, read as nothing unless they are what was
 * asked: as many as asked, each PNG bytes, none larger than a frame can be.
 * video_frames looks at each again before writing it.
 */
const readFrames = (
  raw: unknown,
  ask: IStudioChatVideoAsk,
): TStudioChatVideoAnswer => {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, reason: 'failed' };
  }
  const answer = raw as Record<string, unknown>;
  if (answer.ok === false) {
    return answer.reason === 'unreadable'
      ? { ok: false, reason: 'unreadable' }
      : { ok: false, reason: 'failed' };
  }
  const { frames, width, height, duration } = answer;
  const sized = (value: unknown) =>
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= ask.edge;
  return Array.isArray(frames) &&
    frames.length === ask.count &&
    frames.every((frame) => frame instanceof Uint8Array) &&
    sized(width) &&
    sized(height) &&
    typeof duration === 'number' &&
    Number.isFinite(duration)
    ? {
        ok: true,
        frames: frames as Uint8Array[],
        width: width as number,
        height: height as number,
        duration,
      }
    : { ok: false, reason: 'failed' };
};

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

  /**
   * The servers the latest chat's Claude Code reported at the start of its
   * latest turn, which is what a chat really has (`chooseHiggsfield`).
   */
  let seen: TServersSeen | undefined;
  /**
   * Counted up whenever the member's servers were changed here: a Claude
   * Code reads its servers once, at its start, so a chat started before
   * starts again at its next message (`chatSessions.ts`).
   */
  let serversChanged = 0;

  /**
   * Higgsfield as the chat can use it now (`studioMakers.ts`), asked fresh
   * every time: a sign-in made a moment ago in the browser has to count at
   * once.
   */
  const higgsfieldNow = async (): Promise<THiggsfieldAccount> =>
    chooseHiggsfield(await higgsfieldServers(), seen)?.account ?? {
      state: 'missing',
    };

  const packs = createWindowAsks<IStudioChatPackAsk, TStudioChatPackAnswer>({
    channel: 'studio-chat-pack',
    pageOf,
    signalOf,
    read: readPacked,
  });
  const videos = createWindowAsks<IStudioChatVideoAsk, TStudioChatVideoAnswer>({
    channel: 'studio-chat-video',
    pageOf,
    signalOf,
    read: readFrames,
  });

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

  /**
   * The project's own server, made on its chat's first message - or where
   * a Claude Code held across a restart already reaches it (`at`).
   */
  const serverFor = (
    projectId: string,
    folder: string,
    at?: { port: number; key: string },
  ) => {
    const known = servers.get(projectId);
    if (known?.folder === folder) {
      return known.server;
    }
    known?.server.close().catch(() => undefined);
    const server = createChatServer({
      tools: [
        ...ownLookTools(door, folder),
        lookAnimationTool(folder),
        ...createPictureTools({
          project: () => boundProject(projectId, folder),
          packInWindow: (what) => packs.ask(projectId, what),
          ...(logger ? { logger } : {}),
        }),
        // The chat makes and mends animation sheets itself: from the
        // project's own pictures, in main, nothing started.
        ...createSheetTools({
          project: () => boundProject(projectId, folder),
          signal: () => signalOf(projectId),
          codec: sheetCodec,
        }),
        // A video becomes an animation: the window draws its frames.
        createVideoFramesTool({
          project: () => boundProject(projectId, folder),
          signal: () => signalOf(projectId),
          framesInWindow: (what) => videos.ask(projectId, what),
        }),
        // The publish line, in the one shape the Publish dialog reads.
        createWhatsNewTool({
          project: () => boundProject(projectId, folder),
        }),
      ],
      version,
      ...(logger ? { logger } : {}),
      ...(at ? { at } : {}),
    });
    servers.set(projectId, { folder, server });
    return server;
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

  ipcMain.handle('studio-chat-makers', (event) =>
    fromWindow(event) ? higgsfieldNow() : undefined,
  );

  /**
   * "Set up Higgsfield" and "Sign in with Higgsfield", one press each:
   * added to the member's own Claude Code when the chat has none it can
   * use - not there at all, or only a claude.ai connector, which a headless
   * Claude Code does not reach - then Claude Code's own sign-in to it while
   * nobody is signed in. Answers what there is afterwards, whatever
   * happened: the card shows that. `another` is "Use another account":
   * Claude Code forgets the sign-in it has first.
   */
  ipcMain.handle(
    'studio-chat-higgsfield-connect',
    async (event, another: unknown) => {
      if (!fromWindow(event)) {
        return undefined;
      }
      let listed = await higgsfieldServers();
      let server = chooseHiggsfield(listed, seen);
      if (!server || server.account.state === 'connector') {
        if (!listed.some(({ name }) => !isConnector(name))) {
          await addHiggsfield();
          serversChanged += 1;
          listed = await higgsfieldServers();
        }
        // The member's own server now outranks the connector beside it.
        server = chooseHiggsfield(listed, seen);
      } else if (another === true && server.account.state === 'ready') {
        await signOutOfHiggsfield(server.name);
        serversChanged += 1;
        server = chooseHiggsfield(await higgsfieldServers(), seen);
      }
      if (server?.account.state === 'signed-out') {
        await signInToHiggsfield(server.name);
        serversChanged += 1;
      }
      return higgsfieldNow();
    },
  );

  ipcMain.handle(
    'studio-chat-packed',
    (event, id: unknown, answer: unknown) => {
      if (fromWindow(event)) {
        packs.answer(id, answer);
      }
    },
  );

  ipcMain.handle(
    'studio-chat-video-frames',
    (event, id: unknown, answer: unknown) => {
      if (fromWindow(event)) {
        videos.answer(id, answer);
      }
    },
  );

  return {
    asks,
    /** A chat's Claude Code reported its servers at the start of a turn. */
    noteServers: (servers: TServersSeen) => {
      seen = servers;
    },
    /** How many times the member's servers were changed here (`serversChanged`). */
    serversChanged: () => serversChanged,
    /** Where the project's Claude Code reaches its tools. */
    address: (
      projectId: string,
      folder: string,
      at?: { port: number; key: string },
    ) => serverFor(projectId, folder, at).address(),
    /** The project's chat let go: its server stops listening. */
    close: async (projectId: string) => {
      const known = servers.get(projectId);
      servers.delete(projectId);
      await known?.server.close();
    },
    dispose: async () => {
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
      packs.dispose();
      videos.dispose();
      const closing = [...servers.values()].map(({ server }) => server.close());
      servers.clear();
      await Promise.all(closing);
    },
  };
};

export type TChatPictures = ReturnType<typeof createChatPictures>;
