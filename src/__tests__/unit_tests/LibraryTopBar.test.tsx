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
import type { ComponentProps } from 'react';
import LibraryScanProgress from '../../renderer/library/LibraryScanProgress';
import LibraryTopBar from '../../renderer/library/LibraryTopBar';
import { I18nProvider } from '../../renderer/utils/I18nContext';

type TProps = ComponentProps<typeof LibraryTopBar>;

const bar = (over: Partial<TProps> = {}) => {
  const props: TProps = {
    browseMode: 'album',
    viewMode: 'grid',
    sort: 'title',
    sortDirection: 'asc',
    onViewMode: jest.fn(),
    onSort: jest.fn(),
    onSortDirection: jest.fn(),
    query: '',
    onQuery: jest.fn(),
    history: {
      canGoBack: false,
      canGoForward: false,
      onGoBack: jest.fn(),
      onGoForward: jest.fn(),
    },
    ...over,
  };
  return {
    props,
    ...render(
      <I18nProvider>
        {/* eslint-disable-next-line react/jsx-props-no-spreading -- the case's own props over the defaults */}
        <LibraryTopBar {...props} />
      </I18nProvider>,
    ),
  };
};

describe('the library top bar', () => {
  it('offers the three views as one switch, Details first, and says which is on', async () => {
    const { props } = bar({ viewMode: 'list' });
    const views = screen.getByRole('group', {
      name: 'How the library is shown',
    });
    expect(
      Array.from(views.querySelectorAll('button')).map((view) =>
        view.textContent?.trim(),
      ),
    ).toEqual(['Details', 'Grid', 'Cover Flow']);
    expect(screen.getByRole('button', { name: 'Details' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cover Flow' }));
    expect(props.onViewMode).toHaveBeenCalledWith('coverflow');
  });

  // The Videos shelf reads in all three views like any other (Ivan,
  // 2026-11-15: "we can show by folders, list etc similar to music", and of
  // Cover Flow, "we want it there also, definitely").
  it('offers the three views on the Videos shelf too, and says which is on', async () => {
    const { props } = bar({ browseMode: 'video', viewMode: 'grid' });
    const views = screen.getByRole('group', {
      name: 'How the library is shown',
    });
    expect(
      Array.from(views.querySelectorAll('button')).map((view) =>
        view.textContent?.trim(),
      ),
    ).toEqual(['Details', 'Grid', 'Cover Flow']);
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Details' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cover Flow' }));
    expect(props.onViewMode).toHaveBeenCalledWith('coverflow');
  });

  // A shelf of artists, genres or folders has a name, a count and a date and
  // nothing else, so four of the six sorts were the same name order and
  // "Year" — which none of them has — quietly ordered them by track count.
  it('names the orders a shelf of names actually has', () => {
    // The control: on a shelf of tracks the first option is still Title.
    const { unmount } = bar({ browseMode: 'song' });
    expect(screen.getByText('Sort: Title')).toBeInTheDocument();
    unmount();

    bar({ browseMode: 'artist' });
    expect(screen.getByText('Sort: Name')).toBeInTheDocument();
    expect(screen.queryByText('Sort: Title')).not.toBeInTheDocument();
  });

  it('draws no order where the shelf is not the one to order', () => {
    bar({ onSort: undefined, onSortDirection: undefined });
    expect(screen.queryByText(/^Sort:/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Sort direction' }),
    ).not.toBeInTheDocument();
  });

  it('passes what was typed straight through', async () => {
    const { props } = bar({ browseMode: 'song', viewMode: 'list' });
    await userEvent.type(screen.getByRole('searchbox'), 'blue');
    expect(props.onQuery).toHaveBeenCalled();
  });

  it('walks back and forward only where there is somewhere to go', async () => {
    const { props, unmount } = bar();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Forward' })).toBeDisabled();
    unmount();

    const live = bar({
      history: {
        canGoBack: true,
        canGoForward: true,
        onGoBack: jest.fn(),
        onGoForward: jest.fn(),
      },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    await userEvent.click(screen.getByRole('button', { name: 'Forward' }));
    expect(live.props.history?.onGoBack).toHaveBeenCalledTimes(1);
    expect(live.props.history?.onGoForward).toHaveBeenCalledTimes(1);
    expect(props.history?.onGoBack).not.toHaveBeenCalled();
  });

  // Over a video there is no shelf to walk, and the picture has its own Back.
  it('draws no arrows where there is no history to walk', () => {
    bar({ history: undefined });
    expect(
      screen.queryByRole('button', { name: 'Back' }),
    ).not.toBeInTheDocument();
  });

  it('holds what it is given at its far end', () => {
    bar({ tail: <button type="button">Up next</button> });
    const controls = document.querySelector('.library-top__controls');
    expect(controls?.lastElementChild).toHaveTextContent('Up next');
  });
});

describe('a scan in progress', () => {
  it('shows what it is doing and offers to stop from the first second', async () => {
    // A long action that shows nothing is a bug regardless of what runs
    // underneath it.
    const onCancel = jest.fn();
    render(
      <I18nProvider>
        <LibraryScanProgress
          progress={{
            rootId: 'r',
            seen: 3,
            parsed: 1,
            karaokeSkipped: 0,
            current: 'a.mp3',
            isDone: false,
          }}
          onCancel={onCancel}
          onHide={jest.fn()}
        />
      </I18nProvider>,
    );
    expect(screen.getByText('Reading a.mp3')).toBeInTheDocument();
    expect(screen.getByText('1 of 3 files')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
