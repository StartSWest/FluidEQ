/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import {
  ACCOUNT_ID,
  DAY,
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

// The seam where Plus's ending is decided and acted on: the real account
// view over a fake of the server as built, the real lapse, the real record
// kept across restarts, and only the deletion faked. The ruling (ported
// from FluidWallpapers): Plus's downloads are deleted only once the server
// has confirmed the end — a fresh answer with no library after the period
// ended, confirmed by a second one a day later, the row agreeing — or once
// the offline grace ran out while the server could not be reached. A
// missing or late answer never deletes, and a paying subscriber never loses
// a scene at a renewal.

/** A subscriber whose period ends at `end`, with two scenes added through Plus. */
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
  expect(app.account.subscribed()).toBe(true);
  app.records.addDownload(ACCOUNT_ID, GLOW);
  app.records.addDownload(ACCOUNT_ID, DUNE);
  return { backend, disk, clock, app };
};

/** The app started again over the same disk, still signed in. */
const restart = ({
  app,
  backend,
  disk,
  clock,
}: {
  app: IPlusApp;
  backend: ReturnType<typeof fakeBackend>;
  disk: IDisk;
  clock: { now: number };
}) => {
  app.stop();
  return startPlus({ backend, disk, clock, signedInAs: ACCOUNT_ID });
};

/** Nothing deleted and no offer: the subscriber keeps it all. */
const keptEverything = (app: IPlusApp) => {
  expect(app.account.endConfirmed()).toBe(false);
  expect(app.removed).toEqual([]);
  expect(app.records.downloads(ACCOUNT_ID)).toEqual([GLOW, DUNE]);
  expect(app.records.lapse(ACCOUNT_ID)).toBeUndefined();
};

/** Both downloads deleted, and offered back. */
const deletedBoth = (app: IPlusApp) => {
  expect(app.account.endConfirmed()).toBe(true);
  expect(app.removed).toEqual([[GLOW, DUNE]]);
  expect(app.records.downloads(ACCOUNT_ID)).toEqual([]);
  expect(
    app.records.lapse(ACCOUNT_ID)?.scenes.map((scene) => scene.lookId),
  ).toEqual([GLOW, DUNE]);
};

describe('the ending: a renewal', () => {
  it("answers read before Stripe's notice lands end nothing, however long it takes", async () => {
    const { backend, clock, app } = await subscriber({ end: NOW + DAY });

    // Stripe renewed at the period's end; its notice has not reached the
    // server: the row still has the old period, my_store no library.
    clock.now = NOW + DAY + 2 * 60 * 1000;
    backend.state.library = undefined;
    await app.comeBack();
    expect(app.account.subscribed()).toBe(true);
    keptEverything(app);

    // Days later, the notice still lost: still nothing.
    clock.now = NOW + 4 * DAY;
    await app.comeBack();
    clock.now = NOW + 6 * DAY;
    await app.comeBack();
    expect(app.account.subscribed()).toBe(true);
    keptEverything(app);

    // The notice lands: renewed, as it was all along.
    backend.state.row = liveRow(NOW + 31 * DAY);
    backend.state.library = library(NOW + 31 * DAY);
    await app.comeBack();
    expect(app.account.subscribed()).toBe(true);
    keptEverything(app);
  });
});

describe('the ending: a stale or failed read', () => {
  it('a my_store answer whose row read failed, or no answer at all, ends nothing', async () => {
    const { backend, clock, app } = await subscriber({ end: NOW + DAY });
    clock.now = NOW + 2 * DAY;
    backend.state.library = undefined;
    backend.state.entitlementsDown = true;
    await app.comeBack();
    clock.now = NOW + 4 * DAY;
    await app.comeBack();
    backend.state.entitlementsDown = false;
    backend.state.offline = true;
    clock.now = NOW + 6 * DAY;
    await app.comeBack();
    // Still in its grace: it plays on, and nothing is gone.
    expect(app.account.subscribed()).toBe(true);
    keptEverything(app);
  });
});

describe('the ending: a start-up', () => {
  it('with a record weeks old, the server is asked first: a renewal it missed ends nothing', async () => {
    const setupDone = await subscriber({ end: NOW + DAY });
    const { backend, clock } = setupDone;

    // Three weeks with the computer off; Plus renewed as usual.
    clock.now = NOW + 21 * DAY;
    backend.state.row = liveRow(NOW + 31 * DAY);
    backend.state.library = library(NOW + 31 * DAY);
    const again = restart(setupDone);
    // Before anything is read, the record kept is past its grace: that is
    // no ending.
    expect(again.account.endConfirmed()).toBe(false);
    await again.idle();
    keptEverything(again);

    await again.launch();
    expect(again.account.subscribed()).toBe(true);
    keptEverything(again);
  });

  it('offline within its grace, nothing ends', async () => {
    const setupDone = await subscriber({ end: NOW + DAY });
    const { backend, clock } = setupDone;
    clock.now = NOW + 10 * DAY;
    backend.state.offline = true;
    const again = restart(setupDone);
    await again.launch();
    expect(again.account.subscribed()).toBe(true);
    keptEverything(again);
  });

  it('offline past its grace, it ends once a read in this run could not reach the server; back online, it plays again', async () => {
    const setupDone = await subscriber({ end: NOW + DAY });
    const { backend, clock } = setupDone;
    clock.now = NOW + 21 * DAY;
    backend.state.offline = true;
    const again = restart(setupDone);
    expect(again.account.endConfirmed()).toBe(false);
    await again.idle();
    keptEverything(again);

    // The launch read cannot reach the server: the grace has run out while
    // it was unreachable, the one ending acted on without its word.
    await again.launch();
    deletedBoth(again);

    // Back online: it had renewed. It plays again, and the offer goes.
    backend.state.offline = false;
    backend.state.row = liveRow(NOW + 31 * DAY);
    backend.state.library = library(NOW + 31 * DAY);
    await again.comeBack();
    expect(again.account.subscribed()).toBe(true);
    expect(again.records.lapse(ACCOUNT_ID)).toBeUndefined();
  });
});

describe('the ending: the server says so', () => {
  it('twice, a day apart, after the period ended, with the row agreeing: then it is acted on', async () => {
    const { backend, clock, app } = await subscriber({
      end: NOW + DAY,
      cancelled: true,
    });

    // The period ends, and Stripe ends it: the row says so, my_store too.
    clock.now = NOW + DAY + HOUR;
    backend.state.row = { ...liveRow(NOW + DAY, true), status: 'canceled' };
    backend.state.library = undefined;
    await app.comeBack();
    // It stops playing at once; one answer is not yet an ending.
    expect(app.account.subscribed()).toBe(false);
    expect(app.ownership.owns(GLOW)).toBe(false);
    keptEverything(app);

    // Not a day later: still not.
    clock.now = NOW + DAY + 20 * HOUR;
    await app.comeBack();
    keptEverything(app);

    // More than a day after the first: confirmed.
    clock.now = NOW + 2 * DAY + 2 * HOUR;
    await app.comeBack();
    deletedBoth(app);
    expect(
      app.lines.some((line) =>
        line.includes('Plus ended: 2 scene(s) it played stopped'),
      ),
    ).toBe(true);
  });

  it('the second answer may come in a later run: the first is kept on disk', async () => {
    const setupDone = await subscriber({ end: NOW + DAY, cancelled: true });
    const { backend, clock, app } = setupDone;
    clock.now = NOW + DAY + HOUR;
    backend.state.row = { ...liveRow(NOW + DAY, true), status: 'canceled' };
    backend.state.library = undefined;
    await app.comeBack();
    keptEverything(app);

    clock.now = NOW + 3 * DAY;
    const again = restart(setupDone);
    // Not before this run has heard the server itself.
    expect(again.account.endConfirmed()).toBe(false);
    await again.launch();
    deletedBoth(again);
  });

  it('an answer with Plus between the two starts the wait again', async () => {
    const { backend, clock, app } = await subscriber({
      end: NOW + DAY,
      cancelled: true,
    });
    clock.now = NOW + DAY + HOUR;
    backend.state.row = { ...liveRow(NOW + DAY, true), status: 'canceled' };
    backend.state.library = undefined;
    await app.comeBack();

    // Plus again (in FluidWallpapers, say), then ended again.
    clock.now = NOW + DAY + 12 * HOUR;
    backend.state.row = liveRow(NOW + 31 * DAY);
    backend.state.library = library(NOW + 31 * DAY);
    await app.comeBack();
    clock.now = NOW + 2 * DAY + 2 * HOUR;
    backend.state.row = { ...liveRow(NOW + 31 * DAY), status: 'canceled' };
    backend.state.library = undefined;
    await app.comeBack();
    // Stopped again at once; the day's wait started over with the renewal.
    expect(app.account.subscribed()).toBe(false);
    keptEverything(app);
  });

  // A subscription that ends early is cancelled in Stripe at once, so its
  // row's status is no longer a paid one. That ends it without waiting for
  // the period it would have run to (months, for a yearly one): the wait for
  // the second answer starts with the first.
  it.each([
    ['a full refund', NOW + 300 * DAY],
    ['a dispute', NOW + 300 * DAY],
    ["the account's deletion, which cancels it first", NOW + 25 * DAY],
  ])(
    'ending early by %s: play stops at once, and its downloads go a day later',
    async (_how, end) => {
      const { backend, clock, app } = await subscriber({ end });
      clock.now = NOW + HOUR;
      backend.state.row = { ...liveRow(end), status: 'canceled' };
      backend.state.library = undefined;
      await app.comeBack();
      expect(app.account.subscribed()).toBe(false);
      keptEverything(app);

      // Not a day later: still one answer only.
      clock.now = NOW + 20 * HOUR;
      await app.comeBack();
      keptEverything(app);

      // A day after the first: confirmed, months before its period's end.
      clock.now = NOW + DAY + 2 * HOUR;
      await app.comeBack();
      deletedBoth(app);
    },
  );

  it('once nothing is left to delete, a store read no longer reads the row as well', async () => {
    const { backend, clock, app } = await subscriber({ end: NOW + 300 * DAY });
    clock.now = NOW + HOUR;
    backend.state.row = { ...liveRow(NOW + 300 * DAY), status: 'canceled' };
    backend.state.library = undefined;
    await app.comeBack();
    // While its downloads are still here, each answer is checked by the row.
    const asked = () => backend.count('GET /rest/v1/entitlements');
    let before = asked();
    await app.ownership.refreshNow();
    await app.idle();
    expect(asked()).toBe(before + 1);

    clock.now = NOW + DAY + 2 * HOUR;
    await app.comeBack();
    expect(app.records.downloads(ACCOUNT_ID)).toEqual([]);
    before = asked();
    await app.ownership.refreshNow();
    await app.idle();
    expect(asked()).toBe(before);
  });

  it('a row still paid for (its card being retried) starts no early wait', async () => {
    const { backend, clock, app } = await subscriber({ end: NOW + 20 * DAY });
    // my_store has no library for a moment; the row is past_due, which
    // Stripe still counts as paid while it retries the card.
    clock.now = NOW + HOUR;
    backend.state.row = { ...liveRow(NOW + 20 * DAY), status: 'past_due' };
    backend.state.library = undefined;
    await app.comeBack();
    clock.now = NOW + 2 * DAY;
    await app.comeBack();
    clock.now = NOW + 4 * DAY;
    await app.comeBack();
    expect(app.account.subscribed()).toBe(true);
    keptEverything(app);
  });

  it('a scene got with a credit since is kept, and leaves the offer', async () => {
    const { backend, clock, app } = await subscriber({
      end: NOW + DAY,
      cancelled: true,
    });
    // Glow is bought while Plus still runs: it is the account's for good.
    backend.state.owned = [{ authorId: GLOW.split(':')[1], sceneId: 'glow' }];
    clock.now = NOW + DAY + HOUR;
    backend.state.row = { ...liveRow(NOW + DAY, true), status: 'canceled' };
    backend.state.library = undefined;
    await app.comeBack();
    clock.now = NOW + 2 * DAY + 2 * HOUR;
    await app.comeBack();
    expect(app.account.endConfirmed()).toBe(true);
    expect(app.removed).toEqual([[DUNE]]);
    expect(app.ownership.owns(GLOW)).toBe(true);
    expect(
      app.records.lapse(ACCOUNT_ID)?.scenes.map((scene) => scene.lookId),
    ).toEqual([DUNE]);
  });

  it('a suspended account is never acted on, whatever the server says', async () => {
    const { backend, clock, app } = await subscriber({
      end: NOW + DAY,
      cancelled: true,
    });
    backend.state.suspended = true;
    clock.now = NOW + DAY + HOUR;
    backend.state.row = { ...liveRow(NOW + DAY, true), status: 'canceled' };
    await app.comeBack();
    clock.now = NOW + 3 * DAY;
    await app.comeBack();
    // It plays nothing, and its downloads wait for the suspension's end.
    expect(app.account.subscribed()).toBe(false);
    keptEverything(app);
  });

  it('Plus again puts the offer away', async () => {
    const { backend, clock, app } = await subscriber({
      end: NOW + DAY,
      cancelled: true,
    });
    clock.now = NOW + DAY + HOUR;
    backend.state.row = { ...liveRow(NOW + DAY, true), status: 'canceled' };
    backend.state.library = undefined;
    await app.comeBack();
    clock.now = NOW + 2 * DAY + 2 * HOUR;
    await app.comeBack();
    expect(app.records.lapse(ACCOUNT_ID)).toBeDefined();

    backend.state.row = liveRow(NOW + 40 * DAY);
    backend.state.library = library(NOW + 40 * DAY);
    await app.comeBack();
    expect(app.account.subscribed()).toBe(true);
    expect(app.records.lapse(ACCOUNT_ID)).toBeUndefined();
  });
});
