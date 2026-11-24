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
 */

import { translate } from 'common/i18n';
import { memberLookId } from 'common/memberScenes';
import { buildPlusRows } from 'renderer/graph/lookPickerRows';
import {
  withoutOfficialCopies,
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
  }) as unknown as IUsableMemberScene;

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

it('is one rule for every list that walks the scenes', () => {
  const copy = member(ME, 'alpine', true);
  const mine = member(ME, 'balloon-dawn', true);
  expect(withoutOfficialCopies([copy, mine], new Set(['alpine']))).toEqual([
    mine,
  ]);
  // Only an own copy: with no official list, nothing is left out.
  expect(withoutOfficialCopies([copy, mine], new Set())).toEqual([copy, mine]);
});
