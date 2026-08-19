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
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ILibraryScanProgress } from '../../common/library/types';
import LibraryWorkspace from '../../renderer/library/LibraryWorkspace';
import { LibraryProvider } from '../../renderer/library/LibraryContext';
import { I18nProvider } from '../../renderer/utils/I18nContext';

const addLibraryRoot = jest.fn(() =>
  Promise.resolve({ version: 1, roots: [], tracks: [] }),
);
const cancelLibraryScan = jest.fn();

// Captured so a test can simulate a live scan by calling it directly, the
// way `onLibraryIndexChanged` already is not exercised because nothing here
// needs to.
let progressListener: ((progress: ILibraryScanProgress) => void) | undefined;

beforeEach(() => {
  addLibraryRoot.mockClear();
  cancelLibraryScan.mockClear();
  progressListener = undefined;
  window.electron = {
    ipcRenderer: {
      getLibraryIndex: () =>
        Promise.resolve({
          index: { version: 1, roots: [], tracks: [] },
          wasReset: false,
        }),
      addLibraryRoot,
      cancelLibraryScan,
      onLibraryScanProgress: (
        callback: (progress: ILibraryScanProgress) => void,
      ) => {
        progressListener = callback;
        return () => {
          progressListener = undefined;
        };
      },
      onLibraryIndexChanged: () => () => undefined,
    },
  } as unknown as typeof window.electron;
});

const renderWorkspace = () =>
  render(
    <I18nProvider>
      <LibraryProvider>
        <LibraryWorkspace isHidden={false} />
      </LibraryProvider>
    </I18nProvider>,
  );

describe('the library with nothing in it', () => {
  it('offers the one action that fixes an empty library', async () => {
    renderWorkspace();
    expect(await screen.findByText('No music yet')).toBeInTheDocument();
    // With no roots yet the toolbar row does not render at all, so the
    // empty state's own button is the only "Add folder" on screen -- see
    // `LibraryWorkspace.tsx`'s `index.roots.length > 0` gate.
    const add = screen.getByRole('button', { name: 'Add folder' });
    await userEvent.click(add);
    expect(addLibraryRoot).toHaveBeenCalled();
  });

  it('gives the suggested action the loud style and nothing else', async () => {
    renderWorkspace();
    const add = await screen.findByRole('button', { name: 'Add folder' });
    expect(add.className).toContain('button');
    expect(add.className).not.toContain('subtle');
  });
});

describe('a scan in progress', () => {
  it('lets Stop reach the real cancel channel', async () => {
    // The class of defect this project's rules are written about: a Stop
    // button that looks like it works but never reaches the scan it is
    // supposed to interrupt. `LibraryToolbar.test.tsx` only proves
    // `LibraryScanProgress` calls whatever `onCancel` prop it was given --
    // this proves `LibraryWorkspace` wires that prop all the way through
    // `useLibrary().cancelScan` to the actual IPC channel.
    renderWorkspace();
    await screen.findByText('No music yet');
    act(() => {
      progressListener?.({
        rootId: 'r1',
        seen: 3,
        parsed: 1,
        karaokeSkipped: 0,
        current: 'a.mp3',
        isDone: false,
      });
    });
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(cancelLibraryScan).toHaveBeenCalled();
  });
});
