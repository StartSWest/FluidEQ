/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import App from '../../renderer/App';
import { Channels } from '../../main/api';

describe('App', () => {
  const setWindowFullScreen = jest.fn(async (next: boolean) => next);
  const sendMediaTransport = jest.fn(async (_action: string) => undefined);

  beforeEach(() => {
    setWindowFullScreen.mockClear();
    sendMediaTransport.mockClear();
    window.localStorage.clear();
    // jsdom deliberately has no canvas implementation. The visualizer already
    // treats a missing context as unavailable; make that path quiet so a shell
    // test reports only failures it can act on.
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: jest.fn(() => null),
    });
    Object.defineProperty(window, 'electron', {
      configurable: true,
      // Mirrors the whole preload surface in src/main/api.ts. `on` must hand
      // back an unsubscribe function, and every window control is invoked as a
      // promise during the first render.
      get: () => ({
        platform: 'win32',
        ipcRenderer: {
          sendMessage: (_channel: Channels, _args: unknown[]) => {},
          on:
            (_channel: Channels, _func: (...args: unknown[]) => void) =>
            () => {},
          once: (_channel: Channels, _func: (...args: unknown[]) => void) => {},
          removeListener: (
            _channel: Channels,
            _func: (...args: unknown[]) => void,
          ) => {},
          closeApp: () => {},
          openEqualizerApoConfigurator: async () => '',
          openEqualizerApoSettings: async () => '',
          restartWindowsAudio: async () => '',
          minimizeWindow: async () => {},
          toggleMaximizeWindow: async () => false,
          closeWindow: async () => {},
          isWindowMaximized: async () => false,
          setWindowFullScreen,
          sendMediaTransport,
        },
      }),
    });
  });

  it('should render', async () => {
    expect(render(<App />)).toBeTruthy();
    await act(async () => Promise.resolve());
  });

  it('starts both output sections collapsed', async () => {
    render(<App />);
    await act(async () => Promise.resolve());

    expect(
      screen.getByRole('button', { name: /Automatic profile/i }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('button', { name: /Second output/i }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('uses the floating titlebar transport for Windows media controls', async () => {
    const { container } = render(<App />);
    await act(async () => Promise.resolve());

    const previous = screen.getByRole('button', {
      name: 'Previous track, anywhere on this computer',
    });
    const playPause = screen.getByRole('button', {
      name: 'Play or pause, anywhere on this computer',
    });
    const next = screen.getByRole('button', {
      name: 'Next track, anywhere on this computer',
    });
    const transport = container.querySelector('.window-titlebar__transport');
    const pet = container.querySelector('.support-pet');
    expect(transport).toBeVisible();
    expect(pet?.nextElementSibling).toBe(transport);
    expect(playPause).toHaveClass('window-control--media-toggle');

    fireEvent.click(previous);
    fireEvent.click(playPause);
    fireEvent.click(next);

    await waitFor(() => {
      expect(sendMediaTransport.mock.calls.map(([action]) => action)).toEqual([
        'previous',
        'playPause',
        'next',
      ]);
    });
  });

  it('changes and persists the interface language from the actions menu', async () => {
    render(<App />);
    await act(async () => Promise.resolve());

    fireEvent.click(screen.getByRole('button', { name: 'FluidEQ actions' }));
    fireEvent.click(screen.getByRole('menu', { name: 'Interface language' }));
    const spanish = screen.getByRole('menuitem', { name: 'Español' });

    // Match the browser's real pointer sequence. The parent menu listens to
    // pointerdown while Dropdown commits the value on click.
    fireEvent.pointerDown(spanish);
    fireEvent.click(spanish);

    expect(document.documentElement).toHaveAttribute('lang', 'es');
    expect(window.localStorage.getItem('fluideq.locale')).toBe('es');
    expect(
      screen.getByRole('button', { name: 'Acciones de FluidEQ' }),
    ).toBeVisible();
    expect(screen.getByText('Apoya el proyecto')).toBeVisible();
  });

  it('opens Karaoke after Media and remembers the selected tab', async () => {
    const { container } = render(<App />);
    await act(async () => Promise.resolve());
    const tabs = screen.getAllByRole('tab');

    expect(tabs.slice(-3).map((tab) => tab.textContent)).toEqual([
      'Media',
      'Karaoke',
      'Config',
    ]);

    const karaokeTab = screen.getByRole('tab', { name: 'Karaoke' });
    expect(container.querySelector('.graph-wrapper')).toBeInTheDocument();
    karaokeTab.focus();
    expect(karaokeTab).toHaveFocus();
    fireEvent.click(karaokeTab);

    expect(karaokeTab).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'A stage built around your music',
      }),
    ).toBeVisible();
    expect(container.querySelector('.karaoke-workspace')).toHaveClass(
      'is-empty',
    );
    expect(container.querySelector('.graph-wrapper')).toBeNull();
    await waitFor(() => {
      expect(window.localStorage.getItem('fluideq.workspaceTab')).toBe(
        'karaoke',
      );
    });
  });

  it('keeps response graph visibility independent for every workspace tab', async () => {
    window.localStorage.setItem(
      'fluideq.graphVisibilityByTab',
      JSON.stringify({ eq: false, autoeq: false, karaoke: true }),
    );
    const { container } = render(<App />);
    await act(async () => Promise.resolve());

    expect(container.querySelector('.graph-wrapper')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Karaoke' }));
    expect(container.querySelector('.graph-wrapper')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'AutoEQ' }));
    expect(container.querySelector('.graph-wrapper')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'EQ' }));
    expect(container.querySelector('.graph-wrapper')).toBeNull();
  });

  it('gives Karaoke its own Ctrl+F and top-corner full-screen control', async () => {
    const { container } = render(<App />);
    await act(async () => Promise.resolve());
    fireEvent.click(screen.getByRole('tab', { name: 'Karaoke' }));

    fireEvent.click(screen.getByRole('button', { name: 'Enter full screen' }));
    await waitFor(() =>
      expect(setWindowFullScreen).toHaveBeenLastCalledWith(true),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Exit full screen' }));
    await waitFor(() =>
      expect(setWindowFullScreen).toHaveBeenLastCalledWith(false),
    );

    setWindowFullScreen.mockClear();
    fireEvent.keyDown(window, { key: 'f', code: 'KeyF', ctrlKey: true });

    await waitFor(() =>
      expect(setWindowFullScreen).toHaveBeenLastCalledWith(true),
    );
    expect(setWindowFullScreen).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.app-workspace')).toHaveClass(
      'is-karaoke-full',
      'has-top-bar',
    );
    expect(
      screen.queryByRole('heading', {
        level: 2,
        name: 'A stage built around your music',
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Exit full screen' }),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole('button', { name: 'Hide the FluidEQ header' }),
    );
    expect(container.querySelector('.app-workspace')).not.toHaveClass(
      'has-top-bar',
    );
    expect(
      container.querySelector('.fullscreen-chrome'),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Show the FluidEQ header' }),
    );
    expect(container.querySelector('.app-workspace')).toHaveClass(
      'has-top-bar',
    );

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    await waitFor(() =>
      expect(setWindowFullScreen).toHaveBeenLastCalledWith(false),
    );
    expect(setWindowFullScreen).toHaveBeenCalledTimes(2);
    expect(container.querySelector('.app-workspace')).not.toHaveClass(
      'is-karaoke-full',
    );
    expect(container.querySelector('.center-workspace')).not.toHaveClass(
      'is-graph-full',
    );
  });

  it.each([
    ['karaoke', 'Karaoke'],
    ['not-a-workspace-tab', 'EQ'],
  ])('restores stored tab %s as %s', async (stored, selected) => {
    window.localStorage.setItem('fluideq.workspaceTab', stored);
    render(<App />);
    await act(async () => Promise.resolve());

    expect(screen.getByRole('tab', { name: selected })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
