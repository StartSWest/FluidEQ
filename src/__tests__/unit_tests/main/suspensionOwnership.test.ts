/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAccountConfig } from '../../../common/accountConfig';
import {
  createSceneOwnership,
  type ISceneStoreRecord,
} from '../../../main/plus/sceneOwnership';

// Premium 0105 through main: a suspended account's one ask goes to the
// server and the store is read again with the ask in it; a notice put away is
// gone from the store at once and the server is told, so no computer shows it
// again. The server's words for a refusal come back as the app's.

const ME = '4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30';
const CONFIG = {
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'anon-key',
  apiUrl: 'https://example.supabase.co/functions/v1',
} as unknown as IAccountConfig;

const suspension = (asked: boolean) => ({
  deletesAt: '2026-11-27T10:00:00+00:00',
  windowFrom: '2026-10-28T10:00:00+00:00',
  windowTo: '2026-11-12T10:00:00+00:00',
  refundCents: 999,
  maker: false,
  refundRequestedAt: asked ? '2026-11-14T10:00:00+00:00' : null,
});

interface IWorld {
  asked: boolean;
  notices: Array<{ id: number; kind: string }>;
  calls: Array<{ path: string; body: unknown }>;
  refusal?: { status: number; message: string };
}

const owning = (world: IWorld) => {
  let record: ISceneStoreRecord | undefined;
  const reply = (status: number, body: unknown) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));
  return createSceneOwnership({
    config: CONFIG,
    session: {
      state: () => ({ identity: { id: ME } }) as never,
      accessToken: () => Promise.resolve('access-token'),
    },
    entitlement: {
      status: () => ({ state: 'none' }) as never,
      subscribe: () => () => undefined,
    },
    onIdentityChange: () => () => undefined,
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
    fetchImpl: ((url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      world.calls.push({
        path,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      if (path.endsWith('/rpc/request_suspension_refund')) {
        if (world.refusal) {
          return reply(world.refusal.status, {
            message: world.refusal.message,
          });
        }
        world.asked = true;
        return reply(200, suspension(true));
      }
      if (path.endsWith('/rpc/dismiss_notices')) {
        return reply(200, null);
      }
      return reply(200, {
        balance: 0,
        starterClaimed: true,
        owned: [],
        packs: [],
        suspension: suspension(world.asked),
        notices: world.notices,
      });
    }) as typeof fetch,
  });
};

describe('a suspended account through main', () => {
  it('asks for its refund and reads the store again with the ask in it', async () => {
    const world: IWorld = { asked: false, notices: [], calls: [] };
    const ownership = owning(world);
    const first = await ownership.refreshNow();
    expect(first).toMatchObject({ ok: true });
    expect(ownership.known()?.suspension?.refundRequestedAt).toBeUndefined();
    const outcome = await ownership.requestSuspensionRefund();
    expect(outcome.ok).toBe(true);
    expect(ownership.known()?.suspension?.refundRequestedAt).toBe(
      '2026-11-14T10:00:00+00:00',
    );
    expect(world.calls.map((call) => call.path)).toContain(
      '/rest/v1/rpc/request_suspension_refund',
    );
  });

  it("says why an ask was refused, in the app's words", async () => {
    const cases = [
      ['too_late', 'too-late'],
      ['nothing_to_refund', 'nothing-to-refund'],
      ['not_suspended', 'not-suspended'],
    ];
    const outcomes = await Promise.all(
      cases.map(([message]) =>
        owning({
          asked: false,
          notices: [],
          calls: [],
          refusal: { status: 400, message },
        }).requestSuspensionRefund(),
      ),
    );
    expect(outcomes).toEqual(
      cases.map(([, reason]) => ({ ok: false, reason })),
    );
  });

  it('puts a notice away here at once and tells the server which', async () => {
    const world: IWorld = {
      asked: false,
      notices: [
        { id: 3, kind: 'scene-returned' },
        { id: 4, kind: 'scene-returned' },
      ],
      calls: [],
    };
    const ownership = owning(world);
    await ownership.refreshNow();
    expect(ownership.known()?.notices?.map((notice) => notice.id)).toEqual([
      3, 4,
    ]);
    await ownership.dismissNotices([3]);
    expect(ownership.known()?.notices?.map((notice) => notice.id)).toEqual([4]);
    const told = world.calls.find((call) =>
      call.path.endsWith('/rpc/dismiss_notices'),
    );
    expect(told?.body).toEqual({ p_ids: [3] });
    await ownership.dismissNotices([4]);
    expect(ownership.known()?.notices).toBeUndefined();
  });

  it('asks the server nothing for no notices', async () => {
    const world: IWorld = { asked: false, notices: [], calls: [] };
    const ownership = owning(world);
    await ownership.dismissNotices([]);
    expect(
      world.calls.some((call) => call.path.endsWith('/rpc/dismiss_notices')),
    ).toBe(false);
  });
});
