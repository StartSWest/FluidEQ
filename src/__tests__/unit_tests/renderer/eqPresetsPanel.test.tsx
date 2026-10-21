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

it('keeps the Squiglink import under My curves alone, not under OPRA', async () => {
  render(<EqPresetsPanel />);
  await act(async () => undefined);
  expect(screen.getByTestId('opra')).toBeInTheDocument();
  expect(screen.queryByTestId('squiglink')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: /My curves/ }));
  expect(screen.getByTestId('mine')).toBeInTheDocument();
  expect(screen.getByTestId('squiglink')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: /OPRA library/ }));
  expect(screen.queryByTestId('squiglink')).not.toBeInTheDocument();
});
