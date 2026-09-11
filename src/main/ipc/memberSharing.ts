import { dialog, ipcMain, type BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import type { IAccountConfig } from '../../common/accountConfig';
import {
  MEMBER_SCENE_FILE_EXTENSION,
  memberSceneFileName,
} from '../../common/memberSceneFile';
import { parseMemberLookId } from '../../common/memberScenes';
import type { IScenePack } from '../../common/scenePacks';
import type { IEntitlement } from '../account/entitlement';
import type { IAccountSession } from '../account/session';
import writeFileAtomically from '../atomicWrite';
import { readProject } from '../memberScenes/project';
import {
  readMemberSceneFile,
  signMemberScene,
  type TExportFailure,
  type TReadFailure,
} from '../memberScenes/sharing';
import {
  fetchBlockedScenes,
  fetchLikeStatus,
  setLike,
  type ILikeStatus,
} from '../memberScenes/social';
import type { IMemberSceneStore } from '../memberScenes/store';

/**
 * Sharing members' scenes, over IPC: export, import, likes, and the block
 * list that decides which shared scenes may still open.
 *
 * Every call asks for Plus afresh. Export reads the linked folder again and
 * sends the server what is on disk, never a pack the page holds; import reads
 * the file the member picked in the system dialog, and nothing else. No
 * channel takes a path.
 */

export type TExportOutcome =
  | { ok: true; fileName: string }
  | { ok: false; reason: TExportFailure | 'no-build' | 'cancelled' };

export type TImportOutcome =
  | {
      ok: true;
      names: IScenePack['names'];
      authorName: string | null;
      own: boolean;
    }
  | {
      ok: false;
      reason: 'not-entitled' | 'cancelled' | 'blocked' | TReadFailure;
    };

interface IDialogLike {
  showOpenDialog: typeof dialog.showOpenDialog;
  showSaveDialog: typeof dialog.showSaveDialog;
}

export interface IMemberSharingIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  userDataDir: string;
  config: IAccountConfig;
  session: IAccountSession;
  entitlement: IEntitlement;
  store: IMemberSceneStore;
  /** The Studio's linked folder, from its own registration. */
  linkedFolder: () => string | undefined;
  /** Tell the renderer the list of member scenes changed. */
  announce: () => void;
  logger?: { warn(message: string): void };
  dialogImpl?: IDialogLike;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export interface IMemberSharingRegistration {
  refreshIfDue(reason: string): Promise<void>;
  dispose(): void;
}

/** The block list goes stale on the same clock as the Plus looks' list. */
export const BLOCK_LIST_STALE_AFTER_MS = 4 * 60 * 60 * 1000;

const CHANNELS = [
  'studio-terms-agreed',
  'studio-export',
  'member-scenes-import',
  'member-scenes-like-status',
  'member-scenes-like',
] as const;

const TERMS_FILE = path.join('member-scenes', 'terms.json');
const BLOCKED_FILE = path.join('member-scenes', 'blocked.json');

const readNumberFile = (file: string, field: string): number => {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    const value =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)[field]
        : undefined;
    return typeof value === 'number' && Number.isInteger(value) ? value : 0;
  } catch {
    return 0;
  }
};

const readBlocked = (file: string): string[] => {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string')
      : [];
  } catch {
    return [];
  }
};

export const registerMemberSharingIpc = ({
  getMainWindow,
  userDataDir,
  config,
  session,
  entitlement,
  store,
  linkedFolder,
  announce,
  logger,
  dialogImpl = dialog,
  fetchImpl = fetch,
  now = Date.now,
}: IMemberSharingIpcDeps): IMemberSharingRegistration => {
  const termsPath = path.join(userDataDir, TERMS_FILE);
  const blockedPath = path.join(userDataDir, BLOCKED_FILE);
  let lastBlockRefresh = 0;

  // Offline keeps working: the last block list fetched is honoured until a
  // newer one arrives.
  store.setBlocked(readBlocked(blockedPath));

  const accountId = () => session.state().identity?.id;
  const entitled = () =>
    entitlement.status().state !== 'none' && accountId() !== undefined;

  const token = async (): Promise<string | undefined> => {
    try {
      return await session.accessToken();
    } catch {
      return undefined;
    }
  };

  const refreshBlocked = async () => {
    if (!entitled()) {
      return;
    }
    const accessToken = await token();
    if (!accessToken) {
      return;
    }
    const fingerprints = await fetchBlockedScenes({
      config,
      accessToken,
      fetchImpl,
    });
    if (!fingerprints) {
      return;
    }
    lastBlockRefresh = now();
    store.setBlocked(fingerprints);
    writeFileAtomically(blockedPath, JSON.stringify(fingerprints));
    announce();
  };

  const refOf = (lookId: unknown) =>
    typeof lookId === 'string' ? parseMemberLookId(lookId) : undefined;

  ipcMain.handle('studio-terms-agreed', () =>
    readNumberFile(termsPath, 'agreed'),
  );

  ipcMain.handle(
    'studio-export',
    async (_event, termsVersion: unknown): Promise<TExportOutcome> => {
      if (!entitled()) {
        return { ok: false, reason: 'not-entitled' };
      }
      const folder = linkedFolder();
      if (!folder || typeof termsVersion !== 'number') {
        return { ok: false, reason: 'no-build' };
      }
      const build = await readProject(folder);
      if (!build.ok) {
        return { ok: false, reason: 'no-build' };
      }
      const accessToken = await token();
      if (!accessToken) {
        return { ok: false, reason: 'signed-out' };
      }

      // Where it goes is asked before it is signed: every signature counts
      // against the hourly allowance and leaves a row in the ledger, and a
      // member who closes the dialog has not exported anything.
      const window = getMainWindow();
      const options = {
        defaultPath: memberSceneFileName(build.pack),
        filters: [{ name: 'FluidEQ scene', extensions: ['json'] }],
      };
      const target = window
        ? await dialogImpl.showSaveDialog(window, options)
        : await dialogImpl.showSaveDialog(options);
      if (target.canceled || !target.filePath) {
        return { ok: false, reason: 'cancelled' };
      }

      const signed = await signMemberScene({
        config,
        accessToken,
        pack: build.pack,
        termsVersion,
        fetchImpl,
      });
      if (!signed.ok) {
        return signed;
      }
      // The server recorded the agreement with the signature; remember it
      // here so the next export does not ask again.
      writeFileAtomically(termsPath, JSON.stringify({ agreed: termsVersion }));

      const filePath = target.filePath.endsWith(MEMBER_SCENE_FILE_EXTENSION)
        ? target.filePath
        : `${target.filePath.replace(/\.json$/i, '')}${MEMBER_SCENE_FILE_EXTENSION}`;
      await fs.promises.writeFile(
        filePath,
        `${JSON.stringify(signed.envelope)}\n`,
        'utf8',
      );
      return { ok: true, fileName: path.basename(filePath) };
    },
  );

  ipcMain.handle('member-scenes-import', async (): Promise<TImportOutcome> => {
    const me = accountId();
    if (!entitled() || !me) {
      return { ok: false, reason: 'not-entitled' };
    }
    const window = getMainWindow();
    const options = {
      properties: ['openFile' as const],
      filters: [{ name: 'FluidEQ scene', extensions: ['json'] }],
    };
    const picked = window
      ? await dialogImpl.showOpenDialog(window, options)
      : await dialogImpl.showOpenDialog(options);
    const [filePath] = picked.filePaths;
    if (picked.canceled || !filePath) {
      return { ok: false, reason: 'cancelled' };
    }
    const read = await readMemberSceneFile(filePath);
    if (!read.ok) {
      return read;
    }
    // A scene blocked since the list was last asked must not slip in.
    await refreshBlocked();
    const { author, pack } = read.payload;
    if (store.isBlocked(author.id, pack.id)) {
      return { ok: false, reason: 'blocked' };
    }
    try {
      // Somebody moving their own work to a new computer gets it back as
      // their own: editable in the Studio and theirs to export again.
      if (author.id === me) {
        store.save(me, pack);
      } else {
        store.saveImported(read.envelope);
      }
    } catch (error) {
      logger?.warn(`Importing a member scene failed: ${String(error)}`);
      return { ok: false, reason: 'changed' };
    }
    announce();
    return {
      ok: true,
      names: pack.names,
      authorName: author.name,
      own: author.id === me,
    };
  });

  const likeStatus = async (
    lookId: unknown,
  ): Promise<ILikeStatus | undefined> => {
    const ref = refOf(lookId);
    const accessToken = entitled() ? await token() : undefined;
    if (!ref || !accessToken) {
      return undefined;
    }
    return fetchLikeStatus({
      config,
      accessToken,
      authorId: ref.authorId,
      sceneId: ref.packId,
      fetchImpl,
    });
  };

  ipcMain.handle('member-scenes-like-status', (_event, lookId: unknown) =>
    likeStatus(lookId),
  );

  ipcMain.handle(
    'member-scenes-like',
    async (_event, lookId: unknown, liked: unknown) => {
      const ref = refOf(lookId);
      const accessToken = entitled() ? await token() : undefined;
      if (
        !ref ||
        !accessToken ||
        typeof liked !== 'boolean' ||
        ref.authorId === accountId()
      ) {
        return undefined;
      }
      await setLike({
        config,
        accessToken,
        authorId: ref.authorId,
        sceneId: ref.packId,
        liked,
        fetchImpl,
      });
      return likeStatus(lookId);
    },
  );

  const unsubscribe = entitlement.subscribe(() => {
    refreshBlocked().catch(() => undefined);
  });
  refreshBlocked().catch(() => undefined);

  return {
    refreshIfDue: async (_reason) => {
      if (now() - lastBlockRefresh >= BLOCK_LIST_STALE_AFTER_MS) {
        await refreshBlocked();
      }
    },
    dispose: () => {
      unsubscribe();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
