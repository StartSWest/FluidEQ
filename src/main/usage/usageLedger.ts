import fs from 'fs';
import path from 'path';
import writeFileAtomically from '../atomicWrite';

/**
 * How much music played, per day, on this machine.
 *
 * The renderer reports seconds as it observes them; this keeps the running
 * total for each local day, remembers how much of each day has been uploaded,
 * and forgets days older than two months. Plain JSON, not the OS cipher: a
 * count of minutes is not a secret, and a file a person can open and read is
 * the right shape for the one piece of data this app ever sends about them.
 *
 * The cap is sixteen hours a day. A machine left playing overnight is not
 * listening, and a board won by whoever forgot to press stop is not worth
 * having.
 */

export const DAILY_CAP_MINUTES = 16 * 60;
export const KEEP_DAYS = 60;

const FILE_NAME = 'usage-ledger.json';

export interface IUsageDay {
  seconds: number;
  /** Whole minutes the server has already been told about for this day. */
  uploadedMinutes: number;
}

export interface IUsageLedgerFile {
  optedIn: boolean;
  days: Record<string, IUsageDay>;
}

export interface IPendingDay {
  day: string;
  minutes: number;
}

export interface IUsageLedger {
  optedIn(): boolean;
  setOptedIn(value: boolean): void;
  /** Add observed seconds to today. */
  accrue(seconds: number): void;
  today(): IPendingDay;
  /** Days whose minutes have grown since they were last uploaded. */
  pending(): IPendingDay[];
  markUploaded(day: string, minutes: number): void;
  /** Forget every day, and the upload marks with them. */
  clearDays(): void;
}

export interface IUsageLedgerOptions {
  userDataDir: string;
  now?: () => number;
}

/** The local calendar day, as `YYYY-MM-DD`. The reader's day, not UTC's. */
export const localDayKey = (epochMs: number): string => {
  const date = new Date(epochMs);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export const minutesOf = (seconds: number): number =>
  Math.min(DAILY_CAP_MINUTES, Math.floor(Math.max(0, seconds) / 60));

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const isUsageDay = (value: unknown): value is IUsageDay =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as IUsageDay).seconds === 'number' &&
  Number.isFinite((value as IUsageDay).seconds) &&
  typeof (value as IUsageDay).uploadedMinutes === 'number' &&
  Number.isFinite((value as IUsageDay).uploadedMinutes);

const readFile = (filePath: string): IUsageLedgerFile => {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null) {
      return { optedIn: false, days: {} };
    }
    const candidate = parsed as Partial<IUsageLedgerFile>;
    const days: Record<string, IUsageDay> = {};
    if (typeof candidate.days === 'object' && candidate.days !== null) {
      Object.entries(candidate.days).forEach(([day, value]) => {
        if (DAY_KEY.test(day) && isUsageDay(value)) {
          days[day] = value;
        }
      });
    }
    return { optedIn: candidate.optedIn === true, days };
  } catch {
    return { optedIn: false, days: {} };
  }
};

export const createUsageLedger = ({
  userDataDir,
  now = Date.now,
}: IUsageLedgerOptions): IUsageLedger => {
  const filePath = path.join(userDataDir, FILE_NAME);
  let file = readFile(filePath);

  const save = () => writeFileAtomically(filePath, JSON.stringify(file));

  /** Drop days older than the window, measured from today's key. */
  const prune = () => {
    const cutoff = localDayKey(now() - KEEP_DAYS * 24 * 60 * 60 * 1000);
    const kept: Record<string, IUsageDay> = {};
    Object.entries(file.days).forEach(([day, value]) => {
      if (day >= cutoff) {
        kept[day] = value;
      }
    });
    file = { ...file, days: kept };
  };

  return {
    optedIn: () => file.optedIn,

    setOptedIn: (value) => {
      if (file.optedIn === value) {
        return;
      }
      file = { ...file, optedIn: value };
      save();
    },

    accrue: (seconds) => {
      if (!Number.isFinite(seconds) || seconds <= 0) {
        return;
      }
      const day = localDayKey(now());
      const current = file.days[day] ?? { seconds: 0, uploadedMinutes: 0 };
      // Capped in seconds too, so the file cannot grow a number nobody will
      // ever read past the sixteenth hour.
      const capped = Math.min(
        DAILY_CAP_MINUTES * 60,
        current.seconds + seconds,
      );
      file = {
        ...file,
        days: { ...file.days, [day]: { ...current, seconds: capped } },
      };
      prune();
      save();
    },

    today: () => {
      const day = localDayKey(now());
      return { day, minutes: minutesOf(file.days[day]?.seconds ?? 0) };
    },

    pending: () =>
      Object.entries(file.days)
        .map(([day, value]) => ({
          day,
          minutes: minutesOf(value.seconds),
          uploaded: value.uploadedMinutes,
        }))
        .filter((entry) => entry.minutes > entry.uploaded)
        .map(({ day, minutes }) => ({ day, minutes }))
        .sort((a, b) => (a.day < b.day ? -1 : 1)),

    markUploaded: (day, minutes) => {
      const current = file.days[day];
      if (!current || current.uploadedMinutes >= minutes) {
        return;
      }
      file = {
        ...file,
        days: { ...file.days, [day]: { ...current, uploadedMinutes: minutes } },
      };
      save();
    },

    clearDays: () => {
      file = { ...file, days: {} };
      save();
    },
  };
};
