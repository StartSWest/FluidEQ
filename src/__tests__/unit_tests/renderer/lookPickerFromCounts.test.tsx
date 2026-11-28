/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { createRef } from 'react';
import { render, screen, within } from '@testing-library/react';
import { translate } from 'common/i18n';
import LookPickerBody from 'renderer/graph/LookPickerBody';
import type {
  TPickerFrom,
  TPickerPlace,
} from 'renderer/graph/lookPickerFilter';
import {
  buildStyleRows,
  type IPlusRow,
  type IStyleRow,
} from 'renderer/graph/lookPickerRows';
import { getSelectableLooks } from 'renderer/utils/graphStyle';
import { I18nProvider } from 'renderer/utils/I18nContext';

/**
 * The From tabs count where a SCENE comes from, and every number on screen
 * is one the grid then shows (Ivan, 2026-11-25: "this is confusing, 71??
 * we don't have 71 FluidEQ Plus scenes", and of the account he publishes
 * FluidEQ's scenes from, "all should be on both sides: all mine and all
 * FluidEQ, same number").
 */

const t = (
  key: Parameters<typeof translate>[1],
  vars?: Record<string, string | number>,
) => translate('en', key, vars);

const STYLES: readonly IStyleRow[] = buildStyleRows(
  getSelectableLooks([], 'signal', [], []),
  t,
);
const ANALYSIS = STYLES.filter((row) => row.family === 'analysis');

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
  scene({
    id: 'member:prime:prism',
    name: 'Prism Diamond',
    maker: 'members',
    author: 'Prime',
  }),
  scene({ id: 'member:me:own', name: 'My Own', maker: 'mine' }),
];

const open = (
  place: TPickerPlace,
  from: TPickerFrom,
  ownsOfficialScenes = false,
) =>
  render(
    <I18nProvider>
      <LookPickerBody
        value={STYLES[0].id}
        styleRows={STYLES}
        plusRows={SCENES}
        query=""
        place={place}
        from={from}
        view="grid"
        ownsOfficialScenes={ownsOfficialScenes}
        onQuery={jest.fn()}
        onPlace={jest.fn()}
        onFrom={jest.fn()}
        onSort={jest.fn()}
        onView={jest.fn()}
        onChoose={jest.fn()}
        searchRef={createRef<HTMLInputElement>()}
      />
    </I18nProvider>,
  );

const fromCounts = () => {
  const group = screen.getByRole('group', { name: t('graph.picker.from') });
  return Object.fromEntries(
    within(group)
      .getAllByRole('button')
      .map((button) => [
        button.firstChild?.textContent ?? '',
        Number(
          button.querySelector('.look-picker__from-count')?.textContent ?? NaN,
        ),
      ]),
  );
};

const headingCount = () =>
  Number(
    screen
      .getByRole('heading', { level: 3 })
      .querySelector('.look-picker__count')?.textContent ?? NaN,
  );

// A place is named by its title; its count is part of what it reads.
const railCount = (name: string) =>
  Number(
    within(screen.getByRole('navigation'))
      .getByTitle(name)
      .querySelector('.look-picker__place-count')?.textContent ?? NaN,
  );

const sceneTiles = () =>
  Array.from(document.querySelectorAll('.look-picker__grid .look-picker__name'))
    .map((each) => each.textContent)
    .sort();

describe('a member’s From tabs', () => {
  it('count scenes only, so FluidEQ is FluidEQ’s scenes and All every scene', () => {
    open('everything', 'all');
    expect(fromCounts()).toEqual({
      All: 4,
      FluidEQ: 2,
      Members: 1,
      Yours: 1,
    });
    // The grid's own sections say the same: the scenes the All tab counts,
    // then the styles, the heading the two together.
    expect(
      screen
        .getAllByRole('heading', { level: 4 })
        .map((heading) => heading.textContent),
    ).toEqual([
      `${t('graph.picker.plus')}4`,
      `${t('graph.picker.styles')}${STYLES.length}`,
    ]);
    expect(headingCount()).toBe(STYLES.length + SCENES.length);
  });

  it('show exactly what they count, and the rail and the heading follow', () => {
    open('everything', 'fluideq');
    expect(sceneTiles()).toEqual(['Alpine', 'Reef Light']);
    // No style under a maker's tab: a style has no maker to choose.
    expect(document.querySelector('.look-picker__grid--styles')).toBeNull();
    expect(headingCount()).toBe(fromCounts().FluidEQ);
    expect(railCount(t('graph.picker.everything'))).toBe(2);
    expect(railCount(t('graph.picker.allScenes'))).toBe(2);
    expect(railCount(t('plus.category.water'))).toBe(1);
  });

  it('keep Yours to the member’s own scenes', () => {
    open('everything', 'yours');
    expect(sceneTiles()).toEqual(['My Own']);
    expect(headingCount()).toBe(1);
  });
});

describe('the account that publishes FluidEQ’s scenes', () => {
  it('has every FluidEQ scene under Yours as well, beside its own', () => {
    open('everything', 'yours', true);
    const counts = fromCounts();
    expect(counts).toEqual({ All: 4, FluidEQ: 2, Members: 1, Yours: 3 });
    expect(sceneTiles()).toEqual(['Alpine', 'My Own', 'Reef Light']);
    expect(headingCount()).toBe(counts.Yours);
  });
});

describe('a family of styles', () => {
  it('is not narrowed by a tab left on, and From stands idle over it', () => {
    const { container } = open('analysis', 'members');
    const froms = container.querySelector('.look-picker__froms');
    expect(froms).toHaveClass('is-idle');
    expect(froms).toHaveAttribute('aria-hidden', 'true');
    expect(headingCount()).toBe(ANALYSIS.length);
    // The rail counts every maker there too, so pressing Everything shows
    // the number it said.
    expect(railCount(t('graph.picker.everything'))).toBe(
      STYLES.length + SCENES.length,
    );
  });

  it('keeps the tabs drawn wherever scenes can be', () => {
    const { container } = open('water', 'all');
    expect(container.querySelector('.look-picker__froms')).not.toHaveClass(
      'is-idle',
    );
  });
});
