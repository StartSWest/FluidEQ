/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import { FLUIDEQ_CREATOR_ID } from '../../../common/plusGallery';
import { createSubscriptionAdds } from '../../../main/account/subscriptionAdds';
import {
  ACCOUNT_ID,
  AUTHOR,
  CONFIG,
  DUNE,
  fakeBackend,
  GLOW,
  library,
  liveRow,
  memoryLogger,
  NOW,
  startPlus,
  type IDisk,
  type IPlusApp,
  type TFakeBackend,
} from '../../utils/plusSubscriptionKit';

// A scene added from Scenes while the account has Plus (premium 0122):
// recorded as Plus's own download when Plus is the only way the account
// plays it, and, for a member's scene, the one claim that earns its maker
// half a credit. The add itself never waits on any of it.

const CLAIM = 'POST /rest/v1/rpc/claim_library_scene';

const addsOver = (app: IPlusApp, backend: TFakeBackend) => {
  const { lines, logger } = memoryLogger();
  const adds = createSubscriptionAdds({
    accountId: () => ACCOUNT_ID,
    subscription: app.account,
    ownership: app.ownership,
    records: app.records,
    auth: async () => ({
      config: CONFIG,
      accessToken: `access-${ACCOUNT_ID}`,
      fetchImpl: backend.fetchImpl,
    }),
    logger,
  });
  return { adds, lines };
};

const setup = async ({ subscribed = true } = {}) => {
  const backend = fakeBackend();
  const disk: IDisk = {};
  const clock = { now: NOW };
  backend.state.aware = true;
  if (subscribed) {
    backend.state.row = liveRow();
    backend.state.library = library();
  }
  const app = startPlus({ backend, disk, clock });
  await app.signIn();
  return { backend, disk, clock, app, ...addsOver(app, backend) };
};

it("claims a member's scene once, on the subscriber's add, and never again", async () => {
  const { adds, backend, app } = await setup();
  await adds.added(GLOW);
  expect(backend.count(CLAIM)).toBe(1);
  expect(backend.bodies.find((each) => each.call === CLAIM)?.body).toEqual({
    p_author: AUTHOR,
    p_scene: 'glow',
  });
  expect(app.records.claimed(ACCOUNT_ID, GLOW)).toBe(true);
  await adds.added(GLOW);
  expect(backend.count(CLAIM)).toBe(1);
});

it('records a scene added through Plus alone as Plus’s download', async () => {
  const { adds, app } = await setup();
  await adds.added(GLOW);
  await adds.added(DUNE);
  expect(app.records.downloads(ACCOUNT_ID)).toEqual([GLOW, DUNE]);
});

it('remembers the claim across a restart', async () => {
  const { adds, backend, disk, clock, app } = await setup();
  await adds.added(GLOW);
  app.stop();
  const again = startPlus({ backend, disk, clock, signedInAs: ACCOUNT_ID });
  await again.launch();
  const { adds: later } = addsOver(again, backend);
  await later.added(GLOW);
  expect(backend.count(CLAIM)).toBe(1);
});

it("claims nothing for FluidEQ's own scenes, a helper's, or the account's own, and records none of its own as Plus's", async () => {
  const helper = 'ab12cd34-0000-4000-8000-0000000000ef';
  const { adds, backend, app } = await setup();
  backend.state.helpers = [helper];
  await app.ownership.refreshNow();
  await adds.added(DUNE);
  await adds.added(`member:${FLUIDEQ_CREATOR_ID}:aurora`);
  await adds.added(`member:${helper}:tide`);
  await adds.added(`member:${ACCOUNT_ID}:mine`);
  expect(backend.count(CLAIM)).toBe(0);
  // The account's own plays without Plus: it is never Plus's to delete.
  expect(app.records.downloads(ACCOUNT_ID)).not.toContain(
    `member:${ACCOUNT_ID}:mine`,
  );
});

it('a scene got with a credit is neither claimed nor recorded', async () => {
  const { adds, backend, app } = await setup();
  backend.state.owned = [{ authorId: AUTHOR, sceneId: 'glow' }];
  await app.ownership.refreshNow();
  await adds.added(GLOW);
  expect(backend.count(CLAIM)).toBe(0);
  expect(app.records.downloads(ACCOUNT_ID)).toEqual([]);
});

it('without Plus, nothing is claimed or recorded', async () => {
  const { adds, backend, app } = await setup({ subscribed: false });
  await adds.added(GLOW);
  expect(backend.count(CLAIM)).toBe(0);
  expect(app.records.downloads(ACCOUNT_ID)).toEqual([]);
});

it('a claim the server did not record is asked again in a later run, not in this one', async () => {
  const { adds, backend, disk, clock, app } = await setup();
  backend.state.claim = { status: 200, body: { claimed: false } };
  await adds.added(GLOW);
  await adds.added(GLOW);
  expect(backend.count(CLAIM)).toBe(1);
  expect(app.records.claimed(ACCOUNT_ID, GLOW)).toBe(false);

  app.stop();
  const again = startPlus({ backend, disk, clock, signedInAs: ACCOUNT_ID });
  await again.launch();
  await addsOver(again, backend).adds.added(GLOW);
  expect(backend.count(CLAIM)).toBe(2);
});

it('a claim that never reached the server is asked again on the next add', async () => {
  const { adds, backend, app, lines } = await setup();
  backend.state.offline = true;
  await expect(adds.added(GLOW)).resolves.toBeUndefined();
  expect(lines.some((line) => line.includes('could not be sent'))).toBe(true);
  // Recorded as Plus's all the same: it is in the looks.
  expect(app.records.downloads(ACCOUNT_ID)).toEqual([GLOW]);
  backend.state.offline = false;
  await adds.added(GLOW);
  expect(backend.count(CLAIM)).toBe(2);
  expect(app.records.claimed(ACCOUNT_ID, GLOW)).toBe(true);
});

it('a refusal is logged, never thrown', async () => {
  const { adds, backend, lines } = await setup();
  backend.state.claim = { status: 403, body: { error: 'not_subscribed' } };
  await expect(adds.added(GLOW)).resolves.toBeUndefined();
  expect(
    lines.some((line) => line.includes('was refused: 403 not_subscribed')),
  ).toBe(true);
});

it('two adds at once send one claim', async () => {
  const { adds, backend } = await setup();
  await Promise.all([adds.added(GLOW), adds.added(GLOW)]);
  expect(backend.count(CLAIM)).toBe(1);
});

it('ignores anything that is not a scene', async () => {
  const { adds, backend, app } = await setup();
  await adds.added('builtin:spectrum');
  await adds.added('member:not-an-id:glow');
  expect(backend.count(CLAIM)).toBe(0);
  expect(app.records.downloads(ACCOUNT_ID)).toEqual([]);
});
