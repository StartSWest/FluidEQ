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
jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
  app: { whenReady: () => Promise.resolve() },
}));

/* eslint-disable import/first -- the electron mock must be installed first */
import type { IEntitlementStatus } from '../../../main/account/entitlement';
import { readPlusWelcomeSeen } from '../../../main/account/plusWelcomeSeen';
import {
  registerPlusWelcomeIpc,
  type IPlusWelcomeRegistration,
  type TPlusWelcomeState,
} from '../../../main/ipc/plusWelcome';
/* eslint-enable import/first */

const ACTIVE: IEntitlementStatus = { state: 'active', plan: 'plus' };
const NONE: IEntitlementStatus = { state: 'none' };

let root: string;
let account: string | undefined;
let membership: IEntitlementStatus;
let membershipListener: (status: IEntitlementStatus) => void;
let sent: TPlusWelcomeState[];
let registration: IPlusWelcomeRegistration | undefined;

const invoke = <T>(channel: string, ...args: unknown[]) => {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`no handler for ${channel}`);
  }
  return handler({}, ...args) as T;
};

const register = (userDataDir = root) => {
  registration = registerPlusWelcomeIpc({
    getMainWindow: () =>
      ({
        webContents: {
          send: (channel: string, payload: TPlusWelcomeState) => {
            if (channel === 'plus-welcome-changed') {
              sent.push(payload);
            }
          },
        },
      }) as never,
    userDataDir,
    session: {
      state: () =>
        account
          ? { status: 'signed-in', identity: { id: account } }
          : { status: 'signed-out' },
    } as never,
    entitlement: {
      status: () => membership,
      subscribe: (listener: (status: IEntitlementStatus) => void) => {
        membershipListener = listener;
        return () => undefined;
      },
    } as never,
  });
  return registration;
};

const shown = () => invoke<TPlusWelcomeState>('plus-welcome');

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-plus-welcome-'));
  handlers.clear();
  account = 'member-1';
  membership = NONE;
  membershipListener = () => undefined;
  sent = [];
  registration = undefined;
});

afterEach(() => {
  registration?.dispose();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('the welcome to Plus', () => {
  it('says nothing to an account without a membership', () => {
    register();
    expect(shown()).toBeNull();
  });

  it('says nothing to nobody, membership or not', () => {
    account = undefined;
    membership = ACTIVE;
    register();
    expect(shown()).toBeNull();
  });

  it('welcomes a member, and tells the window when the membership turns on', () => {
    register();
    expect(shown()).toBeNull();

    // What a payment looks like from here: the membership check came back
    // different, with the app already open.
    membership = ACTIVE;
    membershipListener(ACTIVE);

    expect(sent).toEqual([{ edition: 1 }]);
    expect(shown()).toEqual({ edition: 1 });
  });

  it('welcomes once, and remembers it across a restart', () => {
    membership = ACTIVE;
    register();
    expect(shown()).toEqual({ edition: 1 });

    expect(invoke('plus-welcome-seen', 1)).toBeNull();
    expect(readPlusWelcomeSeen(root, 'member-1')).toBe(1);
    expect(shown()).toBeNull();

    registration?.dispose();
    sent = [];
    register();
    expect(shown()).toBeNull();
  });

  /**
   * The window can be running older code than this process — in development
   * it routinely is — and a welcome it never gave must not be recorded as
   * shown, or the member never sees the one this build carries.
   */
  it('records nothing for an edition it did not send', () => {
    membership = ACTIVE;
    register();
    expect(invoke('plus-welcome-seen', 99)).toEqual({ edition: 1 });
    expect(readPlusWelcomeSeen(root, 'member-1')).toBe(0);
    expect(shown()).toEqual({ edition: 1 });
  });

  it('welcomes the next account to sign in here on its own merits', () => {
    membership = ACTIVE;
    register();
    invoke('plus-welcome-seen', 1);
    expect(shown()).toBeNull();

    account = 'member-2';
    membershipListener(ACTIVE);
    expect(shown()).toEqual({ edition: 1 });
  });

  it('tells the window only when the answer actually changed', async () => {
    membership = ACTIVE;
    register();
    // The membership is re-read on every come-back and almost always says
    // what it said before; the window has no use for being told so.
    await Promise.resolve();
    sent = [];
    membershipListener(ACTIVE);
    membershipListener(ACTIVE);
    expect(sent).toEqual([]);
  });
});
