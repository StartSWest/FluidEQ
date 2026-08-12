/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DISCLAIMER_ACCEPTED_KEY,
  DISCLAIMER_PARAGRAPHS,
  DISCLAIMER_VERSION,
  buildAcceptance,
} from 'common/disclaimer';
import DisclaimerGate from 'renderer/components/DisclaimerGate';

let closeCalls = 0;

beforeEach(() => {
  window.localStorage.clear();
  closeCalls = 0;
  window.electron = {
    ipcRenderer: {
      closeApp: () => {
        closeCalls += 1;
      },
    },
  } as unknown as typeof window.electron;
});

/**
 * Shown once, agreed to, and recorded well enough to be worth something later.
 */
describe('the first-run acknowledgement', () => {
  it('is the first thing on a fresh install, and blocks the app', () => {
    render(<DisclaimerGate />);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // Every paragraph, not a summary of them: what is agreed to and what the
    // About panel shows have to be the same text.
    DISCLAIMER_PARAGRAPHS.forEach((paragraph) => {
      expect(dialog.textContent).toContain(paragraph);
    });
  });

  it('offers acceptance and a way out, and nothing else', () => {
    render(<DisclaimerGate />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Quit',
      'I understand and accept',
    ]);
  });

  it('cannot be escaped or tabbed past', async () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    render(<DisclaimerGate />);
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole('alertdialog')).toContainElement(
      document.activeElement as HTMLElement,
    );
    outside.remove();
  });

  it('quits rather than trapping somebody who will not accept', async () => {
    render(<DisclaimerGate />);
    await userEvent.click(screen.getByRole('button', { name: 'Quit' }));
    expect(closeCalls).toBe(1);
  });

  it('records the wording, the build and the moment on acceptance', async () => {
    render(<DisclaimerGate />);
    const before = Date.now();
    await userEvent.click(screen.getByRole('button', { name: /accept/i }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    const stored = JSON.parse(
      window.localStorage.getItem(DISCLAIMER_ACCEPTED_KEY) as string,
    );
    expect(stored.disclaimerVersion).toBe(DISCLAIMER_VERSION);
    expect(typeof stored.appVersion).toBe('string');
    expect(Date.parse(stored.acceptedAt)).toBeGreaterThanOrEqual(before);
  });

  it('does not come back once it has been accepted', () => {
    window.localStorage.setItem(
      DISCLAIMER_ACCEPTED_KEY,
      JSON.stringify(buildAcceptance('1.2.0')),
    );
    render(<DisclaimerGate />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('comes back when the wording itself changes', () => {
    window.localStorage.setItem(
      DISCLAIMER_ACCEPTED_KEY,
      JSON.stringify({
        disclaimerVersion: DISCLAIMER_VERSION - 1,
        appVersion: '1.2.0',
        acceptedAt: new Date().toISOString(),
      }),
    );
    render(<DisclaimerGate />);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('comes back when the record is unreadable', () => {
    window.localStorage.setItem(DISCLAIMER_ACCEPTED_KEY, 'true');
    render(<DisclaimerGate />);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('lets somebody in even if the acceptance cannot be stored', async () => {
    // A locked-down profile is not a reason to make the app unusable. The
    // consequence is that the next launch asks again, which is honest.
    const setItem = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('storage is full');
      });
    try {
      render(<DisclaimerGate />);
      await userEvent.click(screen.getByRole('button', { name: /accept/i }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    } finally {
      setItem.mockRestore();
    }
  });
});
