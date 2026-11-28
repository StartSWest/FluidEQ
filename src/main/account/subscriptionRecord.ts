/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { BILLING_MODE, type TBillingMode } from '../../common/billingMode';
import { isAccountId, parseMemberLookId } from '../../common/memberScenes';
import { isPremiumLookId } from '../../common/scenePacks';
import {
  parseLibraryPlans,
  type ILapsedScene,
  type ILapseOffer,
  type ILibraryPlan,
} from '../../common/subscription';
import type { IEncryptedJsonStore } from '../encryptedJsonStore';
import type {
  ISubscriptionWatch,
  ISubscriptionWatchStore,
} from './subscriptionAccount';

/**
 * What this computer remembers of Plus, per account, kept with the
 * credential cipher beside the account's other records
 * (`plus-subscription.json`):
 *
 * - `claimed`: the member scenes whose claim the server recorded
 *   (`claim_library_scene` answered `claimed`), never sent again: a
 *   subscriber's deliberate add earns its maker once.
 * - `downloads`: the scenes this computer added while the account had them
 *   only through Plus. When Plus ends, these are the downloads deleted, and
 *   nothing else: a scene got with a credit, or its own, is never on this
 *   list, and one got since is kept.
 * - `lapse`: the offer made when it last ended, until it is put away.
 * - `watch`: how its ending is watched (`subscriptionAccount.ts`): the end
 *   of the last period seen paid for, and when the server first said it
 *   ended after that, so a second answer a day later can confirm it.
 *
 * And once, for the whole computer, `plans`: the plans last heard on sale,
 * which the window offers before an account's own answer is read, signed
 * out included, so Get Plus can lead to sign-in. Kept per Stripe mode
 * (`plans` live, `testPlans` test; `common/billingMode.ts`), so a
 * development run never leaves test prices for a release that reads the
 * same file, nor a release live prices for `pnpm dev`.
 *
 * A record that cannot be read starts again. That fails open: the downloads
 * it listed are no longer known as Plus's, so they are kept when it ends,
 * never deleted on a guess. Read the first time the cipher can read it, as
 * the entitlement is: Windows reports the cipher missing before `ready`.
 */

export const SUBSCRIPTION_FILE = 'plus-subscription.json';

export interface ISubscriptionRecords extends ISubscriptionWatchStore {
  claimed(accountId: string, lookId: string): boolean;
  addClaim(accountId: string, lookId: string): void;
  /** The scenes added through Plus, oldest first. */
  downloads(accountId: string): string[];
  addDownload(accountId: string, lookId: string): void;
  dropDownloads(accountId: string, lookIds: readonly string[]): void;
  lapse(accountId: string): ILapseOffer | undefined;
  setLapse(accountId: string, offer: ILapseOffer | undefined): void;
  /** Hear about every change (an offer made or put away). Returns unsubscribe. */
  onChange(listener: () => void): () => void;
}

interface IAccountRecord {
  claimed: string[];
  downloads: string[];
  lapse?: ILapseOffer;
  watch?: ISubscriptionWatch;
}

export interface ISubscriptionRecordFile {
  version: 1;
  /** The live plans last heard on sale, by a release. */
  plans?: ILibraryPlan[];
  /** The test plans last heard on sale, by a development build. */
  testPlans?: ILibraryPlan[];
  accounts: Record<string, IAccountRecord>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The encrypted store's guard: the file's frame. Its rows are read one by one. */
export const isSubscriptionRecordFile = (
  value: unknown,
): value is ISubscriptionRecordFile =>
  isRecord(value) && value.version === 1 && isRecord(value.accounts);

/** A scene Plus can play: FluidEQ's own, or a member's. */
const isSceneLookId = (value: unknown): value is string =>
  typeof value === 'string' &&
  (isPremiumLookId(value) || parseMemberLookId(value) !== undefined);

const lookIds = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter(isSceneLookId))] : [];

const readLapsedScene = (value: unknown): ILapsedScene | undefined => {
  if (
    !isRecord(value) ||
    !isSceneLookId(value.lookId) ||
    !isRecord(value.names) ||
    typeof value.names.en !== 'string' ||
    !Object.values(value.names).every((name) => typeof name === 'string')
  ) {
    return undefined;
  }
  return {
    lookId: value.lookId,
    names: value.names as ILapsedScene['names'],
  };
};

const readLapse = (value: unknown): ILapseOffer | undefined => {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    value.id === '' ||
    typeof value.at !== 'string' ||
    !Number.isFinite(Date.parse(value.at)) ||
    !Array.isArray(value.scenes)
  ) {
    return undefined;
  }
  const scenes = value.scenes.flatMap((row: unknown) => {
    const scene = readLapsedScene(row);
    return scene ? [scene] : [];
  });
  return scenes.length > 0 ? { id: value.id, at: value.at, scenes } : undefined;
};

const finiteTime = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const readWatch = (value: unknown): ISubscriptionWatch | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const paidUntil = finiteTime(value.paidUntil);
  const absentSince = finiteTime(value.absentSince);
  const watch: ISubscriptionWatch = {
    ...(paidUntil !== undefined ? { paidUntil } : {}),
    ...(absentSince !== undefined ? { absentSince } : {}),
  };
  return Object.keys(watch).length > 0 ? watch : undefined;
};

const readAccounts = (value: unknown): Map<string, IAccountRecord> => {
  const accounts = new Map<string, IAccountRecord>();
  if (!isRecord(value)) {
    return accounts;
  }
  Object.entries(value).forEach(([id, raw]) => {
    if (!isAccountId(id) || !isRecord(raw)) {
      return;
    }
    const lapse = readLapse(raw.lapse);
    const watch = readWatch(raw.watch);
    accounts.set(id, {
      claimed: lookIds(raw.claimed),
      downloads: lookIds(raw.downloads),
      ...(lapse ? { lapse } : {}),
      ...(watch ? { watch } : {}),
    });
  });
  return accounts;
};

export const createSubscriptionRecords = ({
  store,
  logger,
}: {
  store: IEncryptedJsonStore<ISubscriptionRecordFile>;
  logger?: { warn(message: string): void };
}): ISubscriptionRecords => {
  let accounts = new Map<string, IAccountRecord>();
  /** Both modes' lists, so a save keeps the one this build does not read. */
  const plansOf: Record<TBillingMode, ILibraryPlan[]> = { live: [], test: [] };
  let loaded = false;
  const listeners = new Set<() => void>();

  const load = () => {
    if (loaded || !store.available()) {
      return;
    }
    loaded = true;
    const file = store.read();
    if (!file) {
      return;
    }
    accounts = readAccounts(file.accounts);
    plansOf.live = parseLibraryPlans(file.plans) ?? [];
    plansOf.test = parseLibraryPlans(file.testPlans) ?? [];
  };

  const save = () => {
    const out: ISubscriptionRecordFile = {
      version: 1,
      ...(plansOf.live.length > 0 ? { plans: plansOf.live } : {}),
      ...(plansOf.test.length > 0 ? { testPlans: plansOf.test } : {}),
      accounts: Object.fromEntries(accounts),
    };
    try {
      store.write(out);
    } catch (error) {
      // Kept for this run all the same.
      logger?.warn(`The Plus record could not be saved: ${String(error)}`);
    }
    [...listeners].forEach((listener) => {
      try {
        listener();
      } catch (error) {
        logger?.warn(`A Plus record listener failed: ${String(error)}`);
      }
    });
  };

  const existing = (accountId: string): IAccountRecord | undefined => {
    load();
    return accounts.get(accountId);
  };

  const recordOf = (accountId: string): IAccountRecord => {
    load();
    let record = accounts.get(accountId);
    if (!record) {
      record = { claimed: [], downloads: [] };
      accounts.set(accountId, record);
    }
    return record;
  };

  return {
    claimed: (accountId, lookId) =>
      existing(accountId)?.claimed.includes(lookId) ?? false,

    addClaim: (accountId, lookId) => {
      const record = recordOf(accountId);
      if (!record.claimed.includes(lookId)) {
        record.claimed.push(lookId);
        save();
      }
    },

    downloads: (accountId) => [...(existing(accountId)?.downloads ?? [])],

    addDownload: (accountId, lookId) => {
      if (!isSceneLookId(lookId)) {
        return;
      }
      const record = recordOf(accountId);
      if (!record.downloads.includes(lookId)) {
        record.downloads.push(lookId);
        save();
      }
    },

    dropDownloads: (accountId, dropped) => {
      const record = existing(accountId);
      if (!record) {
        return;
      }
      const left = record.downloads.filter(
        (lookId) => !dropped.includes(lookId),
      );
      if (left.length !== record.downloads.length) {
        record.downloads = left;
        save();
      }
    },

    lapse: (accountId) => existing(accountId)?.lapse,

    setLapse: (accountId, offer) => {
      const record = recordOf(accountId);
      if (offer) {
        record.lapse = offer;
      } else if (record.lapse) {
        delete record.lapse;
      } else {
        return;
      }
      save();
    },

    watch: (accountId) => {
      const watch = existing(accountId)?.watch;
      return watch ? { ...watch } : undefined;
    },

    setWatch: (accountId, watch) => {
      const record = recordOf(accountId);
      const next = readWatch(watch);
      if (next) {
        record.watch = next;
      } else if (record.watch) {
        delete record.watch;
      } else {
        return;
      }
      save();
    },

    hasDownloads: (accountId) =>
      (existing(accountId)?.downloads.length ?? 0) > 0,

    knownPlans: () => {
      load();
      return plansOf[BILLING_MODE].map((plan) => ({ ...plan }));
    },

    setKnownPlans: (next) => {
      load();
      const read = parseLibraryPlans(next) ?? [];
      if (JSON.stringify(read) !== JSON.stringify(plansOf[BILLING_MODE])) {
        plansOf[BILLING_MODE] = read;
        save();
      }
    },

    onChange: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
