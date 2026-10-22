import fs from 'fs';
import path from 'path';
import {
  LISTENING_DAY_CAP_MINUTES,
  LISTENING_WINDOW_DAYS,
} from '../../common/listening';
import writeFileAtomically from '../atomicWrite';
import { localDayKey } from './scenePlayLedger';

/**
 * How much music played, per account and day, on this computer, how much of
 * each day the server has been sent, and what each account last answered
 * (premium migration 0068).
 *
 * Plain JSON: a count of minutes is not a secret, and a file a person can
 * open and read is the right shape for what the app sends about them. Per
 * account, so a computer two people sign in on never sends one's evening as
 * the other's. Days older than the fortnight the server still takes are
 * dropped — a day that can no longer be sent has no reason to be kept.
 *
 * The answer is the server's (`listening_choices`); the copy here is so a
 * launch without a connection still counts for an account that said yes,
 * and counts nothing for one that said no or was never asked.
 *
 * Its own file, not the leaderboard's `usage-ledger.json`: that one's upload
 * marks are for days the server deleted in 0068, and reading them would mark
 * minutes as sent that never will be. `forgetListening` removes it.
 */

const FILE_NAME = 'listening-ledger.json';
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_CAP_SECONDS = LISTENING_DAY_CAP_MINUTES * 60;

interface IListeningEntry {
  seconds: number;
  /** Whole minutes the server has already been sent for this day. */
  uploaded: number;
}

interface IAccountLedger {
  /** The account's last known answer: true said yes, false switched it off. */
  sharing?: boolean;
  days: Record<string, IListeningEntry>;
}

type TLedger = Record<string, IAccountLedger>;

export interface IPendingListening {
  day: string;
  minutes: number;
}

export interface IListeningLedger {
  /** The account's last known answer, or undefined for none on record here. */
  sharing(accountId: string): boolean | undefined;
  /** What the server answered; undefined is "never asked". */
  setSharing(accountId: string, sharing: boolean | undefined): void;
  accrue(accountId: string, seconds: number): void;
  todayMinutes(accountId: string): number;
  /** Days whose whole minutes grew since they were last sent, oldest first. */
  pending(accountId: string): IPendingListening[];
  markUploaded(accountId: string, sent: IPendingListening): void;
  /** Every day of this account's, gone: the answer turned to no. */
  clearDays(accountId: string): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isEntry = (value: unknown): value is IListeningEntry =>
  isRecord(value) &&
  typeof value.seconds === 'number' &&
  Number.isFinite(value.seconds) &&
  value.seconds >= 0 &&
  typeof value.uploaded === 'number' &&
  Number.isFinite(value.uploaded) &&
  value.uploaded >= 0;

export const minutesOf = (seconds: number): number =>
  Math.min(LISTENING_DAY_CAP_MINUTES, Math.floor(Math.max(0, seconds) / 60));

/** Whatever of the file still reads; the rest is dropped, never guessed. */
const readLedger = (filePath: string): TLedger => {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const ledger: TLedger = {};
    if (!isRecord(parsed)) {
      return ledger;
    }
    Object.entries(parsed).forEach(([account, value]) => {
      if (!isRecord(value)) {
        return;
      }
      const days: Record<string, IListeningEntry> = {};
      if (isRecord(value.days)) {
        Object.entries(value.days).forEach(([day, entry]) => {
          if (DAY_KEY.test(day) && isEntry(entry)) {
            days[day] = entry;
          }
        });
      }
      ledger[account] =
        typeof value.sharing === 'boolean'
          ? { sharing: value.sharing, days }
          : { days };
    });
    return ledger;
  } catch {
    // Missing is the first run; unreadable starts again from nothing, which
    // costs at most the minutes not yet sent.
    return {};
  }
};

export const createListeningLedger = ({
  userDataDir,
  now = Date.now,
}: {
  userDataDir: string;
  now?: () => number;
}): IListeningLedger => {
  const filePath = path.join(userDataDir, FILE_NAME);
  let ledger = readLedger(filePath);

  const cutoff = () =>
    localDayKey(now() - LISTENING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const save = () => {
    const oldest = cutoff();
    const kept: TLedger = {};
    Object.entries(ledger).forEach(([account, entry]) => {
      const days = Object.fromEntries(
        Object.entries(entry.days).filter(([day]) => day >= oldest),
      );
      kept[account] = { ...entry, days };
    });
    ledger = kept;
    writeFileAtomically(filePath, JSON.stringify(ledger));
  };

  const accountOf = (accountId: string): IAccountLedger =>
    ledger[accountId] ?? { days: {} };

  return {
    sharing: (accountId) => ledger[accountId]?.sharing,

    setSharing: (accountId, sharing) => {
      const current = accountOf(accountId);
      if (current.sharing === sharing && ledger[accountId]) {
        return;
      }
      ledger = {
        ...ledger,
        [accountId]: {
          days: current.days,
          ...(sharing === undefined ? {} : { sharing }),
        },
      };
      save();
    },

    accrue: (accountId, seconds) => {
      if (!Number.isFinite(seconds) || seconds <= 0) {
        return;
      }
      const day = localDayKey(now());
      const current = accountOf(accountId);
      const entry = current.days[day] ?? { seconds: 0, uploaded: 0 };
      ledger = {
        ...ledger,
        [accountId]: {
          ...current,
          days: {
            ...current.days,
            // Capped in seconds too, so the file never grows a number
            // nobody will read past the sixteenth hour.
            [day]: {
              ...entry,
              seconds: Math.min(DAY_CAP_SECONDS, entry.seconds + seconds),
            },
          },
        },
      };
      save();
    },

    todayMinutes: (accountId) =>
      minutesOf(accountOf(accountId).days[localDayKey(now())]?.seconds ?? 0),

    // Days past the window stay out even before a write prunes them: a ledger
    // read back after a fortnight away holds days the server would drop.
    pending: (accountId) => {
      const oldest = cutoff();
      return Object.entries(accountOf(accountId).days)
        .filter(([day]) => day >= oldest)
        .map(([day, entry]) => ({
          day,
          minutes: minutesOf(entry.seconds),
          uploaded: entry.uploaded,
        }))
        .filter((entry) => entry.minutes > entry.uploaded)
        .map(({ day, minutes }) => ({ day, minutes }))
        .sort((a, b) => (a.day < b.day ? -1 : 1));
    },

    markUploaded: (accountId, sent) => {
      const current = ledger[accountId];
      const entry = current?.days[sent.day];
      if (!current || !entry || entry.uploaded >= sent.minutes) {
        return;
      }
      ledger = {
        ...ledger,
        [accountId]: {
          ...current,
          days: {
            ...current.days,
            [sent.day]: { ...entry, uploaded: sent.minutes },
          },
        },
      };
      save();
    },

    clearDays: (accountId) => {
      const current = ledger[accountId];
      if (!current) {
        return;
      }
      ledger = { ...ledger, [accountId]: { ...current, days: {} } };
      save();
    },
  };
};
