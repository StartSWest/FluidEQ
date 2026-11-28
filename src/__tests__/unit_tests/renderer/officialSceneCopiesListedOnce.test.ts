/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Ivan, 2026-11-23: "why they show duplicated???". Publishing keeps a scene
 * as its publisher's own look as well, so the account that publishes
 * FluidEQ's own scenes saw each one twice in the look picker: FluidEQ's row
 * and its own copy, under the same name. The copy is left out, and FluidEQ's
 * row stands for it. Beside it, what must stay: the member's own scenes that
 * are not FluidEQ's, and anything another member sent.
 *
 * Ivan, 2026-11-28: "add to my looks of non published scene is not working".
 * A copy the publisher keeps from the Studio's bench - changes the gallery
 * does not have yet - was left out the same way, so FluidEQ's row went on
 * playing the published version. That copy is listed once, in FluidEQ's
 * row's place, unless FluidEQ's version held is newer than it.
 */

import { translate } from 'common/i18n';
import { memberLookId } from 'common/memberScenes';
import { buildPlusRows } from 'renderer/graph/lookPickerRows';
import {
  listedLookOf,
  withoutOfficialCopies,
  withoutStoodInFor,
  type IUsableMemberScene,
} from 'renderer/utils/memberScenes';
import type { IUsableScene } from 'renderer/utils/scenePacks';

const ME = 'faaed582-d6f4-4e70-999b-86e8518a7dc4';
const OTHER = '40000000-0000-4000-8000-0000000000bb';

const t = (
  key: Parameters<typeof translate>[1],
  vars?: Record<string, string | number>,
) => translate('en', key, vars);

const official = {
  id: 'alpine',
  lookId: 'premium:alpine',
  version: 83,
  names: { en: 'Alpine' },
  swatch: ['#000000', '#ffffff'],
} as unknown as IUsableScene;

const member = (
  authorId: string,
  packId: string,
  own: boolean,
  over: Partial<IUsableMemberScene> = {},
): IUsableMemberScene =>
  ({
    kind: 'member',
    lookId: memberLookId(authorId, packId),
    authorId,
    packId,
    version: 83,
    names: { en: packId },
    swatch: ['#000000', '#ffffff'],
    own,
    ...over,
  }) as unknown as IUsableMemberScene;

/** The publisher's copy kept from the Studio, as "Add to my looks" keeps it. */
const benchCopy = (version = 83) =>
  member(ME, 'alpine', true, { version, fromBench: true });

const rows = (members: IUsableMemberScene[]) =>
  buildPlusRows({
    usable: [official],
    locked: [],
    members,
    lockedMembers: [],
    locale: 'en',
    t,
    findInGallery: () => undefined,
  });

it('lists one of FluidEQ’s scenes once, never beside its publisher’s copy', () => {
  const listed = rows([member(ME, 'alpine', true)]);
  expect(listed.map((row) => row.id)).toEqual(['premium:alpine']);
});

it('keeps the member’s own scenes that are not FluidEQ’s, and other members’', () => {
  const mine = member(ME, 'balloon-dawn', true);
  const theirs = member(OTHER, 'tesla-coil', false);
  expect(rows([mine, theirs]).map((row) => row.id)).toEqual([
    'premium:alpine',
    mine.lookId,
    theirs.lookId,
  ]);
});

it('lists the copy kept from the Studio once, in FluidEQ’s row’s place', () => {
  const copy = benchCopy();
  const listed = rows([copy]);
  // The control is the first case: the same copy kept as published is
  // left out. Kept from the bench, choosing the row plays the copy.
  expect(listed.map((row) => row.id)).toEqual([copy.lookId]);
  // Filed under Yours and under FluidEQ alike, with FluidEQ's category.
  expect(listed[0]).toEqual(
    expect.objectContaining({
      maker: 'mine',
      alsoFluidEQ: true,
      locked: false,
      version: 83,
    }),
  );
  expect(listed[0].categories.length).toBeGreaterThan(0);
});

it('lists the copy in place of FluidEQ’s locked row too', () => {
  const copy = benchCopy();
  const listed = buildPlusRows({
    usable: [],
    locked: [
      {
        id: 'alpine',
        lookId: 'locked:premium:alpine',
        names: { en: 'Alpine' },
        swatch: ['#000000', '#ffffff'],
      },
    ],
    members: [copy],
    lockedMembers: [],
    locale: 'en',
    t,
    findInGallery: () => undefined,
  });
  expect(listed.map((row) => row.id)).toEqual([copy.lookId]);
});

it('keeps FluidEQ’s row when its version is newer than the copy kept', () => {
  // Published again from another computer after this one kept its copy.
  const listed = rows([benchCopy(82)]);
  expect(listed.map((row) => row.id)).toEqual(['premium:alpine']);
});

it('is one rule for every list that walks the scenes', () => {
  const copy = member(ME, 'alpine', true);
  const mine = member(ME, 'balloon-dawn', true);
  expect(withoutOfficialCopies([copy, mine], [official])).toEqual([mine]);
  // Only an own copy: with no official list, nothing is left out.
  expect(withoutOfficialCopies([copy, mine], [])).toEqual([copy, mine]);
  // A copy from the bench stays, and FluidEQ's own gives way to it.
  const kept = benchCopy();
  expect(withoutOfficialCopies([kept, mine], [official])).toEqual([kept, mine]);
  expect(withoutStoodInFor([official], [kept, mine])).toEqual([]);
  expect(withoutStoodInFor([official], [copy, mine])).toEqual([official]);
  // Another member's scene under the same pack id stands in for nothing.
  const theirs = member(OTHER, 'alpine', false, { fromBench: true });
  expect(withoutStoodInFor([official], [theirs])).toEqual([official]);
});

it('names the listed row for either selection', () => {
  const kept = benchCopy();
  // FluidEQ's version playing is shown as the copy listed in its place.
  expect(listedLookOf('premium:alpine', [kept], [official])).toBe(kept.lookId);
  expect(listedLookOf(kept.lookId, [kept], [official])).toBe(kept.lookId);
  // A copy kept as published is still FluidEQ's row.
  const published = member(ME, 'alpine', true);
  expect(listedLookOf(published.lookId, [published], [official])).toBe(
    'premium:alpine',
  );
  expect(listedLookOf('premium:alpine', [published], [official])).toBe(
    'premium:alpine',
  );
});
