/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import '@testing-library/jest-dom';
import { createRef } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { IPlusRow } from 'renderer/graph/lookPickerRows';
import LookPickerBody from 'renderer/graph/LookPickerBody';
import { walkPicker } from 'renderer/graph/lookPickerParts';
import {
  resetAccountStore,
  subscribeAccount,
} from 'renderer/account/accountStore';
import { subscribeAccountPanelRequests } from 'renderer/account/accountPanel';
import { subscribePlusTabRequests } from 'renderer/plus/plusTabRequest';
import { resetPlusNavigation, plusPlace } from 'renderer/plus/plusNavigation';

// Under the reader's scenes the column counts what is new in the gallery,
// from its newest page, which loads after the picker mounts — after these
// synchronous cases end, as an update outside act. These cases are about
// discovery; `lookPickerMore.test.tsx` holds the count.
jest.mock('renderer/plus/galleryStore', () => ({
  ...jest.requireActual<object>('renderer/plus/galleryStore'),
  useGalleryList: () => ({ list: { scenes: [] } }),
}));

const renderPicker = (rows: IPlusRow[] = [], query = '') => {
  const onQuery = jest.fn();
  const onLeave = jest.fn();
  const onChoose = jest.fn();
  const view = render(
    <LookPickerBody
      value=""
      styleRows={[]}
      plusRows={rows}
      query={query}
      styleFilter="all"
      plusFilter="all"
      onQuery={onQuery}
      onStyleFilter={jest.fn()}
      onPlusFilter={jest.fn()}
      onChoose={onChoose}
      searchRef={createRef<HTMLInputElement>()}
      onLeave={onLeave}
    />,
  );
  return { ...view, onQuery, onLeave, onChoose };
};

beforeEach(() => {
  resetAccountStore();
  resetPlusNavigation();
  window.electron = { ipcRenderer: {} } as unknown as typeof window.electron;
});
afterEach(() => {
  resetAccountStore();
});

test('an empty picker invites guests into both existing destinations and auth', () => {
  const auth = jest.fn();
  const tab = jest.fn();
  const stopAuth = subscribeAccountPanelRequests(auth);
  const stopTab = subscribePlusTabRequests(tab);
  const view = renderPicker();
  expect(screen.getByText('Bring your music to life')).toBeVisible();
  expect(
    within(screen.getByRole('region', { name: 'Visualizers' })).queryByText(
      'No matches',
    ),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Explore scenes' }));
  expect(plusPlace()).toBe('visualizers');
  expect(view.onLeave).toHaveBeenCalledTimes(1);
  expect(tab).toHaveBeenCalledTimes(1);
  expect(auth).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Create your own' }));
  expect(plusPlace()).toBe('studio');
  expect(auth).toHaveBeenCalledTimes(2);
  stopAuth();
  stopTab();
});

test('search misses keep a real clear-search action instead of a sales message', () => {
  const view = renderPicker([], 'missing');
  expect(
    screen.queryByText('Bring your music to life'),
  ).not.toBeInTheDocument();
  const visualizers = screen.getByRole('region', { name: 'Visualizers' });
  expect(within(visualizers).getByText('No matches')).toBeVisible();
  fireEvent.click(
    within(visualizers).getByRole('button', { name: 'Clear search' }),
  );
  expect(view.onQuery).toHaveBeenCalledWith('');
});

test('a signed-in account with no scenes opens the destinations without another auth request', async () => {
  window.electron = {
    ipcRenderer: {
      getAccountState: async () => ({
        status: 'signed-in',
        identity: { id: 'maker', email: 'maker@example.com' },
      }),
    },
  } as unknown as typeof window.electron;
  const stopAccount = subscribeAccount(() => {});
  await act(async () => {
    await Promise.resolve();
  });
  const auth = jest.fn();
  const stopAuth = subscribeAccountPanelRequests(auth);
  renderPicker();
  fireEvent.click(screen.getByRole('button', { name: 'Explore scenes' }));
  expect(plusPlace()).toBe('visualizers');
  fireEvent.click(screen.getByRole('button', { name: 'Create your own' }));
  expect(plusPlace()).toBe('studio');
  expect(auth).not.toHaveBeenCalled();
  stopAuth();
  stopAccount();
});

test('owned scene selection and a search miss never become the discovery offer', () => {
  const row: IPlusRow = {
    id: 'premium:neon-lake',
    name: 'Neon Lake',
    swatch: ['#112233'],
    maker: 'fluideq',
    categories: ['water'],
    locked: false,
    search: 'neon lake',
  };
  const view = renderPicker([row]);
  expect(
    screen.queryByText('Bring your music to life'),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Neon Lake Water' }));
  expect(view.onChoose).toHaveBeenCalledWith(row.id);
  view.unmount();
  renderPicker([row], 'missing');
  expect(
    screen.queryByText('Bring your music to life'),
  ).not.toBeInTheDocument();
  expect(
    within(screen.getByRole('region', { name: 'Visualizers' })).getByText(
      'No matches',
    ),
  ).toBeVisible();
});

test('arrow keys reach both discovery actions and return to the search', () => {
  const view = renderPicker();
  const explore = screen.getByRole('button', { name: 'Explore scenes' });
  const create = screen.getByRole('button', { name: 'Create your own' });
  explore.focus();
  walkPicker(
    new KeyboardEvent('keydown', { key: 'ArrowDown' }),
    view.container,
  );
  expect(create).toHaveFocus();
  walkPicker(new KeyboardEvent('keydown', { key: 'ArrowUp' }), view.container);
  expect(explore).toHaveFocus();
  walkPicker(new KeyboardEvent('keydown', { key: 'ArrowUp' }), view.container);
  expect(screen.getByRole('textbox')).toHaveFocus();
});
