/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { createRef } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { translate } from 'common/i18n';
import LookPickerBody from 'renderer/graph/LookPickerBody';
import {
  buildStyleRows,
  type IPlusRow,
  type IStyleRow,
} from 'renderer/graph/lookPickerRows';
import { SceneThumbnail } from 'renderer/graph/lookPickerParts';
import type {
  TPickerFrom,
  TPickerPlace,
  TPickerView,
} from 'renderer/graph/lookPickerFilter';
import { markSceneVersionSeen } from 'renderer/utils/seenSceneVersions';
import { getSelectableLooks } from 'renderer/utils/graphStyle';
import { I18nProvider } from 'renderer/utils/I18nContext';

/**
 * What the look picker opens, handed its rows (`LookPickerBody`): the
 * picker hands it the reader's looks, Help's drawing made-up ones.
 */

const t = (
  key: Parameters<typeof translate>[1],
  vars?: Record<string, string | number>,
) => translate('en', key, vars);

const STYLES: readonly IStyleRow[] = buildStyleRows(
  getSelectableLooks([], 'signal', [], []),
  t,
);

const scene = (over: Partial<IPlusRow> & Pick<IPlusRow, 'id' | 'name'>) => ({
  swatch: ['#000000'],
  maker: 'fluideq' as const,
  categories: ['nature' as const],
  locked: false,
  search: over.name.toLowerCase(),
  ...over,
});

const SCENES: readonly IPlusRow[] = [
  scene({ id: 'scene-alpine', name: 'Alpine', version: 3 }),
  scene({ id: 'scene-reef', name: 'Reef Light', categories: ['water'] }),
  scene({
    id: 'scene-lighthouse',
    name: 'Lighthouse Night',
    maker: 'members',
    author: 'Marta',
    categories: ['water'],
    version: 2,
  }),
];

interface IOpen {
  query?: string;
  place?: TPickerPlace;
  from?: TPickerFrom;
  view?: TPickerView;
  value?: string;
}

const open = ({
  query = '',
  place = 'everything',
  from = 'all',
  view = 'grid',
  value = STYLES[0].id,
}: IOpen = {}) => {
  const handlers = {
    onChoose: jest.fn(),
    onFrom: jest.fn(),
    onView: jest.fn(),
  };
  render(
    <I18nProvider>
      <LookPickerBody
        value={value}
        styleRows={STYLES}
        plusRows={SCENES}
        query={query}
        place={place}
        from={from}
        sort="newest"
        view={view}
        onQuery={jest.fn()}
        onPlace={jest.fn()}
        onFrom={handlers.onFrom}
        onSort={jest.fn()}
        onView={handlers.onView}
        onChoose={handlers.onChoose}
        searchRef={createRef<HTMLInputElement>()}
      />
    </I18nProvider>,
  );
  return handlers;
};

const region = (name: string) => within(screen.getByRole('region', { name }));

it('shows every style and every scene it is handed under Everything', () => {
  open();
  const everything = region(t('graph.picker.everything'));
  expect(everything.getByText('Alpine')).toBeInTheDocument();
  expect(everything.getByText('Reef Light')).toBeInTheDocument();
  expect(everything.getByText(STYLES[0].name)).toBeInTheDocument();
  // The place's heading counts what it holds.
  expect(everything.getByRole('heading', { level: 3 })).toHaveTextContent(
    `${t('graph.picker.everything')}${STYLES.length + SCENES.length}`,
  );
});

it('searches everything at once, whatever place is open, and Enter picks a lone match', () => {
  const { onChoose } = open({ query: 'reef', place: 'analysis' });
  const results = region(t('graph.picker.results', { query: 'reef' }));
  expect(results.getByText('Reef Light')).toBeInTheDocument();
  expect(results.queryByText('Alpine')).toBeNull();
  fireEvent.keyDown(
    screen.getByRole('textbox', { name: 'Search styles and scenes' }),
    { key: 'Enter' },
  );
  expect(onChoose).toHaveBeenCalledWith('scene-reef');
});

it('narrows any place to one maker, and counts each maker’s looks', () => {
  const { onFrom } = open({ place: 'water', from: 'members' });
  const water = region(t('plus.category.water'));
  expect(water.getByText('Lighthouse Night')).toBeInTheDocument();
  expect(water.queryByText('Reef Light')).toBeNull();
  expect(water.getByText('by Marta')).toBeInTheDocument();
  const froms = within(
    screen.getByRole('group', { name: t('graph.picker.from') }),
  );
  // Water holds two scenes: one FluidEQ's, one a member's.
  expect(froms.getByRole('button', { name: /FluidEQ/ })).toHaveTextContent('1');
  fireEvent.click(froms.getByRole('button', { name: /All/ }));
  expect(onFrom).toHaveBeenCalledWith('all');
});

it('offers every maker’s looks back when a maker leaves a place empty', () => {
  const { onFrom } = open({ place: 'nature', from: 'members' });
  fireEvent.click(
    screen.getByRole('button', { name: t('graph.picker.showEveryone') }),
  );
  expect(onFrom).toHaveBeenCalledWith('all');
});

it('marks the look on the graph as playing, and a version not played yet as updated', () => {
  markSceneVersionSeen('scene-alpine', 2);
  open({ value: 'scene-reef' });
  // The tile, not the remove button that also names the scene.
  const tileOf = (name: string) => {
    const tile = screen.getByText(name).closest('button');
    if (!tile) {
      throw new Error(`no tile for ${name}`);
    }
    return tile;
  };
  const reef = tileOf('Reef Light');
  expect(reef).toHaveAttribute('aria-pressed', 'true');
  expect(within(reef).getByText(t('graph.picker.playing'))).toBeInTheDocument();
  const alpine = tileOf('Alpine');
  expect(
    within(alpine).getByText(t('graph.picker.updated')),
  ).toBeInTheDocument();
  expect(within(alpine).queryByText(t('graph.picker.playing'))).toBeNull();
});

it('says when nothing is new rather than showing an empty grid', () => {
  open({ place: 'fresh', from: 'members' });
  expect(screen.getByText(t('graph.picker.nothingNew'))).toBeInTheDocument();
});

it('lays the looks out as a list in Details, and switches back', () => {
  const { onView } = open({ view: 'details' });
  expect(screen.getAllByRole('listitem')).toHaveLength(
    STYLES.length + SCENES.length,
  );
  fireEvent.click(screen.getByRole('button', { name: /Grid/ }));
  expect(onView).toHaveBeenCalledWith('grid');
});

// Help draws the picker's scenes from stills the app ships: a picture in
// hand is shown at once, and nothing is drawn or fetched for it.
it('shows a scene picture already in hand, without asking for one', () => {
  const { container } = render(
    <SceneThumbnail
      row={scene({
        id: 'scene-still',
        name: 'Still',
        thumbnail: { lookId: 'scene-still', version: '1', still: 'still.jpg' },
      })}
    />,
  );
  expect(container.querySelector('img')).toHaveAttribute('src', 'still.jpg');
});
