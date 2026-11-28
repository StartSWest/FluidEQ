/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import {
  ACCOUNT_ID,
  DAY,
  fakeBackend,
  library,
  liveRow,
  NOW,
  OTHER_ID,
  PLANS,
  startPlus,
  type IDisk,
} from '../../utils/plusSubscriptionKit';

// Plus as the account reads it (premium 0122, the client contract as
// built): `my_store`'s `library` and `libraryPlans`, heard with the same
// answer the store reads, and the entitlement row `mayPlayLook` reads. Only
// the network is fake. Where its ending is acted on, with the lapse and the
// record kept: `plusSubscriptionEnding.test.ts`.

const setup = () => {
  const backend = fakeBackend();
  const disk: IDisk = {};
  const clock = { now: NOW };
  return { backend, disk, clock, app: startPlus({ backend, disk, clock }) };
};

describe('Plus against a server from before 0122', () => {
  it('reads nothing about Plus, and plays nothing through it', async () => {
    const { app } = setup();
    await app.signIn();
    expect(app.account.answer()).toEqual({
      aware: false,
      plans: [],
      membership: { kind: 'absent' },
      suspended: false,
    });
    expect(app.account.subscribed()).toBe(false);
    expect(app.account.endConfirmed()).toBe(false);
    expect(app.records.knownPlans()).toEqual([]);
  });
});

describe('Plus from 0122 on', () => {
  it('reads the plans and the subscription from the same my_store answer', async () => {
    const { app, backend } = setup();
    backend.state.aware = true;
    backend.state.row = liveRow();
    backend.state.library = library();
    await app.signIn();
    expect(app.account.answer()).toEqual({
      aware: true,
      plans: PLANS,
      membership: {
        kind: 'present',
        membership: {
          until: new Date(NOW + 30 * DAY).toISOString(),
          renewing: true,
          plan: 'monthly',
        },
      },
      suspended: false,
    });
    expect(app.account.subscribed()).toBe(true);
    // What is on sale is remembered for the window, signed out included.
    expect(app.records.knownPlans()).toEqual(PLANS);
  });

  it('plays every scene through the row: a scene nobody bought plays', async () => {
    const { app, backend } = setup();
    backend.state.aware = true;
    backend.state.row = liveRow();
    backend.state.library = library();
    await app.signIn();
    expect(app.ownership.owns('premium:dune')).toBe(true);
    expect(app.ownership.owns(`member:${OTHER_ID}:glow`)).toBe(true);
  });

  it('an answer with no library while the row still plays it ends nothing: the row is read again, and decides', async () => {
    const { app, backend } = setup();
    backend.state.aware = true;
    backend.state.row = liveRow();
    backend.state.library = library();
    await app.signIn();
    const before = backend.count('GET /rest/v1/entitlements');

    // my_store says none; the row cannot be read just now.
    backend.state.library = undefined;
    backend.state.entitlementsDown = true;
    await app.ownership.refreshNow();
    await app.idle();
    expect(backend.count('GET /rest/v1/entitlements')).toBe(before + 1);
    expect(app.account.subscribed()).toBe(true);
    expect(app.account.endConfirmed()).toBe(false);

    // Ended on the server (a refund ends it at once): the row says so.
    backend.state.entitlementsDown = false;
    backend.state.row = { ...liveRow(), status: 'canceled' };
    const changes = jest.fn();
    app.account.onChange(changes);
    await app.ownership.refreshNow();
    await app.idle();
    expect(app.account.subscribed()).toBe(false);
    expect(app.ownership.owns('premium:dune')).toBe(false);
    expect(changes).toHaveBeenCalled();
    // Stopped, but not yet an ending: the server has said it once.
    expect(app.account.endConfirmed()).toBe(false);
  });

  it('Plus that starts plays once the row says so', async () => {
    const { app, backend } = setup();
    backend.state.aware = true;
    await app.signIn();
    expect(app.account.subscribed()).toBe(false);
    // Never subscribed on this computer: there is nothing to end.
    expect(app.account.endConfirmed()).toBe(false);

    backend.state.row = liveRow();
    backend.state.library = library(NOW + 30 * DAY, { plan: 'yearly' });
    // my_store first (the push, a focus): it disagrees with the row, which
    // is asked again, and the row starts it.
    await app.ownership.refreshNow();
    await app.idle();
    expect(app.account.subscribed()).toBe(true);
    expect(app.account.endConfirmed()).toBe(false);
  });

  it('never takes a failed or offline read for an ending', async () => {
    const { app, backend } = setup();
    backend.state.aware = true;
    backend.state.row = liveRow();
    backend.state.library = library();
    await app.signIn();

    backend.state.storeDown = true;
    await app.ownership.refreshNow();
    backend.state.storeDown = false;
    backend.state.offline = true;
    await app.ownership.refreshNow();
    await app.comeBack();
    expect(app.account.subscribed()).toBe(true);
    expect(app.account.endConfirmed()).toBe(false);
  });

  it('a suspended account plays nothing and shows no Plus, and its suspension is not an ending', async () => {
    const { app, backend } = setup();
    backend.state.aware = true;
    backend.state.row = liveRow();
    backend.state.library = library();
    backend.state.suspended = true;
    await app.signIn();
    expect(app.account.answer()).toMatchObject({
      aware: true,
      plans: [],
      suspended: true,
    });
    expect(app.account.subscribed()).toBe(false);
    expect(app.account.status()).toBeUndefined();
    expect(app.account.endConfirmed()).toBe(false);
  });

  it('a suspended account whose offline grace runs out is no ending either', async () => {
    const { app, backend, clock } = setup();
    backend.state.aware = true;
    backend.state.row = liveRow(NOW + DAY);
    backend.state.library = library(NOW + DAY);
    backend.state.suspended = true;
    await app.signIn();
    backend.state.offline = true;
    clock.now = NOW + 20 * DAY;
    await app.comeBack();
    expect(app.account.endConfirmed()).toBe(false);
  });

  it('a suspended account’s empty plans leave what is remembered on sale as it was', async () => {
    const { app, backend } = setup();
    backend.state.aware = true;
    await app.signIn();
    expect(app.records.knownPlans()).toEqual(PLANS);
    backend.state.suspended = true;
    await app.ownership.refreshNow();
    await app.idle();
    expect(app.records.knownPlans()).toEqual(PLANS);
  });

  it('a server that stops knowing Plus takes the remembered plans with it', async () => {
    const { app, backend } = setup();
    backend.state.aware = true;
    await app.signIn();
    expect(app.records.knownPlans()).toEqual(PLANS);
    backend.state.aware = false;
    await app.ownership.refreshNow();
    await app.idle();
    expect(app.records.knownPlans()).toEqual([]);
  });

  it('an unreadable library is not an ending', async () => {
    const { app, backend } = setup();
    backend.state.aware = true;
    backend.state.row = liveRow();
    backend.state.library = { until: 'soon', renewing: true, plan: 'monthly' };
    await app.signIn();
    expect(app.account.answer()?.membership).toEqual({ kind: 'unreadable' });
    expect(app.account.subscribed()).toBe(true);
    expect(app.account.endConfirmed()).toBe(false);
  });

  it('the offline grace running out, with the server unreachable in this run, is an ending', async () => {
    const { app, backend, clock } = setup();
    backend.state.aware = true;
    backend.state.row = liveRow(NOW + DAY);
    backend.state.library = library(NOW + DAY);
    await app.signIn();
    backend.state.offline = true;

    // The period ends while offline: the grace keeps it on.
    clock.now = NOW + 2 * DAY;
    await app.comeBack();
    expect(app.account.subscribed()).toBe(true);
    expect(app.account.endConfirmed()).toBe(false);

    // Fourteen days from the last confirmation, and the read tried then
    // could not reach the server: it stops, and that ends it.
    clock.now = NOW + 14 * DAY + 1;
    await app.comeBack();
    expect(app.account.subscribed()).toBe(false);
    expect(app.account.endConfirmed()).toBe(true);
  });

  it('the grace running out with the server answering is no ending until it says so', async () => {
    const { app, backend, clock } = setup();
    backend.state.aware = true;
    backend.state.row = liveRow(NOW + DAY);
    backend.state.library = library(NOW + DAY);
    await app.signIn();
    // A download Plus brought: the row is read after each answer only while
    // there is something here its ending would delete.
    app.records.addDownload(ACCOUNT_ID, 'premium:dune');
    // The control of the case above: the server answers this time, with a
    // row its period left behind and no library. Fourteen days past that
    // period it plays no more, and one answer is not yet an ending.
    clock.now = NOW + 16 * DAY;
    backend.state.library = undefined;
    await app.comeBack();
    expect(app.account.subscribed()).toBe(false);
    expect(app.account.endConfirmed()).toBe(false);
    // The second answer, a day later, confirms it.
    clock.now = NOW + 17 * DAY + 1;
    await app.comeBack();
    expect(app.account.endConfirmed()).toBe(true);
  });

  it('Plus cancelled to end with its period stops then, and is an ending once the server has said so twice, a day apart', async () => {
    const { app, backend, clock } = setup();
    backend.state.aware = true;
    backend.state.row = liveRow(NOW + DAY, true);
    backend.state.library = library(NOW + DAY, { renewing: false });
    await app.signIn();
    app.records.addDownload(ACCOUNT_ID, 'premium:dune');
    backend.state.offline = true;
    clock.now = NOW + 2 * DAY;
    await app.comeBack();
    expect(app.account.subscribed()).toBe(false);
    // Cancelled, then offline: only the server's word ends it here.
    expect(app.account.endConfirmed()).toBe(false);

    // Back online: the server says it ended. Once is not yet enough.
    backend.state.offline = false;
    backend.state.library = undefined;
    backend.state.row = { ...liveRow(NOW + DAY, true), status: 'canceled' };
    await app.ownership.refreshNow();
    await app.idle();
    expect(app.account.endConfirmed()).toBe(false);

    clock.now = NOW + 3 * DAY + 1;
    await app.ownership.refreshNow();
    await app.idle();
    expect(app.account.endConfirmed()).toBe(true);
  });

  it("keeps each account's answer its own", async () => {
    const { app, backend } = setup();
    backend.state.aware = true;
    backend.state.row = liveRow();
    backend.state.library = library();
    await app.signIn();
    app.signOut();
    expect(app.account.answer()).toBeUndefined();
    expect(app.account.subscribed()).toBe(false);
    expect(app.account.endConfirmed()).toBe(false);

    backend.state.row = undefined;
    backend.state.library = undefined;
    await app.signIn(OTHER_ID);
    expect(app.account.subscribed()).toBe(false);
    expect(app.account.answer()?.membership).toEqual({ kind: 'absent' });
  });

  it('says how Plus stands: from my_store, else from the row', async () => {
    const { app, backend } = setup();
    backend.state.aware = true;
    backend.state.row = {
      ...liveRow(NOW + 300 * DAY),
      plan: 'library-yearly',
    };
    backend.state.library = library(NOW + 300 * DAY, {
      renewing: false,
      plan: 'yearly',
    });
    await app.signIn();
    expect(app.account.status()).toEqual({
      plan: 'yearly',
      until: new Date(NOW + 300 * DAY).toISOString(),
      renewing: false,
    });

    // A server that sends no library: the row says it.
    backend.state.aware = false;
    await app.ownership.refreshNow();
    await app.idle();
    expect(app.account.status()).toEqual({
      plan: 'yearly',
      until: new Date(NOW + 300 * DAY).toISOString(),
      renewing: true,
    });
  });

  it('says until when the grace holds it on, offline after its period', async () => {
    const { app, backend, clock } = setup();
    backend.state.aware = true;
    backend.state.row = liveRow(NOW + DAY);
    backend.state.library = library(NOW + DAY);
    await app.signIn();
    backend.state.offline = true;
    clock.now = NOW + 2 * DAY;
    await app.comeBack();
    expect(app.account.status()).toMatchObject({
      graceUntil: new Date(NOW + 14 * DAY).toISOString(),
    });
  });

  // An admin account kept a row of the old membership, ended 2026-10-20
  // and never moved since, that read as Plus on every fresh read: Get Plus
  // answered "already subscribed" and Manage found nothing to manage. Only
  // a row of Plus's own plans is Plus, as the server's has_library rules
  // (0122), and a period long over is no renewal in flight.
  it.each([
    ['an old membership row whose period ended', 'plus', NOW - 38 * DAY],
    ['an old membership row still in its period', 'plus', NOW + 20 * DAY],
    ['a gift row', 'gift', NOW + 20 * DAY],
    ['a trial row', 'trial', NOW + 20 * DAY],
    ['a month earned by publishing', 'maker', NOW + 20 * DAY],
    [
      'a Plus row never moved past a period long over',
      'library-monthly',
      NOW - 38 * DAY,
    ],
  ])('is not Plus through %s', async (_name, plan, end) => {
    const { app, backend } = setup();
    backend.state.aware = true;
    backend.state.row = { ...liveRow(end), plan };
    await app.signIn();
    expect(app.account.subscribed()).toBe(false);
    expect(app.account.status()).toBeUndefined();
    expect(app.ownership.owns('premium:dune')).toBe(false);
  });

  it('listens for the server’s word while a checkout is owed, and stops once the answer moves', async () => {
    const { app, backend } = setup();
    backend.state.aware = true;
    await app.signIn(ACCOUNT_ID);
    expect(app.pushes).toHaveLength(1);
    app.account.expectChange();
    expect(app.pushes[0].watching).toBe(true);

    // Paid: the row and my_store move, and nothing is owed any more.
    backend.state.row = liveRow();
    backend.state.library = library();
    await app.comeBack();
    expect(app.account.subscribed()).toBe(true);
    expect(app.pushes[0].watching).toBe(false);
  });

  it('stops listening when the account changes while a checkout is owed', async () => {
    const { app, backend } = setup();
    backend.state.aware = true;
    await app.signIn(ACCOUNT_ID);
    app.account.expectChange();
    expect(app.pushes[0].watching).toBe(true);
    app.signOut();
    expect(app.pushes[0].watching).toBe(false);
  });
});
