import { ipcMain } from 'electron';
import { isAudioEngine, type TAudioEngine } from '../../common/audioEngine';
import { SCENE_TASTE_TERMS, sceneRefOfLook } from '../../common/sceneTaste';
import type { IGalleryAccess } from '../plus/galleryAccess';
import { rpc } from '../plus/galleryApi';
import { createScenePlayLedger } from '../usage/scenePlayLedger';

/**
 * What the app tells the server about the scenes a member watches and the
 * engine they run (premium migrations 0047 and 0049), and only once the
 * member has been shown the terms that say so (revision 10).
 *
 * The window reports seconds a scene was drawn as it observes them; this
 * keeps them per account and day on disk and sends what is new on the same
 * events as everything else about the account — launch, somebody coming back
 * to the computer — and, while somebody is watching, at most once an hour as
 * the seconds arrive. The engine goes with it whenever it differs from what
 * was last sent for this account.
 *
 * Nothing is counted for an account that has not been told: seconds kept
 * before the terms were shown would be sent the moment they were, about a
 * time they did not cover.
 */

/** The longest a single report from the window may claim. */
const MAX_REPORT_SECONDS = 120;
/** While seconds arrive, how stale the last send may get before the next. */
const SEND_AFTER_MS = 60 * 60 * 1000;

const CHANNELS = ['scene-play-accrue'] as const;

export interface ISceneTasteDeps {
  userDataDir: string;
  access: IGalleryAccess;
  /** Whether this account has been shown, or agreed to, terms `version`. */
  toldOf: (version: number) => boolean;
  getEngine: () => TAudioEngine | null;
  logger?: { info(message: string): void; warn(message: string): void };
  now?: () => number;
}

export const registerSceneTasteIpc = ({
  userDataDir,
  access,
  toldOf,
  getEngine,
  logger,
  now = Date.now,
}: ISceneTasteDeps) => {
  const ledger = createScenePlayLedger({ userDataDir, now });
  let lastSentAt = 0;
  let sentEngine: { accountId: string; engine: TAudioEngine } | undefined;
  let sending: Promise<void> | undefined;

  const told = () =>
    access.accountId() !== undefined &&
    access.entitled() &&
    toldOf(SCENE_TASTE_TERMS);

  const sendEngine = async (accountId: string) => {
    const engine = getEngine();
    if (
      !isAudioEngine(engine) ||
      (sentEngine?.accountId === accountId && sentEngine.engine === engine)
    ) {
      return;
    }
    const auth = await access.auth();
    if (!auth || access.accountId() !== accountId) {
      return;
    }
    const response = await rpc(auth, 'report_audio_engine', {
      p_engine: engine,
    });
    if (response.ok) {
      sentEngine = { accountId, engine };
    } else if (response.status !== 404) {
      // 404 is a server before 0049, which has nowhere to keep it.
      logger?.warn(`Engine report refused: ${response.status}.`);
    }
  };

  const sendPlays = async (accountId: string) => {
    const pending = ledger.pending(accountId);
    if (pending.length === 0) {
      return;
    }
    const auth = await access.auth();
    if (!auth || access.accountId() !== accountId) {
      return;
    }
    // A day at a time and in order, each marked as soon as it lands, so a
    // failure part way loses nothing and sends nothing twice.
    const sent = await pending.reduce<Promise<number>>(async (before, day) => {
      const count = await before;
      if (count < 0) {
        return count;
      }
      const response = await rpc(auth, 'record_scene_plays', {
        p_day: day.day,
        p_plays: day.plays.map((play) => ({
          author: play.authorId ?? null,
          scene: play.sceneId,
          seconds: play.seconds,
        })),
      });
      if (!response.ok) {
        // 404 is a server before 0047, which has nowhere to keep them.
        if (response.status !== 404) {
          logger?.warn(
            `Scene plays for ${day.day} refused: ${response.status}.`,
          );
        }
        return -1;
      }
      ledger.markUploaded(accountId, day);
      return count + 1;
    }, Promise.resolve(0));
    if (sent > 0) {
      logger?.info(`Scene plays: sent ${sent} day(s).`);
    }
  };

  const send = async (reason: string) => {
    const accountId = access.accountId();
    if (!accountId || !told()) {
      return;
    }
    try {
      await sendEngine(accountId);
      await sendPlays(accountId);
      lastSentAt = now();
    } catch (error) {
      // Offline. Everything stays pending and the next event tries again.
      logger?.warn(`Scene taste not sent after ${reason}: ${String(error)}`);
    }
  };

  const uploadIfDue = (reason: string) => {
    sending =
      sending ??
      send(reason).finally(() => {
        sending = undefined;
      });
    return sending;
  };

  ipcMain.handle(
    'scene-play-accrue',
    (_event, lookId: unknown, seconds: unknown) => {
      const accountId = access.accountId();
      const scene =
        typeof lookId === 'string' ? sceneRefOfLook(lookId) : undefined;
      if (
        !accountId ||
        !scene ||
        typeof seconds !== 'number' ||
        !Number.isFinite(seconds) ||
        seconds <= 0 ||
        !told()
      ) {
        return;
      }
      ledger.accrue(accountId, scene, Math.min(MAX_REPORT_SECONDS, seconds));
      if (now() - lastSentAt >= SEND_AFTER_MS) {
        uploadIfDue('a scene playing').catch(() => undefined);
      }
    },
  );

  return {
    uploadIfDue,
    dispose: () => {
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
