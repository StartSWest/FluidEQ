/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Plus's channels: only the main window's own page may use them, what
 * crosses is short and checked, and fluideq.com's "Back to FluidEQ" makes
 * the app ask the server again and tells the window how the trip ended.
 */

const handlers = new Map<string, (...args: unknown[]) => unknown>();
jest.mock('electron', () => ({
  app: {
    isPackaged: false,
    isDefaultProtocolClient: () => false,
    setAsDefaultProtocolClient: jest.fn(),
    on: jest.fn(),
  },
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}));

/* eslint-disable import/first -- the electron mock must be installed first */
import type { BrowserWindow } from 'electron';
import {
  PLUS_SUBSCRIPTION_CHANNELS as C,
  type ISubscriptionState,
} from '../../../common/subscription';
import type { ISubscriptionService } from '../../../main/account/subscriptionService';
import { appLinkOf, deliverAppLink } from '../../../main/appLinks';
import registerPlusSubscriptionIpc from '../../../main/ipc/plusSubscription';
/* eslint-enable import/first */

const STATE: ISubscriptionState = {
  signedIn: true,
  plans: [],
  subscribed: false,
  manageable: false,
};

const setup = () => {
  const mainFrame = {};
  const sent: [string, unknown][] = [];
  const webContents = {
    mainFrame,
    send: (channel: string, payload: unknown) => sent.push([channel, payload]),
  };
  const window = {
    isDestroyed: () => false,
    webContents,
  } as unknown as BrowserWindow;
  let change: () => void = () => undefined;
  const service = {
    state: jest.fn(() => STATE),
    subscribe: jest.fn(async () => 'opened' as const),
    manage: jest.fn(async () => 'opened' as const),
    dismissLapse: jest.fn(),
    onChange: jest.fn((listener: () => void) => {
      change = listener;
      return () => undefined;
    }),
    dispose: jest.fn(),
  } satisfies ISubscriptionService;
  const readAgain = jest.fn();
  const registration = registerPlusSubscriptionIpc({
    getMainWindow: () => window,
    subscription: service,
    readAgain,
  });
  const fromWindow = { sender: webContents, senderFrame: mainFrame };
  const call = (channel: string, event: unknown, ...args: unknown[]) => {
    const handler = handlers.get(channel);
    if (!handler) {
      throw new Error(`no handler for ${channel}`);
    }
    return handler(event, ...args);
  };
  return {
    service,
    readAgain,
    registration,
    fromWindow,
    call,
    sent,
    change: () => change(),
  };
};

afterEach(() => {
  handlers.clear();
});

it('answers the main window’s own page', async () => {
  const { call, fromWindow, service, registration } = setup();
  expect(call(C.state, fromWindow)).toEqual(STATE);
  await call(C.subscribe, fromWindow, 'yearly', 'es', 15);
  expect(service.subscribe).toHaveBeenCalledWith('yearly', 'es', 15);
  await call(C.manage, fromWindow, 'de');
  expect(service.manage).toHaveBeenCalledWith('de');
  call(C.dismissLapse, fromWindow, 'ending-1');
  expect(service.dismissLapse).toHaveBeenCalledWith('ending-1');
  registration.dispose();
});

it.each([
  ['another page', { sender: {}, senderFrame: {} }],
  ['a frame inside the window', { sender: undefined, senderFrame: {} }],
])('refuses %s', (_label, event) => {
  const { call, fromWindow, service, registration } = setup();
  const stranger = {
    ...event,
    sender: event.sender ?? fromWindow.sender,
  };
  expect(() => call(C.state, stranger)).toThrow();
  expect(() => call(C.subscribe, stranger, 'monthly', 'en', 15)).toThrow();
  expect(() => call(C.manage, stranger, 'en')).toThrow();
  expect(() => call(C.dismissLapse, stranger, 'x')).toThrow();
  expect(service.subscribe).not.toHaveBeenCalled();
  registration.dispose();
});

it('hands the service nothing long, and no revision that is not a whole number', async () => {
  const { call, fromWindow, service, registration } = setup();
  await call(C.subscribe, fromWindow, 'm'.repeat(81), { en: 1 }, '15');
  expect(service.subscribe).toHaveBeenLastCalledWith('', '', undefined);
  await call(C.subscribe, fromWindow, 'monthly', 'en', 14.5);
  expect(service.subscribe).toHaveBeenLastCalledWith(
    'monthly',
    'en',
    undefined,
  );
  registration.dispose();
});

it('sends every change to the window', () => {
  const { change, sent, registration } = setup();
  change();
  expect(sent).toEqual([[C.changed, STATE]]);
  registration.dispose();
});

it.each([
  ['fluideq://plus/subscribed', 'subscribed'],
  ['fluideq://plus/cancelled', 'cancelled'],
  ['fluideq://plus/managed', 'managed'],
])(
  'back from Stripe through %s, asks again and tells the window',
  (address, returned) => {
    const { readAgain, sent, registration } = setup();
    const link = appLinkOf(address);
    expect(link).toBeDefined();
    if (link) {
      deliverAppLink(link);
    }
    expect(readAgain).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([[C.returned, returned]]);
    registration.dispose();
  },
);

it('a credits link is not Plus’s, and nothing is heard once let go of', () => {
  const { readAgain, sent, registration } = setup();
  deliverAppLink('credits-paid');
  expect(readAgain).not.toHaveBeenCalled();
  registration.dispose();
  deliverAppLink('plus-subscribed');
  expect(readAgain).not.toHaveBeenCalled();
  expect(sent).toEqual([]);
  expect(handlers.size).toBe(0);
});
