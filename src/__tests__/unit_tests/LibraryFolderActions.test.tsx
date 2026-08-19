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
import { ILibraryRoot } from '../../common/library/types';
import LibraryFolderActions from '../../renderer/library/LibraryFolderActions';
import { I18nProvider } from '../../renderer/utils/I18nContext';

const root = (over: Partial<ILibraryRoot>): ILibraryRoot => ({
  id: 'r1',
  path: 'C:\\Music',
  addedAt: 1,
  trackCount: 0,
  karaokeSkipped: 0,
  ...over,
});

const wrap = (node: React.ReactNode) =>
  render(<I18nProvider>{node}</I18nProvider>);

describe('the folder actions', () => {
  it('disables Rescan while a scan is running', () => {
    wrap(
      <LibraryFolderActions
        roots={[]}
        isScanning
        onAddFolder={jest.fn()}
        onRescan={jest.fn()}
        onRemoveRoot={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Rescan' })).toBeDisabled();
  });

  it('reaches onAddFolder and onRescan', async () => {
    const onAddFolder = jest.fn();
    const onRescan = jest.fn();
    const user = userEvent.setup();
    wrap(
      <LibraryFolderActions
        roots={[]}
        isScanning={false}
        onAddFolder={onAddFolder}
        onRescan={onRescan}
        onRemoveRoot={jest.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Add folder' }));
    await user.click(screen.getByRole('button', { name: 'Rescan' }));
    expect(onAddFolder).toHaveBeenCalled();
    expect(onRescan).toHaveBeenCalled();
  });

  it('has no Folders control at all with nothing to manage', () => {
    wrap(
      <LibraryFolderActions
        roots={[]}
        isScanning={false}
        onAddFolder={jest.fn()}
        onRescan={jest.fn()}
        onRemoveRoot={jest.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Folders' }),
    ).not.toBeInTheDocument();
  });

  it('opens the folders menu, lists a root, and closes it on an outside click', async () => {
    const user = userEvent.setup();
    wrap(
      <div>
        <LibraryFolderActions
          roots={[root({ path: 'C:\\Music' })]}
          isScanning={false}
          onAddFolder={jest.fn()}
          onRescan={jest.fn()}
          onRemoveRoot={jest.fn()}
        />
        <button type="button">Outside</button>
      </div>,
    );
    await user.click(screen.getByRole('button', { name: 'Folders' }));
    expect(screen.getByText('C:\\Music')).toBeInTheDocument();

    await user.click(screen.getByText('Outside'));
    expect(screen.queryByText('C:\\Music')).not.toBeInTheDocument();
  });

  it('explains why a track is dimmed when its root is offline', async () => {
    const user = userEvent.setup();
    wrap(
      <LibraryFolderActions
        roots={[root({ path: 'C:\\Music', isOffline: true })]}
        isScanning={false}
        onAddFolder={jest.fn()}
        onRescan={jest.fn()}
        onRemoveRoot={jest.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Folders' }));
    expect(
      screen.getByText('This folder is not available right now'),
    ).toBeInTheDocument();
  });

  it('reaches onRemoveRoot for the root whose remove control was pressed', async () => {
    const onRemoveRoot = jest.fn();
    const user = userEvent.setup();
    wrap(
      <LibraryFolderActions
        roots={[root({ id: 'r1', path: 'C:\\Music' })]}
        isScanning={false}
        onAddFolder={jest.fn()}
        onRescan={jest.fn()}
        onRemoveRoot={onRemoveRoot}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Folders' }));
    await user.click(
      screen.getByRole('button', { name: 'Remove this folder' }),
    );
    expect(onRemoveRoot).toHaveBeenCalledWith('r1');
  });
});
