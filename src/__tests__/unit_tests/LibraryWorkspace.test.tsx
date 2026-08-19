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
import LibraryWorkspace from '../../renderer/library/LibraryWorkspace';
import { LibraryProvider } from '../../renderer/library/LibraryContext';
import { I18nProvider } from '../../renderer/utils/I18nContext';

const addLibraryRoot = jest.fn(() =>
  Promise.resolve({ version: 1, roots: [], tracks: [] }),
);

beforeEach(() => {
  addLibraryRoot.mockClear();
  window.electron = {
    ipcRenderer: {
      getLibraryIndex: () =>
        Promise.resolve({
          index: { version: 1, roots: [], tracks: [] },
          wasReset: false,
        }),
      addLibraryRoot,
      onLibraryScanProgress: () => () => undefined,
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
    const add = screen.getAllByRole('button', { name: 'Add folder' })[0];
    await userEvent.click(add);
    expect(addLibraryRoot).toHaveBeenCalled();
  });

  it('gives the suggested action the loud style and nothing else', async () => {
    // Emphasis follows recommendation. An empty library has exactly one
    // useful next step and it must be the one that looks clickable.
    renderWorkspace();
    const add = (
      await screen.findAllByRole('button', { name: 'Add folder' })
    )[0];
    expect(add.className).toContain('button');
    expect(add.className).not.toContain('subtle');
  });
});
