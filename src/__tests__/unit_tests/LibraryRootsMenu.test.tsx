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
import type { ReactNode } from 'react';
import { ILibraryRoot } from '../../common/library/types';
import LibraryRootsMenu from '../../renderer/library/LibraryRootsMenu';
import LibraryStatusLine from '../../renderer/library/LibraryStatusLine';
import { I18nProvider } from '../../renderer/utils/I18nContext';

const root = (over: Partial<ILibraryRoot>): ILibraryRoot => ({
  id: 'r1',
  path: 'C:\\Music',
  addedAt: 1,
  trackCount: 0,
  karaokeSkipped: 0,
  ...over,
});

const wrap = (node: ReactNode) => render(<I18nProvider>{node}</I18nProvider>);

describe('the folders at the foot of the rail', () => {
  it('reaches onAddFolder', async () => {
    const onAddFolder = jest.fn();
    wrap(
      <LibraryRootsMenu
        roots={[]}
        onAddFolder={onAddFolder}
        onRemoveRoot={jest.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add folder' }));
    expect(onAddFolder).toHaveBeenCalledTimes(1);
  });

  it('has nothing to manage with no folder added', () => {
    wrap(
      <LibraryRootsMenu
        roots={[]}
        onAddFolder={jest.fn()}
        onRemoveRoot={jest.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Your folders' }),
    ).not.toBeInTheDocument();
  });

  it('opens the folders, lists a root, and closes on an outside press', async () => {
    const user = userEvent.setup();
    wrap(
      <div>
        <LibraryRootsMenu
          roots={[root({ path: 'C:\\Music' })]}
          onAddFolder={jest.fn()}
          onRemoveRoot={jest.fn()}
        />
        <button type="button">Outside</button>
      </div>,
    );
    await user.click(screen.getByRole('button', { name: 'Your folders' }));
    expect(screen.getByText('C:\\Music')).toBeInTheDocument();

    await user.click(screen.getByText('Outside'));
    expect(screen.queryByText('C:\\Music')).not.toBeInTheDocument();
  });

  it('explains why a song is dimmed when its folder is offline', async () => {
    const user = userEvent.setup();
    wrap(
      <LibraryRootsMenu
        roots={[root({ path: 'C:\\Music', isOffline: true })]}
        onAddFolder={jest.fn()}
        onRemoveRoot={jest.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Your folders' }));
    expect(
      screen.getByText('This folder is not available right now'),
    ).toBeInTheDocument();
  });

  it('reaches onRemoveRoot for the folder whose remove control was pressed', async () => {
    const onRemoveRoot = jest.fn();
    const user = userEvent.setup();
    wrap(
      <LibraryRootsMenu
        roots={[root({ id: 'r1', path: 'C:\\Music' })]}
        onAddFolder={jest.fn()}
        onRemoveRoot={onRemoveRoot}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Your folders' }));
    await user.click(
      screen.getByRole('button', { name: 'Remove this folder' }),
    );
    expect(onRemoveRoot).toHaveBeenCalledWith('r1');
  });
});

describe('the status line', () => {
  const line = (over: Partial<Parameters<typeof LibraryStatusLine>[0]> = {}) =>
    wrap(
      <LibraryStatusLine
        shown={{ count: 9, durationMs: 38 * 60_000 }}
        shownKind="song"
        counts={{ album: 1204, song: 14032, video: 62 }}
        isScanning={false}
        progress={undefined}
        isScanNoticeHidden={false}
        onShowScan={jest.fn()}
        onRescan={jest.fn()}
        onForceRescan={jest.fn()}
        // eslint-disable-next-line react/jsx-props-no-spreading -- the case's own props over the defaults
        {...over}
      />,
    );

  it('says what is on screen, what the library holds, and that it is up to date', () => {
    line();
    expect(screen.getByText('9 songs · 38 min')).toBeInTheDocument();
    expect(screen.getByText('1,204 albums · 14,032 songs')).toBeInTheDocument();
    expect(screen.getByText('Library up to date')).toBeInTheDocument();
  });

  it('counts videos on the Videos shelf, and one of anything as one', () => {
    line({ shown: { count: 1, durationMs: 125 * 60_000 }, shownKind: 'video' });
    expect(screen.getByText('1 video · 2 h 5 min')).toBeInTheDocument();
  });

  it('reaches Rescan and Force rescan, and holds both while a scan runs', async () => {
    const onRescan = jest.fn();
    const onForceRescan = jest.fn();
    const { unmount } = line({ onRescan, onForceRescan });
    await userEvent.click(screen.getByRole('button', { name: 'Rescan' }));
    await userEvent.click(screen.getByRole('button', { name: 'Force rescan' }));
    expect(onRescan).toHaveBeenCalledTimes(1);
    expect(onForceRescan).toHaveBeenCalledTimes(1);
    unmount();

    line({ isScanning: true });
    expect(screen.getByRole('button', { name: 'Rescan' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Force rescan' })).toBeDisabled();
    expect(screen.getByText('Scanning…')).toBeInTheDocument();
  });
});
