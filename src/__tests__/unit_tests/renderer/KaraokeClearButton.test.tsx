/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import KaraokeClearButton from '../../../renderer/karaoke/KaraokeClearButton';

afterEach(cleanup);

it('asks before clearing, focuses Cancel, and lets Escape keep the playlist', () => {
  const clear = jest.fn();
  render(<KaraokeClearButton onClear={clear} />);
  const opener = screen.getByRole('button', { name: 'Clear' });
  opener.focus();
  fireEvent.click(opener);
  const question = screen.getByRole('alertdialog', {
    name: 'Unload all karaoke songs?',
  });
  expect(clear).not.toHaveBeenCalled();
  expect(within(question).getByText('Cancel', { exact: true })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(clear).not.toHaveBeenCalled();
});

it('clears only on the confirmation button and supports cancelling by button', () => {
  const clear = jest.fn();
  render(<KaraokeClearButton onClear={clear} />);
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  fireEvent.click(
    within(screen.getByRole('alertdialog')).getByText('Cancel', {
      exact: true,
    }),
  );
  expect(clear).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  fireEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Clear',
    }),
  );
  expect(clear).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});
