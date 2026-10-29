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
  scene({ id: 'scene-alpine', name: 'Alpine' }),
  scene({ id: 'scene-reef', name: 'Reef Light', categories: ['water'] }),
];

const open = (query: string, onChoose = jest.fn()) => {
  render(
    <I18nProvider>
      <LookPickerBody
        value={STYLES[0].id}
        styleRows={STYLES}
        plusRows={SCENES}
        query={query}
        styleFilter="all"
        plusFilter="all"
        onQuery={jest.fn()}
        onStyleFilter={jest.fn()}
        onPlusFilter={jest.fn()}
        onChoose={onChoose}
        searchRef={createRef<HTMLInputElement>()}
      />
    </I18nProvider>,
  );
  return onChoose;
};

const column = (name: string) => screen.getByRole('region', { name });

it('lists every style and every visualizer it is handed', () => {
  open('');
  expect(
    within(column('Styles')).getByText(String(STYLES.length)),
  ).toBeInTheDocument();
  expect(within(column('Visualizers')).getByText('Alpine')).toBeInTheDocument();
  expect(
    within(column('Visualizers')).getByText('Reef Light'),
  ).toBeInTheDocument();
});

it('narrows both columns to what the search names, and Enter picks a lone match', () => {
  const onChoose = open('reef');
  expect(within(column('Visualizers')).queryByText('Alpine')).toBeNull();
  expect(
    within(column('Styles')).getByText(translate('en', 'common.noMatches')),
  ).toBeInTheDocument();
  fireEvent.keyDown(
    screen.getByRole('textbox', { name: 'Search styles and visualizers' }),
    { key: 'Enter' },
  );
  expect(onChoose).toHaveBeenCalledWith('scene-reef');
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
