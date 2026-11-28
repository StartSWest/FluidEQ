/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAccountConfig } from '../../common/accountConfig';
import {
  createEntitlement,
  type IEntitlement,
  type IEntitlementRecord,
} from '../../main/account/entitlement';
import type {
  IAccountSession,
  IAccountState,
} from '../../main/account/session';
import {
  createSubscriptionAccount,
  type ISubscriptionAccount,
} from '../../main/account/subscriptionAccount';
import { createSubscriptionLapse } from '../../main/account/subscriptionLapse';
import {
  createSubscriptionRecords,
  type ISubscriptionRecordFile,
  type ISubscriptionRecords,
} from '../../main/account/subscriptionRecord';
import type { IEncryptedJsonStore } from '../../main/encryptedJsonStore';
import type { IAccountPush } from '../../main/plus/accountPush';
import {
  createSceneOwnership,
  type ISceneOwnership,
  type ISceneStoreRecord,
} from '../../main/plus/sceneOwnership';

// Plus's server as built (premium 0122, the client contract): the
// entitlements row the play rule reads, `my_store` with its `library` and
// `libraryPlans`, and the two Stripe functions. Only the network, the
// session and the disk are fake; the entitlement, the store and Plus's own
// modules are the real ones, and the clock is the test's.

export const CONFIG: IAccountConfig = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: `sb_publishable_${'a'.repeat(40)}`,
  apiUrl: 'https://project.supabase.co/functions/v1',
};

export const ACCOUNT_ID = '7d9c2a4e-1b3f-4c5d-8e6f-0a1b2c3d4e5f';
export const OTHER_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
export const AUTHOR = '9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f';
export const NOW = Date.parse('2026-11-27T12:00:00.000Z');
export const DAY = 24 * 60 * 60 * 1000;
export const HOUR = 60 * 60 * 1000;

export const GLOW = `member:${AUTHOR}:glow`;
export const DUNE = 'premium:dune';

export const PLANS = [
  { id: 'monthly', interval: 'month', priceCents: 799, currency: 'USD' },
  { id: 'yearly', interval: 'year', priceCents: 5999, currency: 'USD' },
];

export const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export interface IRow {
  status: string;
  current_period_end: string;
  plan: string;
  cancel_at_period_end: boolean;
}

/** A paid Plus row, renewing unless `cancel`, its period ending at `end`. */
export const liveRow = (end = NOW + 30 * DAY, cancel = false): IRow => ({
  status: 'active',
  current_period_end: new Date(end).toISOString(),
  plan: 'library-monthly',
  cancel_at_period_end: cancel,
});

/** `my_store`'s `library` for Plus paid until `end`. */
export const library = (
  end = NOW + 30 * DAY,
  { renewing = true, plan = 'monthly' } = {},
) => ({ until: new Date(end).toISOString(), renewing, plan });

/** What one of the two Stripe functions answers: a page, or a refusal. */
export interface IFunctionAnswer {
  status: number;
  body: unknown;
}

/**
 * The backend, as a server from before 0122 (`aware: false`: neither field)
 * or from 0122 on.
 */
export const fakeBackend = () => {
  const state = {
    aware: false,
    row: undefined as IRow | undefined,
    /** What `my_store` says of Plus (0122 on). */
    library: undefined as Record<string, unknown> | undefined,
    plans: PLANS as unknown[],
    /** Member scenes got with a credit, as `my_store` lists them. */
    owned: [] as { authorId: string; sceneId: string }[],
    helpers: [] as string[],
    suspended: false,
    storeDown: false,
    entitlementsDown: false,
    offline: false,
    checkout: {
      status: 200,
      body: { url: 'https://checkout.stripe.com/c/pay/cs_test_1' },
    } as IFunctionAnswer,
    portal: {
      status: 200,
      body: { url: 'https://billing.stripe.com/p/session/test_1' },
    } as IFunctionAnswer,
    claim: {
      status: 200,
      body: { claimed: true, earned: true },
    } as IFunctionAnswer,
  };
  const calls: string[] = [];
  const bodies: { call: string; body: Record<string, unknown> | undefined }[] =
    [];
  const fetchImpl = jest.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(
        typeof input === 'string' || input instanceof URL ? input : input.url,
      );
      const call = `${init?.method ?? 'GET'} ${url.pathname}`;
      calls.push(call);
      const body =
        typeof init?.body === 'string'
          ? (JSON.parse(init.body) as Record<string, unknown>)
          : undefined;
      bodies.push({ call, body });
      if (state.offline) {
        throw new TypeError('fetch failed');
      }
      switch (call) {
        case 'GET /rest/v1/entitlements':
          if (state.entitlementsDown) {
            return json({ message: 'down' }, 503);
          }
          return json(state.row ? [state.row] : []);
        case 'POST /rest/v1/rpc/my_store':
          if (state.storeDown) {
            return json({ message: 'unavailable' }, 503);
          }
          return json({
            balance: 1,
            starterClaimed: true,
            owned: state.owned,
            packs: [],
            ...(state.helpers.length > 0
              ? { fluideqHelpers: state.helpers }
              : {}),
            ...(state.suspended
              ? {
                  suspension: {
                    deletesAt: '2026-12-05T00:00:00Z',
                    windowFrom: '2026-11-05T00:00:00Z',
                    windowTo: '2026-11-20T00:00:00Z',
                    refundCents: 0,
                    maker: false,
                  },
                }
              : {}),
            ...(state.aware
              ? {
                  libraryPlans: state.suspended ? [] : state.plans,
                  ...(state.library && !state.suspended
                    ? { library: state.library }
                    : {}),
                }
              : {}),
          });
        case 'POST /functions/v1/create-subscription-checkout':
          return json(state.checkout.body, state.checkout.status);
        case 'POST /functions/v1/create-billing-portal':
          return json(state.portal.body, state.portal.status);
        case 'POST /rest/v1/rpc/claim_library_scene':
          return json(state.claim.body, state.claim.status);
        default:
          return new Response('not found', { status: 404 });
      }
    },
  );
  return {
    state,
    calls,
    bodies,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    count: (call: string) => calls.filter((each) => each === call).length,
  };
};

export type TFakeBackend = ReturnType<typeof fakeBackend>;

/** What survives a restart: the files the three records are kept in. */
export interface IDisk {
  entitlement?: IEntitlementRecord;
  store?: ISceneStoreRecord;
  plus?: ISubscriptionRecordFile;
}

/** An encrypted store over one slot of the fake disk, copied in and out. */
export const diskStore = <K extends keyof IDisk>(
  disk: IDisk,
  key: K,
): IEncryptedJsonStore<NonNullable<IDisk[K]>> => ({
  available: () => true,
  read: () =>
    disk[key] === undefined
      ? undefined
      : (JSON.parse(JSON.stringify(disk[key])) as NonNullable<IDisk[K]>),
  write: (value) => {
    disk[key] = JSON.parse(JSON.stringify(value)) as IDisk[K];
  },
  clear: () => {
    delete disk[key];
  },
});

/** Every line the modules logged, for a test that reads the log. */
export const memoryLogger = () => {
  const lines: string[] = [];
  return {
    lines,
    logger: {
      info: (message: string) => {
        lines.push(`info: ${message}`);
      },
      warn: (message: string) => {
        lines.push(`warn: ${message}`);
      },
    },
  };
};

export interface IPlusApp {
  entitlement: IEntitlement;
  ownership: ISceneOwnership;
  records: ISubscriptionRecords;
  account: ISubscriptionAccount;
  /** What the lapse deleted, one list per deletion. */
  removed: string[][];
  /** The pushes asked to listen, in order. */
  pushes: { watching: boolean }[];
  lines: string[];
  signIn(id?: string): Promise<void>;
  signOut(): void;
  /** The launch's reads, as the app makes them. */
  launch(): Promise<void>;
  /** A come-back: the row if due, and `my_store` read again. */
  comeBack(): Promise<void>;
  /** Every read answered, and an ending acted on if it is one. */
  idle(): Promise<void>;
  stop(): void;
}

/**
 * One start of the app over `disk`: a new one over the same disk is the app
 * started again, the session gone (sign in again) and the records kept.
 */
export const startPlus = ({
  backend,
  disk,
  clock,
  signedInAs,
}: {
  backend: TFakeBackend;
  disk: IDisk;
  clock: { now: number };
  /** Already signed in when the app starts, as a session kept on disk is. */
  signedInAs?: string;
}): IPlusApp => {
  const { lines, logger } = memoryLogger();
  let state: IAccountState = signedInAs
    ? { status: 'signed-in', identity: { id: signedInAs, email: 'a@b.c' } }
    : { status: 'signed-out' };
  const identityListeners = new Set<() => void>();
  const onIdentityChange = (listener: () => void) => {
    identityListeners.add(listener);
    return () => {
      identityListeners.delete(listener);
    };
  };
  const session = {
    state: () => state,
    accessToken: async () => {
      const id = state.identity?.id;
      if (!id) {
        throw new Error('signed out');
      }
      return `access-${id}`;
    },
  } as unknown as IAccountSession;
  const now = () => clock.now;
  const entitlement = createEntitlement({
    config: CONFIG,
    session,
    store: diskStore(disk, 'entitlement'),
    onChange: () => undefined,
    logger,
    now,
    fetchImpl: backend.fetchImpl,
  });
  const ownership = createSceneOwnership({
    config: CONFIG,
    session,
    entitlement,
    onIdentityChange,
    store: diskStore(disk, 'store'),
    logger,
    now,
    fetchImpl: backend.fetchImpl,
  });
  const records = createSubscriptionRecords({
    store: diskStore(disk, 'plus'),
    logger,
  });
  const pushes: { watching: boolean }[] = [];
  const account = createSubscriptionAccount({
    entitlement,
    ownership,
    watch: records,
    accountId: () => state.identity?.id,
    onIdentityChange,
    createPush: (): IAccountPush => {
      const push = { watching: false };
      pushes.push(push);
      return {
        watch: () => {
          push.watching = true;
        },
        stop: () => {
          push.watching = false;
        },
      };
    },
    now,
    logger,
  });
  const removed: string[][] = [];
  const lapse = createSubscriptionLapse({
    accountId: () => state.identity?.id,
    ownership,
    subscription: account,
    remove: (lookIds) => {
      removed.push([...lookIds]);
      return lookIds.map((lookId) => ({ lookId, names: { en: lookId } }));
    },
    records,
    now,
    logger,
  });
  const idle = async () => {
    await account.settled();
    await lapse.check();
    await account.settled();
    await lapse.check();
  };
  const changeIdentity = (next: IAccountState) => {
    const before = state.identity?.id;
    state = next;
    if (next.status === 'signed-out') {
      entitlement.forget();
    }
    if (next.identity?.id !== before) {
      identityListeners.forEach((listener) => listener());
    }
  };
  return {
    entitlement,
    ownership,
    records,
    account,
    removed,
    pushes,
    lines,
    signIn: async (id = ACCOUNT_ID) => {
      changeIdentity({
        status: 'signed-in',
        identity: { id, email: 'a@b.c' },
      });
      await entitlement.checkNow();
      await ownership.refreshNow();
      await idle();
    },
    signOut: () => changeIdentity({ status: 'signed-out' }),
    launch: async () => {
      await entitlement.checkIfDue('launch');
      await ownership.refreshIfDue('launch');
      await idle();
    },
    comeBack: async () => {
      await entitlement.checkIfDue('a come-back');
      await ownership.refreshNow();
      await idle();
    },
    idle,
    stop: () => {
      lapse.dispose();
      account.dispose();
      ownership.dispose();
    },
  };
};
