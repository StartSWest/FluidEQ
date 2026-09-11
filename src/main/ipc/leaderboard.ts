import { BrowserWindow, ipcMain } from 'electron';
import type { IAccountConfig } from '../../common/accountConfig';
import { LISTENING_UPLOAD_INTERVAL_HOURS } from '../../common/leaderboardScore';
import type { IEntitlement } from '../account/entitlement';
import type { IAccountSession } from '../account/session';
import {
  createLeaderboardApi,
  LeaderboardError,
  type ILeaderboardRow,
  type IMyRank,
  type TLeaderboardFailure,
  type TLeaderboardPeriod,
} from '../usage/leaderboardApi';
import { createUsageLedger, type IUsageLedger } from '../usage/usageLedger';
import readComputerId from '../usage/computerId';
import { sampleBoard } from '../community/sampleCommunity';

/**
 * Listening minutes and the board, as the renderer sees them.
 *
 * The renderer reports seconds as it observes music playing; nothing leaves
 * this machine unless the person opted in, and then only whole minutes per
 * local day, with the date, for the last fortnight. Uploads happen on the
 * same "somebody is back at the machine" events the subscription check uses,
 * and never on a clock. The tally is
 * kept whether or not anyone opts in, so the Account panel can say "today: 2 h"
 * before asking; opting out stops the uploads, and "remove my data" deletes
 * every row of theirs on the server and the local tally with it.
 */

export interface ILeaderboardIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  userDataDir: string;
  config: IAccountConfig;
  session: IAccountSession;
  entitlement: IEntitlement;
  logger?: { info(message: string): void; warn(message: string): void };
  now?: () => number;
  fetchImpl?: typeof fetch;
  /**
   * DEVELOPMENT ONLY: rank a cast of sample people into the real board so
   * the podium and the rows can be looked at full. See `sampleCommunity.ts`.
   */
  sampleContent?: boolean;
}

export interface ILeaderboardStatus {
  optedIn: boolean;
  todayMinutes: number;
  /** Whether uploads can succeed right now: signed in and paying. */
  eligible: boolean;
}

export interface ILeaderboardBoard {
  period: TLeaderboardPeriod;
  rows: ILeaderboardRow[];
  me?: IMyRank;
}

export type TLeaderboardResult<T> =
  { ok: true; value: T } | { ok: false; failure: TLeaderboardFailure };

export const USAGE_UPLOAD_STALE_AFTER_MS =
  LISTENING_UPLOAD_INTERVAL_HOURS * 60 * 60 * 1000;

const CHANNELS = [
  'usage-accrue',
  'leaderboard-status',
  'leaderboard-opt-in',
  'leaderboard-board',
  'leaderboard-remove-me',
] as const;

/** Any single report over this is a clock that jumped, not listening. */
const MAX_REPORT_SECONDS = 15 * 60;

export const registerLeaderboardIpc = ({
  getMainWindow,
  userDataDir,
  config,
  session,
  entitlement,
  logger,
  now = Date.now,
  fetchImpl,
  sampleContent = false,
}: ILeaderboardIpcDeps) => {
  const ledger: IUsageLedger = createUsageLedger({ userDataDir, now });
  // Read the first time a day is sent, not at startup: somebody who never
  // joins the board never has the file made.
  let computerId: string | undefined;
  const api = createLeaderboardApi({
    config,
    accessToken: () => session.accessToken(),
    computerId: () => {
      computerId ??= readComputerId(userDataDir);
      return computerId;
    },
    fetchImpl,
  });
  let lastUploadAt = 0;
  let uploading: Promise<void> | undefined;

  const eligible = () =>
    session.state().status === 'signed-in' &&
    entitlement.status().state !== 'none';

  const status = (): ILeaderboardStatus => ({
    optedIn: ledger.optedIn(),
    todayMinutes: ledger.today().minutes,
    eligible: eligible(),
  });

  const announce = () => {
    getMainWindow()?.webContents.send('leaderboard-status-changed', status());
  };

  const guard =
    <T>(work: () => Promise<T>) =>
    async (): Promise<TLeaderboardResult<T>> => {
      try {
        return { ok: true, value: await work() };
      } catch (error) {
        return {
          ok: false,
          failure:
            error instanceof LeaderboardError ? error.failure : 'network',
        };
      }
    };

  const upload = async () => {
    if (!ledger.optedIn() || !eligible()) {
      return;
    }
    const pending = ledger.pending();
    if (pending.length === 0) {
      lastUploadAt = now();
      return;
    }
    try {
      await api.uploadDays(pending);
      pending.forEach((entry) => ledger.markUploaded(entry.day, entry.minutes));
      lastUploadAt = now();
      logger?.info(`Leaderboard: uploaded ${pending.length} day(s).`);
    } catch (error) {
      // Offline, or the subscription is not what the server thinks. Either
      // way the minutes stay pending and the next event tries again.
      logger?.warn(`Leaderboard upload did not go through: ${error}`);
      if (error instanceof LeaderboardError && error.failure !== 'network') {
        lastUploadAt = now();
      }
    }
  };

  const uploadNow = () => {
    uploading =
      uploading ??
      upload().finally(() => {
        uploading = undefined;
      });
    return uploading;
  };

  ipcMain.handle('usage-accrue', (_event, seconds: unknown) => {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
      return;
    }
    ledger.accrue(Math.min(MAX_REPORT_SECONDS, seconds));
  });

  ipcMain.handle('leaderboard-status', () => status());

  ipcMain.handle('leaderboard-opt-in', async (_event, value: unknown) => {
    ledger.setOptedIn(value === true);
    announce();
    if (value === true) {
      // Joining is the one moment "recent enough" does not apply.
      await uploadNow();
    }
    return status();
  });

  ipcMain.handle('leaderboard-board', (_event, period: unknown) =>
    guard(async (): Promise<ILeaderboardBoard> => {
      const wanted: TLeaderboardPeriod = period === 'month' ? 'month' : 'all';
      // Push what is pending first, so the board a person opens shows the
      // minutes they just listened.
      await uploadNow();
      const [rows, me] = await Promise.all([
        api.fetchBoard(wanted),
        api.fetchMyRank(wanted),
      ]);
      if (sampleContent) {
        return { period: wanted, ...sampleBoard(wanted, rows, me) };
      }
      return { period: wanted, rows, me };
    })(),
  );

  ipcMain.handle('leaderboard-remove-me', () =>
    guard(async () => {
      await api.deleteMine();
      ledger.clearDays();
      ledger.setOptedIn(false);
      announce();
    })(),
  );

  return {
    /** Announce an event; an upload follows only if the last one is stale. */
    uploadIfDue: async (reason: string) => {
      if (!ledger.optedIn() || !eligible()) {
        return;
      }
      if (now() - lastUploadAt < USAGE_UPLOAD_STALE_AFTER_MS) {
        return;
      }
      logger?.info(`Leaderboard: uploading after ${reason}.`);
      await uploadNow();
    },
    dispose: () => {
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
