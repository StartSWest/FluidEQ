/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { parseSubmissionRow } from '../../../common/plusReview';
import {
  isSceneStore,
  mayPlayAnything,
  mayPlayLook,
  parseSceneStore,
} from '../../../common/sceneStore';
import { memberLookId } from '../../../common/memberScenes';

// Premium 0105 as the app reads it: a suspended account's store, the notices
// the server keeps for an account, and a decline's block. A suspension shown
// wrong is a refund offered wrong, so it reads whole or the store does not;
// a notice is only something to say, so one this app cannot read is left out
// and the rest of the store still reads.

const me = '30000000-0000-4000-8000-000000000001';
const other = '30000000-0000-4000-8000-000000000002';
const suspension = {
  suspendedAt: '2026-11-12T10:00:00+00:00',
  deletesAt: '2026-11-27T10:00:00+00:00',
  windowFrom: '2026-10-28T10:00:00+00:00',
  windowTo: '2026-11-12T10:00:00+00:00',
  refundCents: 999,
  packs: [{ boughtAt: '2026-11-05T10:00:00+00:00', amountCents: 999 }],
  refundRequestedAt: null,
  maker: true,
  scenes: 2,
  buyers: 5,
  unpaidCents: 0,
};
const base = {
  balance: 3,
  starterClaimed: true,
  owned: [],
  packs: [],
  published: [],
  free: [],
  everything: false,
  halfCredit: false,
  unpublished: [],
};

describe('a suspended account in the store', () => {
  it('reads the suspension, and an asked refund once it is asked', () => {
    const store = parseSceneStore({ ...base, suspension });
    expect(store?.suspension).toEqual({
      deletesAt: suspension.deletesAt,
      windowFrom: suspension.windowFrom,
      windowTo: suspension.windowTo,
      refundCents: 999,
      maker: true,
    });
    const asked = parseSceneStore({
      ...base,
      suspension: {
        ...suspension,
        refundRequestedAt: '2026-11-14T09:00:00+00:00',
      },
    });
    expect(asked?.suspension?.refundRequestedAt).toBe(
      '2026-11-14T09:00:00+00:00',
    );
    expect(isSceneStore(asked)).toBe(true);
  });

  it('reads no suspension from null or from a server before it', () => {
    expect(
      parseSceneStore({ ...base, suspension: null })?.suspension,
    ).toBeUndefined();
    expect(parseSceneStore(base)?.suspension).toBeUndefined();
  });

  it('refuses the whole store when the suspension does not read', () => {
    [
      { ...suspension, deletesAt: 'soon' },
      { ...suspension, refundCents: -1 },
      { ...suspension, maker: 'yes' },
      'suspended',
    ].forEach((broken) => {
      expect(parseSceneStore({ ...base, suspension: broken })).toBeUndefined();
    });
  });

  it('plays nothing, its own scenes, a gift of everything and a Plus membership included', () => {
    const store = parseSceneStore({
      ...base,
      owned: [{ authorId: other, sceneId: 'lake' }],
      everything: true,
      suspension,
    });
    const own = memberLookId(me, 'pond');
    const bought = memberLookId(other, 'lake');
    [own, bought].forEach((lookId) => {
      expect(mayPlayLook({ lookId, accountId: me, plus: true, store })).toBe(
        false,
      );
    });
    expect(
      mayPlayAnything({ accountId: me, plus: true, store, held: [own] }),
    ).toBe(false);
    // The control: the same store without the suspension plays both.
    expect(store).toBeDefined();
    const free = store ? { ...store, suspension: undefined } : undefined;
    [own, bought].forEach((lookId) => {
      expect(
        mayPlayLook({ lookId, accountId: me, plus: false, store: free }),
      ).toBe(true);
    });
  });
});

describe('notices in the store', () => {
  const names = { en: 'Neon Rain' };

  it("reads each kind, a buyer's with no name and a takedown with its block", () => {
    const store = parseSceneStore({
      ...base,
      notices: [
        {
          id: 1,
          kind: 'scene-returned',
          authorId: other,
          sceneId: 'lake',
          names: null,
        },
        {
          id: 2,
          kind: 'scene-taken-down',
          names,
          blockDays: 15,
          blockScope: 'account',
        },
        { id: 3, kind: 'scene-restored', names },
        { id: 4, kind: 'purchase-refunded', names },
      ],
    });
    expect(store?.notices).toEqual([
      { id: 1, kind: 'scene-returned' },
      {
        id: 2,
        kind: 'scene-taken-down',
        names,
        block: { days: 15, scope: 'account' },
      },
      { id: 3, kind: 'scene-restored', names },
      { id: 4, kind: 'purchase-refunded', names },
    ]);
    expect(isSceneStore(store)).toBe(true);
  });

  it('leaves out a kind it does not know and one that does not read, and still reads the store', () => {
    const store = parseSceneStore({
      ...base,
      balance: 7,
      notices: [
        { id: 9, kind: 'scene-exploded', names },
        { id: 'x', kind: 'scene-returned' },
        { id: 10, kind: 'scene-restored', names: { de: 'Ohne Englisch' } },
        { id: 11, kind: 'scene-returned' },
      ],
    });
    expect(store?.balance).toBe(7);
    expect(store?.notices).toEqual([{ id: 11, kind: 'scene-returned' }]);
  });

  it('keeps a takedown whose block is not one of the choices, without the block', () => {
    const store = parseSceneStore({
      ...base,
      notices: [
        {
          id: 5,
          kind: 'scene-taken-down',
          names,
          blockDays: 7,
          blockScope: 'account',
        },
      ],
    });
    expect(store?.notices).toEqual([
      { id: 5, kind: 'scene-taken-down', names },
    ]);
  });

  it('carries no notices when there are none', () => {
    expect(parseSceneStore({ ...base, notices: [] })?.notices).toBeUndefined();
  });
});

describe("a declined scene's block", () => {
  const row = {
    scene_id: 'reef',
    version: 1,
    category: 'nature',
    names: { en: 'Reef' },
    swatch: ['#112233', '#445566'],
    submitted_at: '2026-11-10T10:00:00+00:00',
    decided_at: '2026-11-11T10:00:00+00:00',
    state: 'rejected',
    reason: 'rights',
    block_days: 30,
    block_scope: 'scene',
  };

  it('is read with the refusal', () => {
    expect(parseSubmissionRow(row)?.block).toEqual({
      days: 30,
      scope: 'scene',
    });
  });

  it('is read only while the submission stands refused, and only as one of the choices', () => {
    expect(
      parseSubmissionRow({ ...row, state: 'pending', reason: null })?.block,
    ).toBeUndefined();
    expect(
      parseSubmissionRow({ ...row, block_days: 45 })?.block,
    ).toBeUndefined();
    expect(
      parseSubmissionRow({ ...row, block_scope: 'everything' })?.block,
    ).toBeUndefined();
  });
});
