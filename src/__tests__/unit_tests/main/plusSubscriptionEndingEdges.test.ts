/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import { createSubscriptionLapse } from '../../../main/account/subscriptionLapse';
import { createSubscriptionRecords } from '../../../main/account/subscriptionRecord';
import {
  ACCOUNT_ID,
  DAY,
  diskStore,
  DUNE,
  fakeBackend,
  GLOW,
  HOUR,
  library,
  liveRow,
  NOW,
  startPlus,
  type IDisk,
  type IPlusApp,
} from '../../utils/plusSubscriptionKit';

// The edges of Plus's ending, each one a way a download could go on a
// guess: the row not heard after the second answer, the server heard after
// the grace ran out, a cancellation offline, a renewal seen only on the
// row, and a suspended account.

const subscriber = async ({
  end = NOW + DAY,
  cancelled = false,
}: { end?: number; cancelled?: boolean } = {}) => {
  const backend = fakeBackend();
  const disk: IDisk = {};
  const clock = { now: NOW };
  backend.state.aware = true;
  backend.state.row = liveRow(end, cancelled);
  backend.state.library = library(end, { renewing: !cancelled });
  const app = startPlus({ backend, disk, clock });
  await app.signIn();
  app.records.addDownload(ACCOUNT_ID, GLOW);
  app.records.addDownload(ACCOUNT_ID, DUNE);
  return { backend, clock, app };
};

const keptEverything = (app: IPlusApp) => {
  expect(app.account.endConfirmed()).toBe(false);
  expect(app.removed).toEqual([]);
  expect(app.records.downloads(ACCOUNT_ID)).toEqual([GLOW, DUNE]);
};

it('a second answer with the row unreadable after it confirms nothing', async () => {
  const { backend, clock, app } = await subscriber({ cancelled: true });
  clock.now = NOW + DAY + HOUR;
  backend.state.row = { ...liveRow(NOW + DAY, true), status: 'canceled' };
  backend.state.library = undefined;
  await app.comeBack();
  keptEverything(app);

  // A day later my_store says it again, but the row cannot be read after it.
  clock.now = NOW + 2 * DAY + 2 * HOUR;
  backend.state.entitlementsDown = true;
  await app.comeBack();
  keptEverything(app);

  // The control: the row read after the next answer agrees, and it ends.
  backend.state.entitlementsDown = false;
  await app.comeBack();
  expect(app.account.endConfirmed()).toBe(true);
  expect(app.removed).toEqual([[GLOW, DUNE]]);
});

it('the grace running out is no ending when the server was heard after it, then lost', async () => {
  const { backend, clock, app } = await subscriber({ end: NOW + DAY });
  // Sixteen days on, the row answers (its old period, left behind) and
  // my_store does not: the server was heard after the grace ran out.
  clock.now = NOW + 16 * DAY;
  backend.state.storeDown = true;
  await app.comeBack();
  expect(app.account.subscribed()).toBe(false);
  keptEverything(app);

  // Then the network goes: a failed read (the row is due again five hours
  // on) ends nothing, the server was reachable since the grace ran out.
  clock.now = NOW + 16 * DAY + 5 * HOUR;
  backend.state.offline = true;
  const reads = backend.count('GET /rest/v1/entitlements');
  await app.comeBack();
  expect(backend.count('GET /rest/v1/entitlements')).toBe(reads + 1);
  keptEverything(app);
});

it('Plus cancelled to end with its period, then offline for weeks, ends only on the server’s word', async () => {
  const { backend, clock, app } = await subscriber({ cancelled: true });
  backend.state.offline = true;
  clock.now = NOW + 20 * DAY;
  await app.comeBack();
  expect(app.account.subscribed()).toBe(false);
  keptEverything(app);
});

it('a renewal the row shows before my_store does starts the wait again', async () => {
  const { backend, clock, app } = await subscriber({ cancelled: true });
  const first = NOW + DAY + HOUR;
  clock.now = first;
  backend.state.row = { ...liveRow(NOW + DAY, true), status: 'canceled' };
  backend.state.library = undefined;
  await app.comeBack();

  // Plus again: the row has its new period; my_store has not caught up.
  clock.now = first + 12 * HOUR;
  backend.state.row = liveRow(NOW + 31 * DAY);
  await app.comeBack();
  expect(app.account.subscribed()).toBe(true);

  // Refunded at once. A day after the FIRST answer, but the wait started
  // again with the renewal: one more answer is owed before anything goes.
  clock.now = first + 25 * HOUR;
  backend.state.row = { ...liveRow(NOW + 31 * DAY), status: 'canceled' };
  await app.comeBack();
  keptEverything(app);
});

it('the lapse never acts for a suspended account, even on a confirmed end', async () => {
  const disk: IDisk = {};
  const records = createSubscriptionRecords({ store: diskStore(disk, 'plus') });
  records.addDownload(ACCOUNT_ID, GLOW);
  const remove = jest.fn(() => []);
  const ending = {
    subscribed: () => false,
    endConfirmed: () => true,
    onChange: () => () => undefined,
  };
  const suspension = {
    deletesAt: '2026-12-05T00:00:00Z',
    windowFrom: '2026-11-05T00:00:00Z',
    windowTo: '2026-11-20T00:00:00Z',
    refundCents: 0,
    maker: false,
  };
  const lapse = createSubscriptionLapse({
    accountId: () => ACCOUNT_ID,
    ownership: {
      known: () => ({
        balance: 0,
        starterClaimed: true,
        owned: [],
        packs: [],
        suspension,
      }),
    },
    subscription: ending,
    remove,
    records,
  });
  await lapse.check();
  expect(remove).not.toHaveBeenCalled();
  expect(records.downloads(ACCOUNT_ID)).toEqual([GLOW]);

  // The control: the same end for an account that is not suspended.
  const control = createSubscriptionLapse({
    accountId: () => ACCOUNT_ID,
    ownership: {
      known: () => ({ balance: 0, starterClaimed: true, owned: [], packs: [] }),
    },
    subscription: ending,
    remove,
    records,
  });
  await control.check();
  expect(remove).toHaveBeenCalledWith([GLOW]);
});
