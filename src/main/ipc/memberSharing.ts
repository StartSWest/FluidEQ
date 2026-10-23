import { dialog, ipcMain, type BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import mainText from '../mainText';
import type { IAccountConfig } from '../../common/accountConfig';
import {
  MEMBER_SCENE_FILE_EXTENSION,
  memberSceneFileName,
} from '../../common/memberSceneFile';
import { likedSceneOf } from '../../common/plusGallery';
import type { IScenePack } from '../../common/scenePacks';
import type { IAccountSession } from '../account/session';
import type { ISceneOwnership } from '../plus/sceneOwnership';
import writeFileAtomically from '../atomicWrite';
import type { TProjectRestore } from './memberScenes';
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
import {
  readAgreedTerms,
  writeAgreedTerms,
} from '../memberScenes/termsAgreement';

/**
 * Sharing members' scenes, over IPC: export, import, likes, and the block
 * list that decides which shared scenes may still open.
 *
 * Every call asks for Plus afresh. Export reads the Studio's open project again
 * and sends the server what is on disk, never a pack the page holds; import reads
 * the file the member picked in the system dialog, and nothing else. No
 * channel takes a path.
 */

export type TExportOutcome =
  | { ok: true; fileName: string }
  | {
      ok: false;
      reason: TExportFailure | 'no-build' | 'cancelled' | 'inspect-only';
    };

export type TImportOutcome =
  | {
      ok: true;
      names: IScenePack['names'];
      authorName: string | null;
      own: boolean;
      /** One's own scene was made a Studio project again, and opened. */
      restored: boolean;
    }
  | {
      ok: false;
      reason: 'signed-out' | 'cancelled' | 'blocked' | TReadFailure;
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
  /** Which scenes this account owns, which is who may like one (premium 0056). */
  ownership: Pick<ISceneOwnership, 'owns' | 'subscribe'>;
  store: IMemberSceneStore;
  /** The Studio's open project's folder, from its own registration. */
  activeFolder: () => string | undefined;
  /** Whether that project is a FluidEQ scene, opened only to look inside. */
  activeIsInspection: () => boolean;
  /** The member's own imported scene, made a Studio project again. */
  restoreOwnProject: (pack: IScenePack) => Promise<TProjectRestore>;
  /** Tell the renderer the list of member scenes changed. */
  announce: () => void;
  /** An export recorded an agreement to this version of the Plus terms. */
  onTermsAgreed?: (version: number) => void;
  logger?: { warn(message: string): void };
  dialogImpl?: IDialogLike;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export interface IMemberSharingRegistration {
  refreshIfDue(reason: string): Promise<void>;
  /**
   * Asks for the block list now. Anything about to bring a shared scene in
   * calls this first, so a scene blocked since the list was last asked cannot
   * slip in.
   */
  refreshBlocked(): Promise<void>;
  dispose(): void;
}

/**
 * How long the block list may go unasked-about while somebody is at the
 * machine.
 *
 * It used to be four hours, on the grounds that it went stale on the same
 * clock as the Plus looks' list. That was the wrong analogy and it is the only
 * reason this number is small now: the looks' list is a catalogue, and a day
 * late costs somebody a scene they have not heard of yet. This one is what a
 * scene is taken down WITH — the answer to a scene that flashes at people, or
 * that turned out to be something nobody would install knowingly — and until
 * it is asked for again, every machine that already has that scene keeps
 * playing it. Four hours of that is not a catalogue being late.
 *
 * Fifteen minutes costs nothing: nothing here is on a timer, so this is not a
 * fetch every fifteen minutes but a ceiling on how stale the answer may be
 * when somebody wakes the machine, unlocks the screen, or comes back to the
 * window (`comeBackSignals.ts`). A burst of those still collapses to one
 * fetch, and the reply is a list of fingerprints. A machine nobody is at
 * refreshes nothing either way, and is showing nobody anything.
 *
 * Bringing a shared scene in does not wait for this at all — that path asks
 * outright first (`refreshBlocked`), so a scene blocked a moment ago cannot
 * arrive.
 */
export const BLOCK_LIST_STALE_AFTER_MS = 15 * 60 * 1000;

const CHANNELS = [
  'studio-terms-agreed',
  'studio-export',
  'member-scenes-import',
  'member-scenes-like-status',
  'member-scenes-like',
] as const;

const BLOCKED_FILE = path.join('member-scenes', 'blocked.json');

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
  ownership,
  store,
  activeFolder,
  activeIsInspection,
  restoreOwnProject,
  announce,
  onTermsAgreed,
  logger,
  dialogImpl = dialog,
  fetchImpl = fetch,
  now = Date.now,
}: IMemberSharingIpcDeps): IMemberSharingRegistration => {
  const blockedPath = path.join(userDataDir, BLOCKED_FILE);
  let lastBlockRefresh = 0;

  // Offline keeps working: the last block list fetched is honoured until a
  // newer one arrives.
  store.setBlocked(readBlocked(blockedPath));

  const accountId = () => session.state().identity?.id;
  // The Studio, its export and an import are any account's (Ivan,
  // 2026-10-18); the block list is every signed-in account's, because the
  // computers holding a scene are no longer only paying ones (premium 0059).
  const signedIn = () => accountId() !== undefined;

  const token = async (): Promise<string | undefined> => {
    try {
      return await session.accessToken();
    } catch {
      return undefined;
    }
  };

  const refreshBlocked = async () => {
    if (!signedIn()) {
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
    typeof lookId === 'string' ? likedSceneOf(lookId) : undefined;

  // For whoever is signed in. An agreement another account made on this
  // computer says nothing about this one, and answering with it let a second
  // account share without ever being shown the terms.
  ipcMain.handle('studio-terms-agreed', () => {
    const me = accountId();
    return me ? readAgreedTerms(userDataDir, me) : 0;
  });

  ipcMain.handle(
    'studio-export',
    async (_event, termsVersion: unknown): Promise<TExportOutcome> => {
      if (!signedIn()) {
        return { ok: false, reason: 'signed-out' };
      }
      const folder = activeFolder();
      if (!folder || typeof termsVersion !== 'number') {
        return { ok: false, reason: 'no-build' };
      }
      if (activeIsInspection()) {
        return { ok: false, reason: 'inspect-only' };
      }
      const build = await readProject(folder);
      if (!build.ok) {
        return { ok: false, reason: 'no-build' };
      }
      // The account the server will record the agreement for is the one this
      // token belongs to, so the two are taken together.
      const me = accountId();
      const accessToken = await token();
      if (!accessToken || !me || accountId() !== me) {
        return { ok: false, reason: 'signed-out' };
      }

      // Where it goes is asked before it is signed: every signature counts
      // against the hourly allowance and leaves a row in the ledger, and a
      // member who closes the dialog has not exported anything.
      const window = getMainWindow();
      const options = {
        defaultPath: memberSceneFileName(build.pack),
        filters: [{ name: mainText('files.type.scene'), extensions: ['json'] }],
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
      // here, for this account, so its next export does not ask again.
      writeAgreedTerms(userDataDir, me, termsVersion);
      onTermsAgreed?.(termsVersion);

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
    if (!me) {
      return { ok: false, reason: 'signed-out' };
    }
    const window = getMainWindow();
    const options = {
      properties: ['openFile' as const],
      filters: [{ name: mainText('files.type.scene'), extensions: ['json'] }],
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
    const own = author.id === me;
    try {
      // Somebody moving their own work to a new computer gets it back as
      // their own: a look of theirs, and below, a project again.
      if (own) {
        store.save(me, pack);
      } else {
        store.saveImported(read.envelope);
      }
    } catch (error) {
      logger?.warn(`Importing a member scene failed: ${String(error)}`);
      return { ok: false, reason: 'changed' };
    }
    announce();
    // The Studio edits, publishes and exports only a project folder, so a
    // look alone could be played on the new computer and never changed or
    // shared again. The look is saved whatever happens here.
    let restored = false;
    if (own) {
      try {
        restored = (await restoreOwnProject(pack)) === 'restored';
      } catch (error) {
        logger?.warn(
          `Making a Studio project of an imported scene failed: ${String(error)}`,
        );
      }
    }
    return {
      ok: true,
      names: pack.names,
      authorName: author.name,
      own,
      restored,
    };
  });

  const likeStatus = async (
    lookId: unknown,
  ): Promise<ILikeStatus | undefined> => {
    const ref = refOf(lookId);
    const accessToken =
      typeof lookId === 'string' && ownership.owns(lookId)
        ? await token()
        : undefined;
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
      const accessToken =
        typeof lookId === 'string' && ownership.owns(lookId)
          ? await token()
          : undefined;
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

  // An account signing in, or a buy: either may be the first time this
  // computer is allowed the list.
  const unsubscribe = ownership.subscribe(() => {
    refreshBlocked().catch(() => undefined);
  });
  refreshBlocked().catch(() => undefined);

  return {
    refreshIfDue: async (_reason) => {
      if (now() - lastBlockRefresh >= BLOCK_LIST_STALE_AFTER_MS) {
        await refreshBlocked();
      }
    },
    refreshBlocked,
    dispose: () => {
      unsubscribe();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
