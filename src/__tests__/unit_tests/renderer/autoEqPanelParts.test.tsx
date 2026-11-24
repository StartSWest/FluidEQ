/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Auto EQ's panel parted the way Ivan chose on 2026-11-24 (design A, "is all
 * together, no separation... it doesn't look good"): the song on a step of
 * light of its own with its sound as a chip, what a song keeps as four cells
 * of a label over its value, the parts parted by space and not by hairlines,
 * and the foot sunk into the menu's floor rather than ruled off.
 */

import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { FilterTypeEnum } from 'common/constants';
import type { ISongSound } from 'common/songSound';
import AutoEqSongHolds from 'renderer/eq/autoEq/AutoEqSongHolds';
import { compileStylesheet, styleRules } from '../../utils/stylesheetRules';

const sound: ISongSound = {
  presetId: 'none',
  tone: { bass: 3, mid: 0, treble: -2 },
  filters: {
    a: {
      id: 'a',
      frequency: 1000,
      gain: 4,
      quality: 1,
      type: FilterTypeEnum.PK,
    },
  },
};

const declarationsOf = (sheet: string, selector: string) =>
  styleRules(compileStylesheet(sheet)).find(
    ({ selectors, within }) =>
      within.length === 0 && selectors.includes(selector),
  )?.declarations;

it('lays what a song keeps out as four cells, a label over each value', () => {
  const { container } = render(<AutoEqSongHolds sound={sound} />);
  const cells = container.querySelectorAll(
    '.eq-auto-holds > .eq-auto-holds__cell',
  );
  expect(cells).toHaveLength(4);
  cells.forEach((cell) => {
    expect([...cell.children].map((child) => child.tagName)).toEqual([
      'DT',
      'DD',
    ]);
  });
  // The correction's word stands under the cells, not inside one of them.
  const note = container.querySelector('.eq-auto-holds__note');
  expect(note).toBeInTheDocument();
  expect(note?.closest('.eq-auto-holds')).toBeNull();
});

it('gives the cells two columns, each on a step of light', () => {
  const holds = declarationsOf('EqAutoSounds.scss', '.eq-auto-holds');
  expect(holds?.get('grid-template-columns')).toBe('repeat(2, minmax(0, 1fr))');
  expect(
    declarationsOf('EqAutoSounds.scss', '.eq-auto-holds__cell')?.get(
      'background',
    ),
  ).toMatch(/color-mix/);
});

it('parts the panel by steps and space, never by a hairline', () => {
  const now = declarationsOf('EqAutoPanel.scss', '.eq-auto-now');
  expect(now?.get('background')).toMatch(/color-mix/);
  expect(now?.has('border-bottom')).toBe(false);
  const part = declarationsOf('EqAutoPanel.scss', '.eq-auto-part');
  expect(part?.has('border-bottom')).toBe(false);
  const foot = declarationsOf('EqAutoPanel.scss', '.eq-auto-panel__foot');
  expect(foot?.has('border-top')).toBe(false);
  expect(foot?.get('background')).toBeDefined();
});
