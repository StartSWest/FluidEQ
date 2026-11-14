/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The look picker's scene chips are the gallery's categories, all of them,
 * in the gallery's order (Ivan, 2026-11-13: "not all the categories are
 * there, it must always have all the gallery's categories"). They were only
 * the categories the member's own scenes were filed under, so a member with
 * no retro or 3D scene had no Retro games or 3D worlds chip. A chip with
 * none of the member's scenes says so and leads to that category in the
 * gallery, never a blank list.
 */

const mockOpenGalleryCategory = jest.fn();
jest.mock('../../../renderer/plus/plusNavigation', () => ({
  ...jest.requireActual('../../../renderer/plus/plusNavigation'),
  openGalleryCategory: (category: string) => mockOpenGalleryCategory(category),
}));
jest.mock('../../../renderer/plus/plusTabRequest', () => ({
  requestPlusTab: jest.fn(),
}));
jest.mock('../../../renderer/account/accountStore', () => ({
  useAccount: () => ({ status: 'signed-in' }),
  getAccountSnapshot: () => ({ status: 'signed-in' }),
  subscribeAccount: () => () => undefined,
}));
// The column's way to more scenes reads the gallery's newest page; none here.
jest.mock('../../../renderer/plus/galleryStore', () => ({
  ...jest.requireActual('../../../renderer/plus/galleryStore'),
  useGalleryList: () => ({ list: { scenes: [] } }),
}));
jest.mock('../../../renderer/account/accountPanel', () => ({
  requestAccountPanel: jest.fn(),
}));

/* eslint-disable import/first -- the mocks must be installed first */
import '@testing-library/jest-dom';
import { createRef } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { translate } from 'common/i18n';
import { PLUS_CATEGORIES } from 'common/plusGallery';
import LookPickerBody from 'renderer/graph/LookPickerBody';
import {
  buildStyleRows,
  plusFilters,
  type IPlusRow,
  type TPlusFilter,
} from 'renderer/graph/lookPickerRows';
import { getSelectableLooks } from 'renderer/utils/graphStyle';
import { I18nProvider } from 'renderer/utils/I18nContext';
/* eslint-enable import/first */

const t = (
  key: Parameters<typeof translate>[1],
  vars?: Record<string, string | number>,
) => translate('en', key, vars);

const STYLES = buildStyleRows(getSelectableLooks([], 'signal', [], []), t);

const scene = (over: Partial<IPlusRow> & Pick<IPlusRow, 'id' | 'name'>) => ({
  swatch: ['#000000'],
  maker: 'fluideq' as const,
  categories: ['nature' as const],
  locked: false,
  search: over.name.toLowerCase(),
  ...over,
});

// Nature and water only: no retro scene, no 3D world.
const SCENES: readonly IPlusRow[] = [
  scene({ id: 'scene-alpine', name: 'Alpine' }),
  scene({ id: 'scene-reef', name: 'Reef Light', categories: ['water'] }),
];

const open = (plusFilter: TPlusFilter, onLeave?: () => void) =>
  render(
    <I18nProvider>
      <LookPickerBody
        value={STYLES[0].id}
        styleRows={STYLES}
        plusRows={SCENES}
        query=""
        styleFilter="all"
        plusFilter={plusFilter}
        onQuery={jest.fn()}
        onStyleFilter={jest.fn()}
        onPlusFilter={jest.fn()}
        onChoose={jest.fn()}
        searchRef={createRef<HTMLInputElement>()}
        onLeave={onLeave}
      />
    </I18nProvider>,
  );

beforeEach(() => mockOpenGalleryCategory.mockClear());

it('offers every gallery category, in the gallery’s order, whatever the member has', () => {
  expect(plusFilters(SCENES)).toEqual(['all', ...PLUS_CATEGORIES]);
  // The control: who made them still shows only when there is a choice.
  expect(
    plusFilters([
      ...SCENES,
      scene({ id: 'mine', name: 'Mine', maker: 'mine' }),
    ]),
  ).toEqual(['all', ...PLUS_CATEGORIES, 'mine']);
});

it('shows a chip for each, named as the gallery names them', () => {
  open('all');
  const chips = within(screen.getByRole('region', { name: 'Scenes' }))
    .getAllByRole('button')
    .map((chip) => chip.textContent);
  PLUS_CATEGORIES.forEach((category) =>
    expect(chips).toContain(t(`plus.category.${category}` as never)),
  );
});

it('says a category holds none of the member’s scenes, and leads to it in the gallery', () => {
  const leave = jest.fn();
  open('retro-games', leave);
  const column = within(screen.getByRole('region', { name: 'Scenes' }));
  expect(
    column.getByText('None of your scenes are in this category yet.'),
  ).toBeInTheDocument();
  fireEvent.click(
    column.getByRole('button', { name: 'See this category in the gallery' }),
  );
  expect(mockOpenGalleryCategory).toHaveBeenCalledWith('retro-games');
  expect(leave).toHaveBeenCalled();
});

it('lists the member’s scenes under a category that holds some', () => {
  open('water');
  const column = within(screen.getByRole('region', { name: 'Scenes' }));
  expect(column.getByText('Reef Light')).toBeInTheDocument();
  // The control: the empty line is for an empty category only.
  expect(
    column.queryByText('None of your scenes are in this category yet.'),
  ).toBeNull();
});
