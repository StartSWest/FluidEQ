/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The look picker's rail holds every one of the gallery's categories, in
 * the gallery's order (Ivan, 2026-11-13: "it must always have all the
 * gallery's categories"), and never a maker: who made a scene is the From
 * tabs' (Ivan, 2026-11-19: "made by you, made by FluidEQ ... I don't know").
 * A category with none of the member's scenes says so and leads to that
 * category in the gallery, never a blank grid.
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
import type { TPickerPlace } from 'renderer/graph/lookPickerFilter';
import { buildStyleRows, type IPlusRow } from 'renderer/graph/lookPickerRows';
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

// Nature and water only: no retro scene, no 3D world. One of the member's own.
const SCENES: readonly IPlusRow[] = [
  scene({ id: 'scene-alpine', name: 'Alpine' }),
  scene({ id: 'scene-reef', name: 'Reef Light', categories: ['water'] }),
  scene({ id: 'scene-mine', name: 'Balloon Dawn', maker: 'mine' }),
];

const open = (
  place: TPickerPlace,
  onLeave?: () => void,
  onPlace = jest.fn(),
) => {
  render(
    <I18nProvider>
      <LookPickerBody
        value={STYLES[0].id}
        styleRows={STYLES}
        plusRows={SCENES}
        query=""
        place={place}
        from="all"
        view="grid"
        onQuery={jest.fn()}
        onPlace={onPlace}
        onFrom={jest.fn()}
        onSort={jest.fn()}
        onView={jest.fn()}
        onChoose={jest.fn()}
        searchRef={createRef<HTMLInputElement>()}
        onLeave={onLeave}
      />
    </I18nProvider>,
  );
  return onPlace;
};

const rail = () =>
  within(screen.getByRole('navigation', { name: t('graph.picker.places') }));
const looks = (place: string) =>
  within(screen.getByRole('region', { name: place }));

beforeEach(() => mockOpenGalleryCategory.mockClear());

it('names every gallery category in the rail, in the gallery’s order, with its count', () => {
  open('everything');
  const names = rail()
    .getAllByRole('button')
    .map((place) => place.getAttribute('title'));
  const categories = PLUS_CATEGORIES.map((category) =>
    t(`plus.category.${category}` as never),
  );
  expect(names.filter((name) => categories.includes(name ?? ''))).toEqual(
    categories,
  );
  // Nature holds Alpine and Balloon Dawn; Retro games nothing yet.
  expect(rail().getByRole('button', { name: /Nature/ })).toHaveTextContent('2');
  expect(rail().getByRole('button', { name: /Retro games/ })).toHaveTextContent(
    '0',
  );
});

it('never files a maker among the places', () => {
  open('everything');
  [t('graph.member.mine'), t('graph.member.theirs')].forEach((maker) =>
    expect(rail().queryByRole('button', { name: maker })).toBeNull(),
  );
  // The control: the maker is still offered, as a From tab.
  expect(
    screen.getByRole('group', { name: t('graph.picker.from') }),
  ).toHaveTextContent(t('graph.picker.yours'));
});

it('opens a place from the rail', () => {
  const onPlace = open('everything');
  fireEvent.click(rail().getByRole('button', { name: /Water/ }));
  expect(onPlace).toHaveBeenCalledWith('water');
});

it('says a category holds none of the member’s scenes, and leads to it in the gallery', () => {
  const leave = jest.fn();
  open('retro-games', leave);
  const place = looks(t('plus.category.retro-games'));
  expect(
    place.getByText('None of your scenes are in this category yet.'),
  ).toBeInTheDocument();
  fireEvent.click(
    place.getByRole('button', { name: 'See this category in the gallery' }),
  );
  expect(mockOpenGalleryCategory).toHaveBeenCalledWith('retro-games');
  expect(leave).toHaveBeenCalled();
});

it('shows only the scenes a category holds', () => {
  open('water');
  const place = looks(t('plus.category.water'));
  expect(place.getByText('Reef Light')).toBeInTheDocument();
  expect(place.queryByText('Alpine')).toBeNull();
  // The control: the empty line is for an empty category only.
  expect(
    place.queryByText('None of your scenes are in this category yet.'),
  ).toBeNull();
});
