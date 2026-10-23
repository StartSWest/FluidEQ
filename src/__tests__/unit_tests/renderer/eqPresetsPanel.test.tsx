/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import EqPresetsPanel from 'renderer/EqPresetsPanel';

// The page's own arrangement is what is under test, not the cards it holds.
jest.mock('renderer/OpraPicker', () => ({
  __esModule: true,
  default: () => <div data-testid="opra" />,
}));
jest.mock('renderer/eq/MyCurvesPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="mine" />,
}));
jest.mock('renderer/SquiglinkImport', () => ({
  __esModule: true,
  default: () => <div data-testid="squiglink" />,
}));
jest.mock('renderer/components/OpraLibraryStatus', () => ({
  __esModule: true,
  default: () => null,
  OPRA_UPDATED_EVENT: 'opra-updated',
}));
jest.mock('renderer/eq/myCurvesStore', () => ({
  useMyCurves: () => [],
}));

it('gives Squiglink a tab of its own, right after OPRA, never under a list that grows', async () => {
  render(<EqPresetsPanel />);
  await act(async () => undefined);
  expect(
    screen
      .getAllByRole('tab')
      .map((tab) => tab.textContent?.replace(/\d+$/, '')),
  ).toEqual(['OPRA library', 'Squiglink', 'My curves']);
  // OPRA's library opens, and nothing else is on the page with it.
  expect(screen.getByTestId('opra')).toBeInTheDocument();
  expect(screen.queryByTestId('squiglink')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Squiglink' }));
  expect(screen.getByRole('tab', { name: 'Squiglink' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(screen.getByTestId('squiglink')).toBeInTheDocument();
  expect(screen.getByRole('tabpanel')).toHaveAttribute(
    'aria-labelledby',
    'autoeq-tab-squiglink',
  );
  expect(screen.queryByTestId('opra')).not.toBeInTheDocument();
  expect(screen.queryByTestId('mine')).not.toBeInTheDocument();
  // My curves is the list alone.
  fireEvent.click(screen.getByRole('tab', { name: /My curves/ }));
  expect(screen.getByTestId('mine')).toBeInTheDocument();
  expect(screen.queryByTestId('squiglink')).not.toBeInTheDocument();
});
