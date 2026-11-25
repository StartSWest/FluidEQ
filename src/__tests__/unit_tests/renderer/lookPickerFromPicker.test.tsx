/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { registerRendererAddon, resetRendererAddons } from 'renderer/addons';
import LookPicker from 'renderer/graph/LookPicker';
import type { IPlusRow } from 'renderer/graph/lookPickerRows';

/**
 * The picker itself around the From tabs (Ivan, 2026-11-25): the account
 * that publishes FluidEQ's scenes has them under Yours, and a family of
 * styles hands back every maker, so the rail's numbers are what the next
 * place shows.
 */

const scene = (
  id: string,
  name: string,
  maker: IPlusRow['maker'],
): IPlusRow => ({
  id,
  name,
  swatch: ['#000000'],
  maker,
  ...(maker === 'members' ? { author: 'Prime' } : {}),
  categories: ['nature'],
  locked: false,
  search: name.toLowerCase(),
});

jest.mock('renderer/graph/lookPickerRows', () => ({
  ...jest.requireActual('renderer/graph/lookPickerRows'),
  buildPlusRows: () => [
    scene('premium:alpine', 'Alpine', 'fluideq'),
    scene('premium:reef', 'Reef Light', 'fluideq'),
    scene('member:prime:prism', 'Prism Diamond', 'members'),
    scene('member:me:own', 'My Own', 'mine'),
  ],
}));
// The column's last line counts the gallery's newest page, which loads
// after these synchronous cases end; `lookPickerMore.test.tsx` holds it.
jest.mock('renderer/plus/galleryStore', () => ({
  ...jest.requireActual<object>('renderer/plus/galleryStore'),
  useGalleryList: () => ({ list: { scenes: [] } }),
}));

const PICKER = 'Styles and scenes';

afterEach(() => {
  resetRendererAddons();
});

const openPicker = () => {
  render(<LookPicker value="analyzer" disabled={false} onChoose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: PICKER }));
  return within(screen.getByRole('dialog', { name: PICKER }));
};

const fromTab = (name: RegExp) =>
  within(screen.getByRole('group', { name: 'From' })).getByRole('button', {
    name,
  });

const place = (title: string) => {
  const found = within(screen.getByRole('navigation'))
    .getAllByRole('button')
    .find((each) => each.getAttribute('title') === title);
  if (!found) {
    throw new Error(`no place ${title}`);
  }
  return found;
};

const countIn = (element: HTMLElement, selector: string) =>
  Number(element.querySelector(selector)?.textContent ?? NaN);

it('counts FluidEQ’s scenes under Yours for the account that publishes them', () => {
  registerRendererAddon({
    name: 'publisher',
    capabilities: {
      subscribe: () => () => undefined,
      get: () => ({ ownsOfficialScenes: true }),
    },
  });
  openPicker();
  expect(countIn(fromTab(/^Yours/), '.look-picker__from-count')).toBe(3);
  expect(countIn(fromTab(/^FluidEQ/), '.look-picker__from-count')).toBe(2);
});

it('keeps Yours to the member’s own scenes for everybody else', () => {
  openPicker();
  expect(countIn(fromTab(/^Yours/), '.look-picker__from-count')).toBe(1);
});

it('hands every maker back on a family of styles, so the next place shows what the rail said', () => {
  openPicker();
  fireEvent.click(fromTab(/^Members/));
  expect(countIn(place('Everything'), '.look-picker__place-count')).toBe(1);
  fireEvent.click(place('Analysis'));
  const everything = countIn(place('Everything'), '.look-picker__place-count');
  fireEvent.click(place('Everything'));
  expect(fromTab(/^All/)).toHaveAttribute('aria-pressed', 'true');
  expect(
    countIn(screen.getByRole('heading', { level: 3 }), '.look-picker__count'),
  ).toBe(everything);
});
