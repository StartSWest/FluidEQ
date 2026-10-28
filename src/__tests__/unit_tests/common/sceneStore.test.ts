/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { memberLookId } from 'common/memberScenes';
import { FLUIDEQ_CREATOR_ID } from 'common/plusGallery';
import { premiumLookId } from 'common/scenePacks';
import {
  buyFailureOf,
  formatPackPrice,
  isSceneStore,
  lookIdOfOwned,
  mayPlayAnything,
  mayPlayLook,
  parseSceneStore,
  type ISceneStore,
} from 'common/sceneStore';

const ME = '4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30';
const ADA = '0b6e3f2a-3c1d-4e5f-8a9b-1c2d3e4f5a6b';

const answer = (over: Record<string, unknown> = {}) => ({
  balance: 4,
  starterClaimed: true,
  owned: [
    { authorId: FLUIDEQ_CREATOR_ID, sceneId: 'alpine' },
    { authorId: ADA, sceneId: 'neon-city' },
  ],
  packs: [
    { id: 'pack-5', credits: 5, priceCents: 499 },
    { id: 'pack-12', credits: 12, priceCents: 999 },
  ],
  ...over,
});

describe('the store as the server answers it', () => {
  it('reads balance, starter, the scenes owned as look ids and the packs on sale', () => {
    expect(parseSceneStore(answer({ published: ['my-scene'] }))).toEqual({
      balance: 4,
      starterClaimed: true,
      owned: [premiumLookId('alpine'), memberLookId(ADA, 'neon-city')],
      packs: [
        { id: 'pack-5', credits: 5, priceCents: 499 },
        { id: 'pack-12', credits: 12, priceCents: 999 },
      ],
      published: ['my-scene'],
    });
  });

  it('keeps a negative balance as it is: a refund after the credit was spent', () => {
    expect(parseSceneStore(answer({ balance: -1 }))?.balance).toBe(-1);
  });

  it.each([
    ['a balance that is not whole', { balance: 1.5 }],
    ['a missing starter flag', { starterClaimed: undefined }],
    ['an owned row with no scene', { owned: [{ authorId: ADA }] }],
    [
      'an owned scene id that is no scene id',
      { owned: [{ authorId: ADA, sceneId: '../x' }] },
    ],
    [
      'a FluidEQ scene id that is no pack id',
      { owned: [{ authorId: FLUIDEQ_CREATOR_ID, sceneId: 'Bad Id' }] },
    ],
    [
      'a pack with no price',
      { packs: [{ id: 'pack-5', credits: 5, priceCents: 0 }] },
    ],
    [
      'a pack id the store never sells',
      { packs: [{ id: 'gift', credits: 5, priceCents: 499 }] },
    ],
    ['published names that are no scene ids', { published: ['../etc'] }],
    ['a half credit that is no yes or no', { halfCredit: 'half' }],
  ])('refuses the whole answer for %s, never part of it', (_what, over) => {
    expect(parseSceneStore(answer(over))).toBeUndefined();
  });

  it('says half a credit waits only when the server says so (premium 0072)', () => {
    expect(parseSceneStore(answer({ halfCredit: true }))?.halfCredit).toBe(
      true,
    );
    // Nothing waiting, and a server before 0072, both leave it out.
    expect(parseSceneStore(answer({ halfCredit: false }))).not.toHaveProperty(
      'halfCredit',
    );
    expect(parseSceneStore(answer())).not.toHaveProperty('halfCredit');
  });

  it('checks a store handed across the window the same way', () => {
    const store = parseSceneStore(answer()) as ISceneStore;
    expect(isSceneStore(store)).toBe(true);
    expect(isSceneStore({ ...store, halfCredit: true })).toBe(true);
    expect(isSceneStore({ ...store, owned: ['premium:Bad Id'] })).toBe(false);
    expect(isSceneStore({ ...store, balance: '4' })).toBe(false);
    expect(isSceneStore({ ...store, halfCredit: 1 })).toBe(false);
  });

  it('names a FluidEQ scene by its look and a member’s by theirs, any case of the author', () => {
    expect(lookIdOfOwned(FLUIDEQ_CREATOR_ID, 'alpine')).toBe(
      premiumLookId('alpine'),
    );
    expect(lookIdOfOwned(ADA.toUpperCase(), 'neon-city')).toBe(
      memberLookId(ADA, 'neon-city'),
    );
    expect(lookIdOfOwned(ADA, 'Not An Id')).toBeUndefined();
  });

  it('turns the server’s refusals into the app’s words, and anything else into server', () => {
    expect(buyFailureOf('no_credits')).toBe('no-credits');
    expect(buyFailureOf('already_owned')).toBe('already-owned');
    expect(buyFailureOf('negative_balance')).toBe('negative-balance');
    expect(buyFailureOf('something new')).toBe('server');
  });

  it('prices a pack in dollars in the reader’s own format', () => {
    expect(formatPackPrice(499, 'en-US')).toBe('$4.99');
    expect(formatPackPrice(1999, 'de-DE')).toMatch(/^19,99\s\$$/);
  });
});

describe('which scenes play', () => {
  const store = parseSceneStore(
    answer({ published: ['mine-out'] }),
  ) as ISceneStore;
  const play = (lookId: string, plus: boolean, of = store) =>
    mayPlayLook({ lookId, accountId: ME, plus, store: of });

  it('plays nothing to somebody signed out, Plus or not', () => {
    expect(
      mayPlayLook({
        lookId: premiumLookId('alpine'),
        accountId: undefined,
        plus: true,
        store,
      }),
    ).toBe(false);
  });

  it('plays a scene bought, and not one that was not, without Plus', () => {
    expect(play(premiumLookId('alpine'), false)).toBe(true);
    expect(play(memberLookId(ADA, 'neon-city'), false)).toBe(true);
    expect(play(premiumLookId('aurora'), false)).toBe(false);
    expect(play(memberLookId(ADA, 'other'), false)).toBe(false);
  });

  it('plays every scene of anybody else while Plus lasts', () => {
    expect(play(premiumLookId('aurora'), true)).toBe(true);
    expect(play(memberLookId(ADA, 'other'), true)).toBe(true);
  });

  // Ivan, 2026-10-21: "no need to publish to run on grahp" — a maker tests a
  // scene on the graph until it is done, and publishes it to earn from it.
  it('plays a maker’s own scene, published or still a draft, Plus or not', () => {
    expect(play(memberLookId(ME, 'mine-out'), false)).toBe(true);
    expect(play(memberLookId(ME, 'mine-draft'), false)).toBe(true);
    expect(play(memberLookId(ME, 'mine-draft'), true)).toBe(true);
    // The control: another maker's draft of the same id is not theirs.
    expect(play(memberLookId(ADA, 'mine-draft'), false)).toBe(false);
  });

  it('plays a maker’s own scene whether or not the server has said what is published', () => {
    const older = { ...store, published: undefined };
    expect(play(memberLookId(ME, 'mine-draft'), false, older)).toBe(true);
    expect(play(memberLookId(ADA, 'mine-draft'), false, older)).toBe(false);
  });

  it('plays a FluidEQ scene made free for everyone signed in, and never a member scene by that list', () => {
    const freed = { ...store, owned: [], free: ['aurora', 'other'] };
    expect(play(premiumLookId('aurora'), false, freed)).toBe(true);
    // The control: a FluidEQ scene not on the list still needs getting.
    expect(play(premiumLookId('ember'), false, freed)).toBe(false);
    // The list names FluidEQ's scenes; a member scene of the same id is not one.
    expect(play(memberLookId(ADA, 'other'), false, freed)).toBe(false);
    expect(
      mayPlayLook({
        lookId: premiumLookId('aurora'),
        accountId: undefined,
        plus: false,
        store: freed,
      }),
    ).toBe(false);
  });

  it('plays every scene for the admin, other makers’ drafts included', () => {
    const admin = { ...store, owned: [], published: [], everything: true };
    expect(play(premiumLookId('ember'), false, admin)).toBe(true);
    expect(play(memberLookId(ADA, 'other'), false, admin)).toBe(true);
    expect(play(memberLookId(ADA, 'a-draft'), false, admin)).toBe(true);
    // The control: the same store without the flag plays none of them.
    const plain = { ...admin, everything: undefined };
    expect(play(premiumLookId('ember'), false, plain)).toBe(false);
    expect(play(memberLookId(ADA, 'other'), false, plain)).toBe(false);
    expect(play(memberLookId(ADA, 'a-draft'), false, plain)).toBe(false);
  });

  const anything = (
    plus: boolean,
    over: ISceneStore | undefined,
    held: readonly string[] = [],
  ) => mayPlayAnything({ accountId: ME, plus, store: over, held });

  it('says whether anything plays at all, for the lights', () => {
    expect(anything(true, undefined)).toBe(true);
    expect(anything(false, undefined)).toBe(false);
    expect(anything(false, { ...store, owned: [], published: [] })).toBe(false);
    expect(anything(false, { ...store, owned: [] })).toBe(true);
    expect(anything(false, { ...store, published: [] })).toBe(true);
    // Nobody signed in plays nothing, whatever a store says.
    expect(
      mayPlayAnything({
        accountId: undefined,
        plus: true,
        store,
        held: [memberLookId(ME, 'mine')],
      }),
    ).toBe(false);
  });

  // Ivan, 2026-10-27: a creator publishes and uses the scene at once; only
  // the gallery and its credits wait for the admin. The graph already played
  // it, while the lighting switch said no scene was theirs.
  it('lights the lamps for a maker whose only scene is their own, waiting for review', () => {
    const nothing = { ...store, owned: [], published: [], free: [] };
    expect(anything(false, nothing, [memberLookId(ME, 'in-review')])).toBe(
      true,
    );
    expect(anything(false, undefined, [memberLookId(ME, 'never-sent')])).toBe(
      true,
    );
    // The control: another maker's scene held here is not this account's.
    expect(anything(false, nothing, [memberLookId(ADA, 'in-review')])).toBe(
      false,
    );
    expect(anything(false, nothing, [])).toBe(false);
  });
});
