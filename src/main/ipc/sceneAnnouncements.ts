import fs from 'fs';
import path from 'path';
import { app, ipcMain, type BrowserWindow } from 'electron';
import {
  nextAnnouncement,
  parseAnnouncements,
  type IAnnouncement,
} from '../../common/sceneAnnouncements';
import writeFileAtomically from '../atomicWrite';
import type { IGalleryAccess } from '../plus/galleryAccess';
import { rpc } from '../plus/galleryApi';
import { registerAppNewsIpc } from './appNews';

/**
 * The big card that announces new scenes (premium migration 0050), over IPC.
 *
 * Asked for on the same events as everything else about the account —
 * launch, the account or membership changing, somebody coming back to the
 * computer — and only ever the newest one this account has not been shown on
 * this computer. Which ones were shown is kept here, per account, and never
 * sent: the server is told nothing about who saw what.
 */

export type TSceneAnnouncementState = IAnnouncement | null;

const FILE_NAME = 'scene-announcements-seen.json';
/** Ids remembered per account; older ones are long past the server's reach. */
const KEEP_SEEN = 100;

const CHANNELS = ['scene-announcement', 'scene-announcement-seen'] as const;

type TSeen = Record<string, number[]>;

const readSeen = (filePath: string): TSeen => {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }
    const seen: TSeen = {};
    Object.entries(parsed).forEach(([account, ids]) => {
      if (Array.isArray(ids)) {
        seen[account] = ids.filter(
          (id): id is number => typeof id === 'number' && Number.isInteger(id),
        );
      }
    });
    return seen;
  } catch {
    return {};
  }
};

export const registerSceneAnnouncementsIpc = ({
  getMainWindow,
  userDataDir,
  access,
  onAccountChange,
  logger,
}: {
  getMainWindow: () => BrowserWindow | null;
  userDataDir: string;
  access: IGalleryAccess;
  onAccountChange: (listener: () => void) => () => void;
  logger?: { warn(message: string): void };
}) => {
  const news = registerAppNewsIpc({
    getMainWindow,
    userDataDir,
    access,
    logger,
  });
  const filePath = path.join(userDataDir, FILE_NAME);
  let seen = readSeen(filePath);
  let listed: { accountId: string; announcements: IAnnouncement[] } | undefined;
  let asking: Promise<void> | undefined;
  let sent = JSON.stringify(null);

  const state = (): TSceneAnnouncementState => {
    const accountId = access.accountId();
    if (!accountId || listed?.accountId !== accountId) {
      return null;
    }
    return (
      nextAnnouncement(listed.announcements, new Set(seen[accountId] ?? [])) ??
      null
    );
  };

  const announce = () => {
    const current = state();
    const serialised = JSON.stringify(current);
    if (serialised === sent) {
      return;
    }
    sent = serialised;
    getMainWindow()?.webContents.send('scene-announcement-changed', current);
  };

  const ask = async (reason: string) => {
    const accountId = access.accountId();
    const auth = accountId ? await access.auth() : undefined;
    if (!accountId || !auth) {
      listed = undefined;
      return;
    }
    try {
      const response = await rpc(auth, 'current_announcements', {});
      // 404 is a server before 0050: nothing to announce, nothing wrong.
      if (!response.ok) {
        if (response.status !== 404) {
          logger?.warn(
            `Scene announcements not read after ${reason}: ${response.status}.`,
          );
        }
        return;
      }
      const announcements = parseAnnouncements(await response.json());
      if (access.accountId() === accountId) {
        listed = { accountId, announcements };
      }
    } catch (error) {
      logger?.warn(
        `Scene announcements not read after ${reason}: ${String(error)}`,
      );
    }
  };

  const refreshIfDue = async (reason: string) => {
    // News has its own delivery channel; an unavailable feed cannot hold up scenes.
    news.refresh().catch(() => undefined);
    asking =
      asking ??
      ask(reason).finally(() => {
        asking = undefined;
      });
    await asking;
    announce();
  };

  ipcMain.handle('scene-announcement', () => state());

  ipcMain.handle('scene-announcement-seen', (_event, id: unknown) => {
    const accountId = access.accountId();
    if (accountId && typeof id === 'number' && Number.isInteger(id)) {
      // Every one that went out before it is put away with it: two unseen
      // after a fortnight away would otherwise be two cards, one after the
      // other, the older one arriving the moment the newer was closed.
      const shown = listed?.announcements.find((entry) => entry.id === id);
      const older =
        listed && shown
          ? listed.announcements
              .filter((entry) => entry.startsAt <= shown.startsAt)
              .map((entry) => entry.id)
          : [id];
      const ids = [
        ...(seen[accountId] ?? []).filter((old) => !older.includes(old)),
        ...older,
      ];
      seen = { ...seen, [accountId]: ids.slice(-KEEP_SEEN) };
      try {
        writeFileAtomically(filePath, JSON.stringify(seen));
      } catch (error) {
        // Kept for this session regardless: a card put away must stay away.
        logger?.warn(
          `A seen announcement was not remembered: ${String(error)}`,
        );
      }
    }
    announce();
    return state();
  });

  const unsubscribe = onAccountChange(() => {
    refreshIfDue('account changed').catch(() => undefined);
  });
  // `ready`, for the reason `ipc/account.ts` gives: before it the stored
  // session cannot be read.
  app
    .whenReady()
    .then(() => refreshIfDue('launch'))
    .catch(() => undefined);

  return {
    refreshIfDue,
    dispose: () => {
      news.dispose();
      unsubscribe();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
