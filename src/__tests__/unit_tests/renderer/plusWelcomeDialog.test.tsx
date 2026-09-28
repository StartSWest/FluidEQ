/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The welcome to Plus stands over whatever was open when the membership
 * arrived. Its keys are its own: Tab used to walk out into the window behind,
 * closing it left focus nowhere, and a failure to record it was dropped
 * without a word.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import PlusWelcomeDialog from '../../../renderer/components/PlusWelcomeDialog';
import { markPlusWelcomeSeen } from '../../../renderer/account/plusWelcomeStore';
import { reportError } from '../../../renderer/utils/logger';

let welcome: { edition: number } | null = { edition: 3 };

jest.mock('../../../renderer/account/plusWelcomeStore', () => ({
  usePlusWelcome: () => welcome,
  markPlusWelcomeSeen: jest.fn(),
}));
jest.mock('../../../renderer/plus/SceneBand', () => () => null);
jest.mock('../../../renderer/plus/plusTabRequest', () => ({
  requestPlusTab: jest.fn(),
}));
jest.mock('../../../renderer/utils/logger', () => ({ reportError: jest.fn() }));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const markSeen = jest.mocked(markPlusWelcomeSeen);
const beneath = jest.fn();

beforeEach(() => {
  welcome = { edition: 3 };
  markSeen.mockResolvedValue(undefined);
  document.addEventListener('keydown', beneath);
});

afterEach(() => {
  document.removeEventListener('keydown', beneath);
  jest.clearAllMocks();
});

const press = (key: string) =>
  fireEvent.keyDown(document.activeElement ?? document.body, { key });

it('keeps Tab inside the welcome, and away from the window beneath', () => {
  render(<PlusWelcomeDialog />);
  const dialog = screen.getByRole('dialog');
  expect(
    screen.getByRole('button', { name: 'plusWelcome.open' }),
  ).toHaveFocus();
  const stops = dialog.querySelectorAll('button, a[href]').length;
  for (let turn = 0; turn <= stops; turn += 1) {
    expect(press('Tab')).toBe(false);
    expect(dialog.contains(document.activeElement)).toBe(true);
  }
  expect(beneath).not.toHaveBeenCalled();
});

it('closes on Escape without closing what it stands over', () => {
  render(<PlusWelcomeDialog />);
  press('Escape');
  expect(markSeen).toHaveBeenCalledWith(3);
  expect(beneath).not.toHaveBeenCalled();
});

it('says so when the close could not be recorded', async () => {
  const failure = new Error('main did not answer');
  markSeen.mockRejectedValue(failure);
  render(<PlusWelcomeDialog />);
  await act(async () => {
    press('Escape');
  });
  expect(reportError).toHaveBeenCalledWith(
    'recording the Plus welcome as seen',
    failure,
  );
});

it('gives focus back to what had it when the welcome goes', () => {
  const opener = document.createElement('button');
  document.body.append(opener);
  opener.focus();
  const view = render(<PlusWelcomeDialog />);
  expect(opener).not.toHaveFocus();
  welcome = null;
  view.rerender(<PlusWelcomeDialog />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
  opener.remove();
});
