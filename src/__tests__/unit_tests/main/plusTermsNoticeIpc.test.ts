/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

const handlers = new Map<string, (...args: unknown[]) => unknown>();
let mockReady: Promise<void> = Promise.resolve();
jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
  app: { whenReady: () => mockReady },
}));

/* eslint-disable import/first -- the electron mock must be installed first */
import type { IAccountConfig } from '../../../common/accountConfig';
import { PLUS_TERMS_VERSION } from '../../../common/plusTerms';
import type { IEntitlementStatus } from '../../../main/account/entitlement';
import { readTermsNoticeSeen } from '../../../main/account/termsNoticeSeen';
import {
  registerPlusTermsNoticeIpc,
  type IPlusTermsNoticeRegistration,
  type TPlusTermsNoticeState,
} from '../../../main/ipc/plusTermsNotice';
import { fakeResponse } from '../../utils/memberSceneFixtures';
/* eslint-enable import/first */

const config: IAccountConfig = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'sb_publishable_test',
  apiUrl: 'https://project.supabase.co/functions/v1',
  plusPrice: '$5',
  plusYearlyPrice: '',
};

const ACTIVE: IEntitlementStatus = { state: 'active', plan: 'plus' };
const NONE: IEntitlementStatus = { state: 'none' };
const OLDER = PLUS_TERMS_VERSION - 1;
const NOTICE = { version: PLUS_TERMS_VERSION, changes: [PLUS_TERMS_VERSION] };

/** Something to wait on that says it happened, rather than a guess at when. */
const deferred = <T>() => {
  let settle: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, resolve: settle };
};

/** An event that never comes: here, the app never becoming ready. */
const never = () => deferred<void>().promise;

let root: string;
let account: string | undefined;
let membership: IEntitlementStatus;
let membershipListener: (status: IEntitlementStatus) => void;
/** What the server has on record, per account. */
let onRecord: Map<string, number>;
let online: boolean;
let asked: string[];
let sent: TPlusTermsNoticeState[];
let registration: IPlusTermsNoticeRegistration | undefined;

const invoke = <T>(channel: string, ...args: unknown[]) => {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`no handler for ${channel}`);
  }
  return handler({}, ...args) as T;
};

const fetchImpl = jest.fn(async (_input: string | URL, init?: RequestInit) => {
  const token = String(
    (init?.headers as Record<string, string>).Authorization,
  ).replace('Bearer ', '');
  asked.push(token);
  if (!online) {
    throw new TypeError('fetch failed');
  }
  const version = onRecord.get(token);
  return fakeResponse(200, version === undefined ? [] : [{ version }]);
});

const register = (userDataDir = root, accountConfig = config) => {
  registration = registerPlusTermsNoticeIpc({
    getMainWindow: () =>
      ({
        webContents: {
          send: (channel: string, payload: TPlusTermsNoticeState) => {
            if (channel === 'plus-terms-notice-changed') {
              sent.push(payload);
            }
          },
        },
      }) as never,
    userDataDir,
    config: accountConfig,
    session: {
      state: () =>
        account
          ? { status: 'signed-in', identity: { id: account } }
          : { status: 'signed-out' },
      // The token names the account, so the fake server answers for whoever
      // the request was made as.
      accessToken: async () => {
        if (!account) {
          throw new Error('signed out');
        }
        return account;
      },
    } as never,
    entitlement: {
      status: () => membership,
      subscribe: (listener: (status: IEntitlementStatus) => void) => {
        membershipListener = listener;
        return () => undefined;
      },
    } as never,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return registration;
};

const shown = () => invoke<TPlusTermsNoticeState>('plus-terms-notice');

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-terms-notice-'));
  handlers.clear();
  fetchImpl.mockClear();
  mockReady = Promise.resolve();
  account = 'account-a';
  membership = ACTIVE;
  membershipListener = () => undefined;
  onRecord = new Map([['account-a', OLDER]]);
  online = true;
  asked = [];
  sent = [];
});

afterEach(() => {
  registration?.dispose();
  registration = undefined;
  fs.rmSync(root, { recursive: true, force: true });
});

describe('telling a member the Plus terms changed', () => {
  it('asks the server once at launch and shows the notice it owes', async () => {
    const launched = register();
    // Waiting on the launch's own request: a check made now joins it.
    await launched.checkIfDue('probe');
    expect(asked).toEqual(['account-a']);
    expect(shown()).toEqual(NOTICE);
    expect(sent).toEqual([NOTICE]);
  });

  it('shows nothing to a member already on the current version, and stops asking', async () => {
    onRecord.set('account-a', PLUS_TERMS_VERSION);
    const launched = register();
    await launched.checkIfDue('probe');
    await launched.checkIfDue('window focused');
    await launched.checkIfDue('screen unlock');
    expect(shown()).toBeNull();
    expect(asked).toEqual(['account-a']);
    expect(sent).toEqual([]);
  });

  it('never asks about somebody who is not a member', async () => {
    membership = NONE;
    const launched = register();
    await launched.checkIfDue('window focused');
    expect(asked).toEqual([]);
    expect(shown()).toBeNull();
  });

  it('tells nobody, and asks nothing, in a build that does not sell Plus', async () => {
    const launched = register(root, { ...config, plusPrice: '' });
    await launched.checkIfDue('window focused');
    expect(asked).toEqual([]);
    expect(shown()).toBeNull();
  });

  it('asks again at the next event when the server could not be reached', async () => {
    online = false;
    const launched = register();
    await launched.checkIfDue('probe');
    expect(shown()).toBeNull();

    online = true;
    await launched.checkIfDue('window focused');
    expect(shown()).toEqual(NOTICE);
    expect(asked).toEqual(['account-a', 'account-a']);
  });

  it('launches on the ready event, not before it', async () => {
    const ready = deferred<void>();
    mockReady = ready.promise;
    const reached = deferred<void>();
    fetchImpl.mockImplementationOnce(async () => {
      reached.resolve();
      return fakeResponse(200, [{ version: OLDER }]);
    });
    const launched = register();
    expect(fetchImpl).not.toHaveBeenCalled();

    ready.resolve();
    await reached.promise;
    await launched.checkIfDue('probe');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(shown()).toEqual(NOTICE);
  });
});

describe('putting the notice away', () => {
  it('hides it, remembers it for that account, and asks nothing next launch', async () => {
    const launched = register();
    await launched.checkIfDue('probe');

    expect(
      await invoke('plus-terms-notice-seen', PLUS_TERMS_VERSION),
    ).toBeNull();
    expect(sent).toEqual([NOTICE, null]);
    expect(readTermsNoticeSeen(root, 'account-a')).toBe(PLUS_TERMS_VERSION);

    // The next launch.
    launched.dispose();
    asked = [];
    const next = register();
    await next.checkIfDue('probe');
    expect(asked).toEqual([]);
    expect(shown()).toBeNull();
  });

  it('records only the version this build tells about', async () => {
    const launched = register();
    await launched.checkIfDue('probe');
    await invoke('plus-terms-notice-seen', OLDER);
    await invoke('plus-terms-notice-seen', 'everything');
    expect(readTermsNoticeSeen(root, 'account-a')).toBe(0);
    expect(shown()).toEqual(NOTICE);
  });

  it('still puts it away for the session when the disk refuses the write', async () => {
    // A file where the folder should be: every write under it fails.
    const blocked = path.join(root, 'not-a-folder');
    fs.writeFileSync(blocked, '', 'utf8');
    const launched = register(blocked);
    await launched.checkIfDue('probe');
    expect(shown()).toEqual(NOTICE);

    await invoke('plus-terms-notice-seen', PLUS_TERMS_VERSION);
    expect(shown()).toBeNull();
  });

  it('is told to each account on its own', async () => {
    onRecord.set('account-b', OLDER);
    const launched = register();
    await launched.checkIfDue('probe');
    await invoke('plus-terms-notice-seen', PLUS_TERMS_VERSION);

    // Somebody else signs in on the same computer.
    account = undefined;
    membership = NONE;
    membershipListener(NONE);
    expect(shown()).toBeNull();
    account = 'account-b';
    membership = ACTIVE;
    membershipListener(ACTIVE);
    await launched.checkIfDue('probe');
    expect(asked).toEqual(['account-a', 'account-b']);
    expect(shown()).toEqual(NOTICE);
  });
});

describe('what changes the answer while the app is open', () => {
  it('drops an answer about an account that is no longer signed in', async () => {
    const answer = deferred<Response>();
    fetchImpl.mockImplementationOnce(() => answer.promise);
    mockReady = never();
    const launched = register();
    const checking = launched.checkIfDue('window focused');

    account = 'account-b';
    answer.resolve(fakeResponse(200, [{ version: OLDER }]));
    await checking;
    // What the server said about account A must not decide for account B.
    expect(shown()).toBeNull();
  });

  it('hides the notice once the member agrees to the current version in the Studio', async () => {
    const launched = register();
    await launched.checkIfDue('probe');
    expect(shown()).toEqual(NOTICE);

    launched.agreed(PLUS_TERMS_VERSION);
    expect(shown()).toBeNull();
    expect(sent).toEqual([NOTICE, null]);
    expect(asked).toEqual(['account-a']);
  });

  it('does not let an agreement to an older version stand in for the server', async () => {
    mockReady = never();
    const launched = register();
    launched.agreed(OLDER);
    await launched.checkIfDue('window focused');
    // Still asked: an older agreement says nothing about what is on record.
    expect(asked).toEqual(['account-a']);
    expect(shown()).toEqual(NOTICE);
  });

  it('takes the notice down when the member signs out', async () => {
    const launched = register();
    await launched.checkIfDue('probe');
    account = undefined;
    membership = NONE;
    membershipListener(NONE);
    await launched.checkIfDue('probe');
    expect(shown()).toBeNull();
    expect(sent).toEqual([NOTICE, null]);
  });
});
