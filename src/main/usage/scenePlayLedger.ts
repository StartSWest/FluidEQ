import fs from 'fs';
import path from 'path';
import { DAILY_LISTENING_CAP_HOURS } from '../../common/leaderboardScore';
import type { ISceneRef } from '../../common/sceneTaste';
import writeFileAtomically from '../atomicWrite';
import { KEEP_DAYS, localDayKey } from './usageLedger';

/**
 * How long each scene was drawn, per account, per day, on this computer —
 * and how much of it the server has already been told (premium migration
 * 0047). Plain JSON beside the listening ledger, for the same reason: a count
 * of seconds is not a secret, and a file a person can open and read is the
 * right shape for what the app sends about them.
 *
 * Kept per account so a computer shared by two members never sends one's
 * scenes as the other's, and for the fortnight the server still takes; a day
 * older than that has no reason to be kept. A day is capped where the server
 * caps it, sixteen hours per scene.
 */

const FILE_NAME = 'scene-plays.json';
const DAY_CAP_SECONDS = DAILY_LISTENING_CAP_HOURS * 60 * 60;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const SCENE_KEY =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?\/[a-z][a-z0-9-]{1,47}$/;

interface IScenePlayEntry {
  seconds: number;
  /** Whole seconds the server has already been sent. */
  uploaded: number;
}

/** account → day → `author/scene` (author empty for FluidEQ's own). */
type TLedger = Record<string, Record<string, Record<string, IScenePlayEntry>>>;

export interface IPendingScenePlays {
  day: string;
  plays: Array<ISceneRef & { seconds: number }>;
}

export interface IScenePlayLedger {
  accrue(accountId: string, scene: ISceneRef, seconds: number): void;
  /** Days with whole seconds the server has not been sent, oldest first. */
  pending(accountId: string): IPendingScenePlays[];
  markUploaded(accountId: string, sent: IPendingScenePlays): void;
}

const keyOf = (scene: ISceneRef) => `${scene.authorId ?? ''}/${scene.sceneId}`;

const sceneOfKey = (key: string): ISceneRef => {
  const split = key.indexOf('/');
  const authorId = key.slice(0, split);
  const sceneId = key.slice(split + 1);
  return authorId ? { authorId, sceneId } : { sceneId };
};

const isEntry = (value: unknown): value is IScenePlayEntry =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as IScenePlayEntry).seconds === 'number' &&
  Number.isFinite((value as IScenePlayEntry).seconds) &&
  typeof (value as IScenePlayEntry).uploaded === 'number' &&
  Number.isFinite((value as IScenePlayEntry).uploaded);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Whatever of the file still reads; the rest is dropped, never guessed. */
const readLedger = (filePath: string): TLedger => {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const ledger: TLedger = {};
    if (!isRecord(parsed)) {
      return ledger;
    }
    Object.entries(parsed).forEach(([account, days]) => {
      if (!isRecord(days)) {
        return;
      }
      Object.entries(days).forEach(([day, scenes]) => {
        if (!DAY_KEY.test(day) || !isRecord(scenes)) {
          return;
        }
        Object.entries(scenes).forEach(([key, entry]) => {
          if (SCENE_KEY.test(key) && isEntry(entry)) {
            ledger[account] ??= {};
            ledger[account][day] ??= {};
            ledger[account][day][key] = entry;
          }
        });
      });
    });
    return ledger;
  } catch {
    return {};
  }
};

export const createScenePlayLedger = ({
  userDataDir,
  now = Date.now,
}: {
  userDataDir: string;
  now?: () => number;
}): IScenePlayLedger => {
  const filePath = path.join(userDataDir, FILE_NAME);
  let ledger = readLedger(filePath);

  const cutoff = () => localDayKey(now() - KEEP_DAYS * 24 * 60 * 60 * 1000);

  const save = () => {
    const oldest = cutoff();
    const kept: TLedger = {};
    Object.entries(ledger).forEach(([account, days]) => {
      Object.entries(days).forEach(([day, scenes]) => {
        if (day >= oldest) {
          kept[account] ??= {};
          kept[account][day] = scenes;
        }
      });
    });
    ledger = kept;
    writeFileAtomically(filePath, JSON.stringify(ledger));
  };

  return {
    accrue: (accountId, scene, seconds) => {
      if (!Number.isFinite(seconds) || seconds <= 0) {
        return;
      }
      const day = localDayKey(now());
      const key = keyOf(scene);
      const days = ledger[accountId] ?? {};
      const scenes = days[day] ?? {};
      const entry = scenes[key] ?? { seconds: 0, uploaded: 0 };
      ledger = {
        ...ledger,
        [accountId]: {
          ...days,
          [day]: {
            ...scenes,
            [key]: {
              ...entry,
              seconds: Math.min(DAY_CAP_SECONDS, entry.seconds + seconds),
            },
          },
        },
      };
      save();
    },

    pending: (accountId) => {
      const oldest = cutoff();
      return Object.entries(ledger[accountId] ?? {})
        .filter(([day]) => day >= oldest)
        .map(([day, scenes]) => ({
          day,
          plays: Object.entries(scenes)
            .map(([key, entry]) => ({
              ...sceneOfKey(key),
              seconds: Math.floor(entry.seconds) - entry.uploaded,
            }))
            .filter((play) => play.seconds > 0),
        }))
        .filter((entry) => entry.plays.length > 0)
        .sort((a, b) => (a.day < b.day ? -1 : 1));
    },

    markUploaded: (accountId, sent) => {
      const scenes = ledger[accountId]?.[sent.day];
      if (!scenes) {
        return;
      }
      const next = { ...scenes };
      sent.plays.forEach((play) => {
        const key = keyOf(play);
        const entry = next[key];
        if (entry) {
          next[key] = { ...entry, uploaded: entry.uploaded + play.seconds };
        }
      });
      ledger = {
        ...ledger,
        [accountId]: { ...ledger[accountId], [sent.day]: next },
      };
      save();
    },
  };
};
