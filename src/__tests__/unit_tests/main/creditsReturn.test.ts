/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Coming back from paying for a pack. The pack is paid in the browser and the
 * app used to hear of it only when its window got the focus back, so a buyer
 * who looked at FluidEQ without clicking it saw it waiting for a payment the
 * server already had (Ivan, 2026-10-21). The return page's "Back to FluidEQ"
 * opens a `fluideq://` link; these hold what that link may and may not do,
 * and that the checkout asks in the window's language.
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
import type { IAccountConfig } from '../../../common/accountConfig';
import {
  appLinkInArgs,
  appLinkOf,
  deliverAppLink,
} from '../../../main/appLinks';
import { registerSceneStoreIpc } from '../../../main/ipc/sceneStore';
import type { ISceneOwnership } from '../../../main/plus/sceneOwnership';
import { startCreditCheckout } from '../../../main/plus/sceneStoreApi';
/* eslint-enable import/first */

const CONFIG = {
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'anon',
  apiUrl: 'https://example.supabase.co/functions/v1',
} as unknown as IAccountConfig;

describe('fluideq:// links', () => {
  it.each([
    ['fluideq://credits/paid', 'credits-paid'],
    ['fluideq://credits/paid/', 'credits-paid'],
    ['FLUIDEQ://Credits/Paid', 'credits-paid'],
    ['fluideq://credits/paid?session=cs_test_1', 'credits-paid'],
    ['fluideq://credits/cancelled', 'credits-cancelled'],
  ])('reads %s as %s', (address, link) => {
    expect(appLinkOf(address)).toBe(link);
  });

  it.each([
    'https://fluideq.com/credits/paid/',
    'fluideq://credits',
    'fluideq://credits/refund',
    'fluideq://buy/pack-30',
    'fluideq:credits/paid',
    'not a link',
    '',
  ])('ignores %p', (address) => {
    expect(appLinkOf(address)).toBeUndefined();
  });

  it('finds the link among the arguments a second launch hands over', () => {
    expect(
      appLinkInArgs([
        'C:\\Program Files\\FluidEQ\\FluidEQ.exe',
        '--allow-file-access-from-files',
        'fluideq://credits/paid',
      ]),
    ).toBe('credits-paid');
    expect(appLinkInArgs(['FluidEQ.exe', '--hidden'])).toBeUndefined();
  });
});

describe('the credits coming back', () => {
  let refreshes: number;
  let checkouts: [string, string][];
  let sent: [string, unknown][];
  let dispose: () => void;

  beforeEach(() => {
    handlers.clear();
    refreshes = 0;
    checkouts = [];
    sent = [];
    const ownership = {
      subscribe: () => () => undefined,
      known: () => undefined,
      refreshNow: () => {
        refreshes += 1;
        return Promise.resolve({ ok: false, reason: 'offline' });
      },
      checkout: (packId: string, locale: string) => {
        checkouts.push([packId, locale]);
        return Promise.resolve({
          ok: true,
          url: 'https://checkout.stripe.com/c/pay/cs_test_1',
        });
      },
    } as unknown as ISceneOwnership;
    ({ dispose } = registerSceneStoreIpc({
      getMainWindow: () =>
        ({
          webContents: {
            send: (channel: string, value: unknown) =>
              sent.push([channel, value]),
          },
        }) as never,
      config: CONFIG,
      ownership,
      openExternal: () => true,
    }));
  });

  afterEach(() => dispose());

  it('asks the server at once and tells the window the payment went through', () => {
    deliverAppLink('credits-paid');
    expect(refreshes).toBe(1);
    expect(sent).toEqual([['scene-store-checkout-returned', 'paid']]);
  });

  it('tells the window a cancelled payment, so it stops waiting for one', () => {
    deliverAppLink('credits-cancelled');
    expect(sent).toEqual([['scene-store-checkout-returned', 'cancelled']]);
  });

  it('hears no link once the store is gone', () => {
    dispose();
    deliverAppLink('credits-paid');
    expect(refreshes).toBe(0);
    dispose = () => undefined;
  });

  it('pays in the window’s language, and in English for anything else', async () => {
    const handler = handlers.get('scene-store-checkout');
    if (!handler) {
      throw new Error('no checkout channel');
    }
    await handler({}, 'pack-12', 'de');
    await handler({}, 'pack-5', 'klingon');
    await handler({}, 'pack-30', undefined);
    expect(checkouts).toEqual([
      ['pack-12', 'de'],
      ['pack-5', 'en'],
      ['pack-30', 'en'],
    ]);
  });
});

describe('the checkout request', () => {
  it('carries the language beside the pack and the terms', async () => {
    const bodies: unknown[] = [];
    const fetchImpl = jest.fn((_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return Promise.resolve(
        new Response(
          JSON.stringify({
            url: 'https://checkout.stripe.com/c/pay/cs_test_1',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    });
    const page = await startCreditCheckout(
      {
        config: CONFIG,
        accessToken: 'token',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
      'pack-12',
      'ja',
    );
    expect(page).toEqual({
      ok: true,
      url: 'https://checkout.stripe.com/c/pay/cs_test_1',
    });
    expect(bodies).toEqual([
      expect.objectContaining({ packId: 'pack-12', locale: 'ja' }),
    ]);
  });
});
