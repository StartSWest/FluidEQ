/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Unloading the whole playlist asks first. Since the K1 mockup (2026-11-16)
 * it is the list heading's + menu that offers it, beside adding songs, where
 * a Clear button of its own stood in a header row above the tab.
 */

import '@testing-library/jest-dom';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import KaraokePlaylistAddMenu from '../../../renderer/karaoke/KaraokePlaylistAddMenu';

afterEach(cleanup);

const mount = (clear: () => void, hasSongs = true) =>
  render(
    <KaraokePlaylistAddMenu
      isBusy={false}
      hasSongs={hasSongs}
      groupByFolder={false}
      onAddFiles={jest.fn()}
      onAddFolder={jest.fn()}
      onToggleFolderGrouping={jest.fn()}
      onClear={clear}
    />,
  );

const askToClear = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Add songs' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Clear' }));
  return screen.getByRole('alertdialog', {
    name: 'Unload all karaoke songs?',
  });
};

it('asks before clearing, focuses Cancel, and lets Escape keep the playlist', () => {
  const clear = jest.fn();
  mount(clear);
  const question = askToClear();
  expect(clear).not.toHaveBeenCalled();
  expect(within(question).getByText('Cancel', { exact: true })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(clear).not.toHaveBeenCalled();
});

it('clears only on the confirmation button and supports cancelling by button', () => {
  const clear = jest.fn();
  mount(clear);
  fireEvent.click(within(askToClear()).getByText('Cancel', { exact: true }));
  expect(clear).not.toHaveBeenCalled();
  fireEvent.click(
    within(askToClear()).getByRole('button', {
      name: 'Clear',
    }),
  );
  expect(clear).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

it('offers no Clear for an empty playlist', () => {
  mount(jest.fn(), false);
  fireEvent.click(screen.getByRole('button', { name: 'Add songs' }));
  expect(screen.queryByRole('menuitem', { name: 'Clear' })).toBeNull();
  // The control: adding is there all the same.
  expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
});
