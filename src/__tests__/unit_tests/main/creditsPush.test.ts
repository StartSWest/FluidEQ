/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The credits arriving by themselves while a pack is paid for in the
 * browser (Ivan, 2026-11-09: "fluid needs to also refresh and receive the
 * paid hook by it self automatically"). The server broadcasts to the
 * account's private topic whenever its credits move (premium 0099); these
 * hold how the app listens — only while a payment is owed, on its own topic,
 * with no clock — and that a broadcast reads the store with nobody at the
 * window.
 */

import type { IAccountConfig } from '../../../common/accountConfig';
import type { IAccountState } from '../../../main/account/session';
import {
  createCreditsPush,
  MAX_REJOINS,
  type ICreditsPush,
} from '../../../main/plus/creditsPush';
import {
  createSceneOwnership,
  type ISceneStoreRecord,
} from '../../../main/plus/sceneOwnership';

const ME = '4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30';
const SOMEONE = '0b6e3f2a-3c1d-4e5f-8a9b-1c2d3e4f5a6b';
const CONFIG = {
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'anon-key',
  apiUrl: 'https://example.supabase.co/functions/v1',
} as unknown as IAccountConfig;
const TOPIC = `realtime:credits:${ME}`;

/** A socket the test plays the server for. */
class FakeSocket extends EventTarget {
  readyState = 0;

  readonly sent: Record<string, unknown>[] = [];

  constructor(readonly url: string) {
    super();
  }

  send(data: string) {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  close() {
    if (this.readyState < 2) {
      this.readyState = 3;
      this.dispatchEvent(new Event('close'));
    }
  }

  opens() {
    this.readyState = 1;
    this.dispatchEvent(new Event('open'));
  }

  receives(message: Record<string, unknown>) {
    this.dispatchEvent(
      Object.assign(new Event('message'), { data: JSON.stringify(message) }),
    );
  }

  /** The server going away, as Realtime does to a socket that said nothing. */
  drops() {
    this.readyState = 3;
    this.dispatchEvent(new Event('close'));
  }

  joinsOk() {
    this.receives({
      topic: TOPIC,
      event: 'phx_reply',
      ref: '1',
      payload: { status: 'ok', response: {} },
    });
  }
}

/** Every promise the push started has settled. */
const settled = async () => {
  for (let step = 0; step < 6; step += 1) {
    // eslint-disable-next-line no-await-in-loop -- one microtask per step
    await Promise.resolve();
  }
};

let account: IAccountState;

const signedIn = (id: string): IAccountState =>
  ({ status: 'signed-in', identity: { id } }) as unknown as IAccountState;

describe('the credits push', () => {
  let sockets: FakeSocket[];
  let heard: number;
  let token: () => Promise<string>;
  let push: ICreditsPush;

  beforeEach(() => {
    account = signedIn(ME);
    sockets = [];
    heard = 0;
    token = () => Promise.resolve('access-token');
    push = createCreditsPush({
      config: CONFIG,
      session: { state: () => account, accessToken: () => token() },
      onCredits: () => {
        heard += 1;
      },
      createSocket: (url) => {
        const socket = new FakeSocket(url);
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
    });
  });

  afterEach(() => push.stop());

  it('joins its own account’s private topic with the account’s token', async () => {
    push.watch();
    await settled();
    expect(sockets).toHaveLength(1);
    expect(sockets[0].url).toBe(
      'wss://example.supabase.co/realtime/v1/websocket?apikey=anon-key&vsn=1.0.0',
    );
    sockets[0].opens();
    expect(sockets[0].sent).toEqual([
      expect.objectContaining({
        topic: TOPIC,
        event: 'phx_join',
        payload: expect.objectContaining({
          access_token: 'access-token',
          config: expect.objectContaining({ private: true }),
        }),
      }),
    ]);
  });

  it('reads the store once joined, and again at every credits broadcast', async () => {
    push.watch();
    await settled();
    sockets[0].opens();
    expect(heard).toBe(0);
    sockets[0].joinsOk();
    expect(heard).toBe(1);
    sockets[0].receives({
      topic: TOPIC,
      event: 'broadcast',
      payload: { type: 'broadcast', event: 'credits', payload: {} },
    });
    expect(heard).toBe(2);
  });

  it('control: nothing is read for another topic, another event, or noise', async () => {
    push.watch();
    await settled();
    sockets[0].opens();
    sockets[0].joinsOk();
    heard = 0;
    sockets[0].receives({
      topic: `realtime:credits:${SOMEONE}`,
      event: 'broadcast',
      payload: { event: 'credits' },
    });
    sockets[0].receives({
      topic: TOPIC,
      event: 'broadcast',
      payload: { event: 'something-else' },
    });
    sockets[0].dispatchEvent(
      Object.assign(new Event('message'), { data: 'not json' }),
    );
    expect(heard).toBe(0);
  });

  it('opens one socket however often it is asked to watch', async () => {
    push.watch();
    push.watch();
    await settled();
    push.watch();
    await settled();
    expect(sockets).toHaveLength(1);
  });

  it('rejoins at once when a joined socket is dropped, and reads the store again', async () => {
    push.watch();
    await settled();
    sockets[0].opens();
    sockets[0].joinsOk();
    sockets[0].drops();
    await settled();
    expect(sockets).toHaveLength(2);
    sockets[1].opens();
    sockets[1].joinsOk();
    expect(heard).toBe(2);
  });

  /** Joins and drops the newest socket, as Realtime does every 66 s. */
  const dropTimes = async (times: number) => {
    for (let drop = 0; drop < times; drop += 1) {
      // eslint-disable-next-line no-await-in-loop -- each rejoin waits on its token
      await settled();
      const socket = sockets[sockets.length - 1];
      socket.opens();
      socket.joinsOk();
      socket.drops();
    }
    await settled();
  };

  it('stops rejoining after its allowance, and a come-back gives a fresh one', async () => {
    push.watch();
    await dropTimes(MAX_REJOINS + 1);
    expect(sockets).toHaveLength(MAX_REJOINS + 1);
    // The next come-back event watches again, with the whole allowance.
    push.watch();
    await dropTimes(MAX_REJOINS + 1);
    expect(sockets).toHaveLength(2 * (MAX_REJOINS + 1));
  });

  it('control: a socket that never joined is not tried again by itself', async () => {
    push.watch();
    await settled();
    sockets[0].opens();
    sockets[0].receives({
      topic: TOPIC,
      event: 'phx_reply',
      ref: '1',
      payload: { status: 'error', response: { reason: 'Unauthorized' } },
    });
    await settled();
    expect(sockets).toHaveLength(1);
    expect(sockets[0].readyState).toBe(3);
    // The next come-back event asks again.
    push.watch();
    await settled();
    expect(sockets).toHaveLength(2);
  });

  it('leaves a joined socket for good when stopped', async () => {
    push.watch();
    await settled();
    sockets[0].opens();
    sockets[0].joinsOk();
    push.stop();
    await settled();
    expect(sockets[0].readyState).toBe(3);
    expect(sockets).toHaveLength(1);
  });

  it('closes on an expired token and joins again with a fresh one', async () => {
    push.watch();
    await settled();
    sockets[0].opens();
    sockets[0].joinsOk();
    token = () => Promise.resolve('fresh-token');
    sockets[0].receives({
      topic: TOPIC,
      event: 'system',
      payload: { status: 'error', message: 'Token has expired' },
    });
    await settled();
    expect(sockets).toHaveLength(2);
    sockets[1].opens();
    expect(sockets[1].sent[0]).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({ access_token: 'fresh-token' }),
      }),
    );
  });

  it('opens nothing signed out, without a token, or for an account gone meanwhile', async () => {
    account = { status: 'signed-out' } as unknown as IAccountState;
    push.watch();
    await settled();
    push.stop();
    account = signedIn(ME);
    token = () => Promise.reject(new Error('offline'));
    push.watch();
    await settled();
    push.stop();
    let release: (value: string) => void = () => undefined;
    token = () =>
      new Promise<string>((resolve) => {
        release = resolve;
      });
    push.watch();
    await settled();
    account = signedIn(SOMEONE);
    release('access-token');
    await settled();
    expect(sockets).toHaveLength(0);
  });
});

describe('the store listening while a payment is owed', () => {
  let balance: number;
  let storeAsks: number;
  let pushes: { watch: jest.Mock; stop: jest.Mock };
  let credits: () => void;
  let identityChanged: () => void;

  const answer = (body: unknown) =>
    Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

  const ownership = () => {
    let record: ISceneStoreRecord | undefined;
    return createSceneOwnership({
      config: CONFIG,
      session: {
        state: () => account,
        accessToken: () => Promise.resolve('access-token'),
      },
      entitlement: {
        status: () => ({ state: 'none' }) as never,
        subscribe: () => () => undefined,
      },
      onIdentityChange: (listener) => {
        identityChanged = listener;
        return () => undefined;
      },
      store: {
        available: () => true,
        clear: () => {
          record = undefined;
        },
        read: () => record,
        write: (value) => {
          record = value;
        },
      },
      fetchImpl: ((url: string) => {
        if (url.endsWith('/create-credit-checkout')) {
          return answer({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' });
        }
        storeAsks += 1;
        return answer({
          balance,
          starterClaimed: true,
          owned: [],
          packs: [],
        });
      }) as typeof fetch,
      createCreditsPush: (onCredits) => {
        credits = onCredits;
        return pushes as unknown as ICreditsPush;
      },
    });
  };

  beforeEach(() => {
    account = signedIn(ME);
    balance = 3;
    storeAsks = 0;
    pushes = { watch: jest.fn(), stop: jest.fn() };
    credits = () => undefined;
    identityChanged = () => undefined;
  });

  it('listens from the checkout opening, and reads the store when told, window or not', async () => {
    const owned = ownership();
    await owned.refreshNow();
    expect(pushes.watch).not.toHaveBeenCalled();
    await owned.checkout('pack-12', 'en');
    expect(pushes.watch).toHaveBeenCalledTimes(1);
    balance = 15;
    storeAsks = 0;
    credits();
    await settled();
    await settled();
    expect(storeAsks).toBe(1);
    expect(owned.known()?.balance).toBe(15);
    // The payment came in: nothing is owed, so nothing is listened to.
    expect(pushes.stop).toHaveBeenCalled();
    owned.dispose();
  });

  it('control: no checkout, no listening, however often the store is read', async () => {
    const owned = ownership();
    await owned.refreshNow();
    await owned.refreshIfDue('focus');
    expect(pushes.watch).not.toHaveBeenCalled();
    owned.dispose();
  });

  it('keeps listening while the balance has not moved, and listens again at a come-back event', async () => {
    const owned = ownership();
    await owned.refreshNow();
    await owned.checkout('pack-12', 'en');
    credits();
    await settled();
    await settled();
    expect(pushes.stop).not.toHaveBeenCalled();
    await owned.refreshIfDue('focus');
    expect(pushes.watch).toHaveBeenCalledTimes(2);
    owned.dispose();
  });

  it('stops listening when the account changes, and when the app quits', async () => {
    const owned = ownership();
    await owned.refreshNow();
    await owned.checkout('pack-12', 'en');
    account = signedIn(SOMEONE);
    identityChanged();
    expect(pushes.stop).toHaveBeenCalledTimes(1);
    owned.dispose();
    expect(pushes.stop).toHaveBeenCalledTimes(2);
  });

  // Ivan, 2026-11-13: the coins celebrate a pack "when the hook confirms the
  // payment and they're back in the app" - once, at that moment.
  describe('telling the window a pack came in', () => {
    it('says how many credits arrived, once, the moment the payment is confirmed', async () => {
      const owned = ownership();
      const arrived = jest.fn();
      owned.onCreditsArrived(arrived);
      await owned.refreshNow();
      await owned.checkout('pack-12', 'en');
      balance = 15;
      credits();
      await settled();
      await settled();
      expect(arrived).toHaveBeenCalledTimes(1);
      expect(arrived).toHaveBeenCalledWith(12);
      // The store had already gone out: the balance the coins fly to shows it.
      expect(owned.known()?.balance).toBe(15);

      // Read again and again afterwards: nothing more is owed, nothing said.
      credits();
      await owned.refreshNow();
      await owned.refreshIfDue('focus');
      expect(arrived).toHaveBeenCalledTimes(1);
      owned.dispose();
    });

    it('control: says nothing for a balance that rises with no payment owed', async () => {
      const owned = ownership();
      const arrived = jest.fn();
      owned.onCreditsArrived(arrived);
      await owned.refreshNow();
      // Credits that came another way - the starter credits, a refund, a gift.
      balance = 6;
      await owned.refreshNow();
      expect(owned.known()?.balance).toBe(6);
      expect(arrived).not.toHaveBeenCalled();
      owned.dispose();
    });

    it('says nothing while the payment has not landed, and nothing for a balance that fell', async () => {
      const owned = ownership();
      const arrived = jest.fn();
      owned.onCreditsArrived(arrived);
      await owned.refreshNow();
      await owned.checkout('pack-12', 'en');
      await owned.refreshNow();
      expect(arrived).not.toHaveBeenCalled();
      // A scene bought meanwhile: the wait ends and nothing arrived.
      balance = 2;
      await owned.refreshNow();
      expect(arrived).not.toHaveBeenCalled();
      owned.dispose();
    });
  });
});
