/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  accountEmailOf,
  claudePlanNameOf,
  STUDIO_CHAT_LIMIT_WINDOWS,
  studioChatLimitsKey,
  type IStudioChatLimit,
  type IStudioChatLimits,
  type IStudioChatLimitsAsk,
  type IStudioChatLimitsNews,
} from '../../common/studioChat';
import writeFileAtomically from '../atomicWrite';
import type { IPlanReading } from './chatUsageRead';

/**
 * No new reading within a minute of the last one for the same account
 * (Ivan, 2026-11-28: "each time I open that windows but no less than a
 * 1min"). Counted from when the last reading was asked for, compared when
 * the window asks: nothing here waits on a clock.
 */
export const PLAN_USAGE_EVERY_MS = 60 * 1000;

/** The accounts whose last reading is kept: a member switching between a few finds each one's at once. */
const MOST_ACCOUNTS = 8;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const count = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

/**
 * Which account a kept reading is, on disk: a hash of its key, never the
 * email itself, as the chat keeps no account anywhere (`claudeModels.ts`).
 */
const hashOf = (key: string) => createHash('sha256').update(key).digest('hex');

/** A reading as it was kept, without whose it is; nothing for any other shape. */
const readKeptReading = (raw: unknown): IStudioChatLimits | undefined => {
  if (!isRecord(raw) || count(raw.at) === 0) {
    return undefined;
  }
  const reading: IStudioChatLimits = { at: count(raw.at) };
  STUDIO_CHAT_LIMIT_WINDOWS.forEach((name) => {
    const limit = raw[name];
    if (!isRecord(limit)) {
      return;
    }
    const kept: IStudioChatLimit = {
      used: count(limit.used),
      resetsAt: count(limit.resetsAt),
    };
    if (kept.used <= 1 && kept.resetsAt > 0) {
      reading[name] = kept;
    }
  });
  // A plan's name passes the same test as when Claude Code gave it.
  const plan =
    typeof raw.plan === 'string'
      ? claudePlanNameOf(`Claude ${raw.plan}`)
      : undefined;
  return plan ? { ...reading, plan } : reading;
};

/**
 * Each account's last reading, as kept for the next start. A file from
 * before readings were kept per account holds one reading of nobody's
 * account: it is not read, and the first new reading replaces it.
 */
const readKept = (file: string): Map<string, IStudioChatLimits> => {
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!isRecord(raw) || !isRecord(raw.accounts)) {
      return new Map();
    }
    return new Map(
      Object.entries(raw.accounts).flatMap(
        ([hash, value]): [string, IStudioChatLimits][] => {
          const reading = readKeptReading(value);
          return /^[0-9a-f]{64}$/.test(hash) && reading
            ? [[hash, reading]]
            : [];
        },
      ),
    );
  } catch {
    return new Map();
  }
};

/** The window's ask, read as untrusted: an account that is not an email is nobody's. */
const readAsk = (raw: unknown): IStudioChatLimitsAsk => {
  if (!isRecord(raw)) {
    return {};
  }
  const account = accountEmailOf(raw.account);
  return {
    ...(account ? { account } : {}),
    ...(raw.fresh === true ? { fresh: true } : {}),
  };
};

interface IPlanUsageDeps {
  root: string;
  /** Starts a run of Claude Code for a reading; false when none was started. */
  read: () => boolean;
  /** The window is told. */
  send: (news: IStudioChatLimitsNews) => void;
  now?: () => number;
  logger?: { warn(message: string): void };
}

/**
 * The Claude plan's usage on the accounts card, each reading kept under the
 * account it is of.
 *
 * Cause of the card showing the other account's usage after a switch (Ivan,
 * 2026-11-28): the usage was asked of a chat's Claude Code that was already
 * running, which keeps the sign-in it started with, and the one reading was
 * kept for every account alike - so the previous account's figures stood
 * under the new account's name, with any window the new answer lacked
 * carried over from the old one.
 *
 * Now each reading is one run's answer to "which account" and "its usage"
 * together (`chatUsageRead.ts`), kept under that account, and the window is
 * given only the reading of the account it shows; a reading of another
 * account tells the window to ask who is signed in again
 * (`studioChatStore.ts`). The window asks each time the card opens or the
 * account it shows changes; a reading is asked of Claude Code when that
 * account has none from the last minute, and after each answer Claude
 * writes when nothing was read in the last minute. One run at a time: an
 * ask that is due while a run is out is asked again when it ends, unless
 * that run's reading was the asked account's.
 */
const createPlanUsage = ({
  root,
  read,
  send,
  now = Date.now,
  logger,
}: IPlanUsageDeps) => {
  const file = path.join(root, 'limits.json');
  let readings: Map<string, IStudioChatLimits> | undefined;
  /** When each account's reading was last asked for or last arrived. */
  const fetchedAt = new Map<string, number>();
  let lastStartedAt = Number.NEGATIVE_INFINITY;
  let checking = false;
  /** An account whose reading was due while a run was out, and since when. */
  let wanted: { key: string; since: number } | undefined;

  const kept = () => {
    readings ??= readKept(file);
    return readings;
  };

  /** A run for `key`, the account the window shows; none for one after an answer. */
  const start = (key: string | undefined) => {
    if (checking) {
      if (key !== undefined) {
        wanted = { key, since: now() };
      }
      return;
    }
    if (!read()) {
      return;
    }
    checking = true;
    lastStartedAt = now();
    if (key !== undefined) {
      fetchedAt.set(key, lastStartedAt);
    }
    send({ checking: true });
  };

  const save = () => {
    try {
      writeFileAtomically(
        file,
        JSON.stringify({ accounts: Object.fromEntries(kept()) }),
        0o600,
      );
    } catch (error) {
      // Shown all the same; only the copy for the next start is missing.
      logger?.warn(`The Studio chat's limits were not kept: ${String(error)}`);
    }
  };

  return {
    /** The window asks for the account it shows: that account's reading alone. */
    ask: (raw: unknown): IStudioChatLimitsNews => {
      const { account, fresh } = readAsk(raw);
      const key = studioChatLimitsKey(account);
      const last = fetchedAt.get(key);
      if (fresh || last === undefined || now() - last >= PLAN_USAGE_EVERY_MS) {
        start(key);
      }
      const reading = kept().get(hashOf(key));
      return {
        ...(reading
          ? { limits: account ? { ...reading, account } : reading }
          : {}),
        checking,
      };
    },

    /** Claude finished an answer, which spent some of the plan. */
    answered: () => {
      if (now() - lastStartedAt >= PLAN_USAGE_EVERY_MS) {
        start(undefined);
      }
    },

    /** A run's reading, under the account that run named. */
    reading: ({ windows, account, plan }: IPlanReading) => {
      const key = studioChatLimitsKey(account);
      const at = now();
      // The whole of what the account has now: a window the answer lacks is
      // one the account no longer has, never one carried from before.
      const reading: IStudioChatLimits = {
        ...windows,
        ...(plan ? { plan } : {}),
        at,
      };
      const all = kept();
      all.delete(hashOf(key));
      all.set(hashOf(key), reading);
      [...all.keys()]
        .slice(0, Math.max(0, all.size - MOST_ACCOUNTS))
        .forEach((oldest) => all.delete(oldest));
      fetchedAt.set(key, at);
      save();
      send({
        limits: account ? { ...reading, account } : reading,
        checking,
      });
    },

    /** The run is over, with a reading or without one. */
    ended: () => {
      checking = false;
      const again = wanted;
      wanted = undefined;
      if (
        again &&
        (fetchedAt.get(again.key) ?? Number.NEGATIVE_INFINITY) < again.since
      ) {
        start(again.key);
      }
      if (!checking) {
        send({ checking: false });
      }
    },
  };
};

export default createPlanUsage;
