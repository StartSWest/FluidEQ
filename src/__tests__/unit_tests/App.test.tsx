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
import {
  DISCLAIMER_ACCEPTED_KEY,
  buildAcceptance,
} from '../../common/disclaimer';
import { VIDEO_GRAPH_FULLSCREEN_REQUEST } from '../../common/videoSites';
import App from '../../renderer/App';
import { Channels } from '../../main/api';
import {
  claimPlayback,
  resetPlaybackOwner,
} from '../../renderer/audio/playbackOwner';
import { setGraphView } from '../../renderer/utils/graphStyle';

describe('App', () => {
  const setWindowFullScreen = jest.fn(async (next: boolean) => next);
  const sendMediaTransport = jest.fn(async (_action: string) => undefined);

  beforeEach(() => {
    setWindowFullScreen.mockClear();
    sendMediaTransport.mockClear();
    resetPlaybackOwner();
    setGraphView('normal');
    window.localStorage.clear();
    // The first-run acknowledgement is a gate: on a profile that has never
    // accepted it, it takes the window and holds focus, and every assertion
    // below about the workspace would be an assertion about a dialog covering
    // it. Recorded here so these tests are about the app, and asserted on its
    // own terms in the last test in this file.
    window.localStorage.setItem(
      DISCLAIMER_ACCEPTED_KEY,
      JSON.stringify(buildAcceptance('1.2.0', 'en')),
    );
    // jsdom deliberately has no canvas implementation. The visualizer already
    // treats a missing context as unavailable; make that path quiet so a shell
    // test reports only failures it can act on.
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: jest.fn(() => null),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: jest.fn(async () => undefined),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: jest.fn(() => undefined),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'load', {
      configurable: true,
      value: jest.fn(() => undefined),
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
          releaseKaraokeSeparationModel: jest.fn(),
          getLibraryIndex: async () => ({
            index: { version: 1, roots: [], tracks: [] },
            wasReset: false,
          }),
          onLibraryScanProgress: () => () => {},
          onLibraryTracksAdded: () => () => {},
          onLibraryIndexChanged: () => () => {},
        },
      }),
    });
  });

  it('should render', async () => {
    expect(render(<App />)).toBeTruthy();
    await act(async () => Promise.resolve());
  });

  it('keeps the official website in a fixed right-pane footer', async () => {
    const { container } = render(<App />);
    await act(async () => Promise.resolve());

    const website = screen.getByRole('link', {
      name: 'Open fluideq.com in your browser',
    });
    expect(website).toBeVisible();
    expect(website).toHaveAttribute('href', 'https://fluideq.com');
    expect(website).toHaveAttribute('target', '_blank');
    const footer = website.closest('.right-content__footer');
    const scrollArea = container.querySelector('.right-content__scroll');
    expect(footer).not.toBeNull();
    expect(scrollArea).not.toBeNull();
    expect(scrollArea).not.toContainElement(footer as HTMLElement);
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

  // This used to pin the transport the titlebar carried. There is one
  // transport in this app now — the card at the foot of the window — and the
  // row that stood here sent Windows media keys rather than driving anything
  // in FluidEQ: one press acted on whatever external application had last
  // claimed the key, which is a different thing from the play button beside
  // it and was never obvious from looking at them. Kept as the inverse
  // assertion so a second transport cannot quietly reappear.
  it('keeps no second transport in the titlebar', async () => {
    const { container } = render(<App />);
    await act(async () => Promise.resolve());

    expect(container.querySelector('.window-titlebar__transport')).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: 'Play or pause, anywhere on this computer',
      }),
    ).toBeNull();
    expect(sendMediaTransport).not.toHaveBeenCalled();
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

  it('puts DSP beside EQ and remembers the selected tab', async () => {
    const { container } = render(<App />);
    await act(async () => Promise.resolve());
    const tabs = screen.getAllByRole('tab');

    // The strip itself: five places. The equaliser's five — bands, presets,
    // voicing, convolution, config — are pills inside the EQ page, which is
    // why DSP is top-level rather than mixed into the APO pages.
    //
    // DSP sits immediately after EQ, because the rack is the rest of the signal
    // chain the EQ tab starts: someone who has just set a curve reaches for the
    // compressor, not past Library and Karaoke to the end of the strip. That
    // is what this asserts, and it is unchanged.
    //
    // What did change is where the strip breaks. The five used to be one run;
    // they are now dealt into two so the meter between them sits in the
    // window's actual middle, and Online Media — the longest name — is the one
    // on the left balancing the three short ones on the right. So it leads the
    // DOM order without leading the group EQ belongs to.
    //
    // "Online Media" and not "Media": jsdom has no `matchMedia`, which
    // `useMediaQuery` reads as "not narrow", so this is the wide-window strip.
    expect(tabs.slice(0, 5).map((tab) => tab.textContent)).toEqual([
      'Online Media',
      'EQ',
      'DSP',
      'Library',
      'Karaoke',
    ]);
    expect(screen.getByRole('tab', { name: 'DSP' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'DSP' }),
    ).not.toBeInTheDocument();

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
      JSON.stringify({ eq: false, presets: false, karaoke: true }),
    );
    const { container } = render(<App />);
    await act(async () => Promise.resolve());

    expect(container.querySelector('.graph-wrapper')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Karaoke' }));
    expect(container.querySelector('.graph-wrapper')).toBeInTheDocument();

    // Presets is a pill inside the EQ page now rather than a tab of its own,
    // so reaching it means going to that page first — which is the point of
    // the split, and changes nothing about what each of them remembers.
    fireEvent.click(screen.getByRole('tab', { name: 'EQ' }));
    expect(container.querySelector('.graph-wrapper')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'EQ Presets' }));
    expect(container.querySelector('.graph-wrapper')).toBeNull();
  });

  it('uses the media surface for its control and graph fullscreen for Ctrl+F', async () => {
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
      'is-app-full',
      'has-top-bar',
    );
    expect(container.querySelector('.app-workspace')).not.toHaveClass(
      'is-media-full',
      'is-karaoke-full',
      'has-karaoke-graph',
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

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    await waitFor(() =>
      expect(setWindowFullScreen).toHaveBeenLastCalledWith(false),
    );
    expect(setWindowFullScreen).toHaveBeenCalledTimes(2);
    expect(container.querySelector('.app-workspace')).not.toHaveClass(
      'is-media-full',
      'is-karaoke-full',
    );
    expect(container.querySelector('.center-workspace')).not.toHaveClass(
      'is-graph-full',
    );
  });

  it.each([
    ['karaoke', 'Karaoke', '.karaoke-workspace'],
    ['library', 'Library', '.library-workspace'],
  ] as const)(
    'keeps Online Media hidden when %s owns the graph backdrop',
    async (owner, tabName, ownerSelector) => {
      const { container } = render(<App />);
      await act(async () => Promise.resolve());
      fireEvent.click(screen.getByRole('tab', { name: tabName }));
      act(() => claimPlayback(owner));
      fireEvent.click(screen.getByRole('tab', { name: 'Online Media' }));

      fireEvent.keyDown(window, { key: 'f', code: 'KeyF', ctrlKey: true });
      await waitFor(() =>
        expect(setWindowFullScreen).toHaveBeenLastCalledWith(true),
      );

      await waitFor(() =>
        expect(container.querySelector('.video-browser')).toHaveClass(
          'is-hidden',
        ),
      );
      expect(container.querySelector(ownerSelector)).toHaveClass(
        owner === 'karaoke' ? 'is-graph-overlay' : 'is-playback-backdrop',
      );

      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
      await waitFor(() =>
        expect(setWindowFullScreen).toHaveBeenLastCalledWith(false),
      );
    },
  );

  it('restores a Library graph fullscreen double-click that passes through the graph', async () => {
    const { container } = render(<App />);
    await act(async () => Promise.resolve());
    fireEvent.click(screen.getByRole('tab', { name: 'Library' }));
    act(() => claimPlayback('library'));

    fireEvent.keyDown(window, { key: 'f', code: 'KeyF', ctrlKey: true });
    await waitFor(() =>
      expect(container.querySelector('.center-workspace')).toHaveClass(
        'is-graph-full',
      ),
    );

    const librarySurface = container.querySelector('.library-workspace');
    expect(librarySurface).not.toBeNull();
    fireEvent.doubleClick(librarySurface as HTMLElement);

    await waitFor(() =>
      expect(container.querySelector('.center-workspace')).not.toHaveClass(
        'is-graph-full',
      ),
    );
    await waitFor(() =>
      expect(setWindowFullScreen).toHaveBeenLastCalledWith(false),
    );
  });

  it.each([
    ['expanded', 's', 'KeyS', 0],
    ['fullscreen', 'f', 'KeyF', 2],
  ] as const)(
    'exits graph %s when the workspace tab changes',
    async (_mode, key, code, expectedFullScreenCalls) => {
      const { container } = render(<App />);
      await act(async () => Promise.resolve());
      fireEvent.click(screen.getByRole('tab', { name: 'Online Media' }));
      act(() => claimPlayback('media'));

      fireEvent.keyDown(window, { key, code, ctrlKey: true });
      await waitFor(() =>
        expect(container.querySelector('.center-workspace')).toHaveClass(
          'is-graph-full',
        ),
      );

      fireEvent.click(screen.getByRole('tab', { name: 'Library' }));
      await waitFor(() =>
        expect(container.querySelector('.center-workspace')).not.toHaveClass(
          'is-graph-full',
        ),
      );
      await waitFor(() =>
        expect(setWindowFullScreen).toHaveBeenCalledTimes(
          expectedFullScreenCalls,
        ),
      );
    },
  );

  it('keeps player fullscreen across media tabs and exits it for EQ or DSP', async () => {
    const { container } = render(<App />);
    await act(async () => Promise.resolve());
    fireEvent.click(screen.getByRole('tab', { name: 'Karaoke' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enter full screen' }));
    await waitFor(() =>
      expect(setWindowFullScreen).toHaveBeenLastCalledWith(true),
    );

    setWindowFullScreen.mockClear();
    fireEvent.click(screen.getByRole('tab', { name: 'Library' }));
    expect(container.querySelector('.app-workspace')).toHaveClass(
      'is-app-full',
    );
    expect(setWindowFullScreen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('tab', { name: 'Online Media' }));
    expect(container.querySelector('.app-workspace')).toHaveClass(
      'is-app-full',
    );
    expect(setWindowFullScreen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('tab', { name: 'EQ' }));
    await waitFor(() =>
      expect(setWindowFullScreen).toHaveBeenLastCalledWith(false),
    );

    setWindowFullScreen.mockClear();
    fireEvent.click(screen.getByRole('tab', { name: 'Karaoke' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enter full screen' }));
    await waitFor(() =>
      expect(setWindowFullScreen).toHaveBeenLastCalledWith(true),
    );
    fireEvent.click(screen.getByRole('tab', { name: 'DSP' }));
    await waitFor(() =>
      expect(setWindowFullScreen).toHaveBeenLastCalledWith(false),
    );
  });

  it('promotes an Online Media HTML-fullscreen request to the shared app surface', async () => {
    const { container } = render(<App />);
    await act(async () => Promise.resolve());
    fireEvent.click(screen.getByRole('tab', { name: 'Online Media' }));

    const view = container.querySelector('webview');
    if (!view) {
      throw new Error('Online Media did not mount its webview');
    }
    const executeJavaScript = jest.fn(async () => undefined);
    Object.defineProperty(view, 'executeJavaScript', {
      configurable: true,
      value: executeJavaScript,
    });

    fireEvent(view as HTMLElement, new Event('enter-html-full-screen'));

    await waitFor(() =>
      expect(setWindowFullScreen).toHaveBeenLastCalledWith(true),
    );
    expect(executeJavaScript).toHaveBeenCalled();
    expect(container.querySelector('.app-workspace')).toHaveClass(
      'is-app-full',
      'is-media-full',
    );
    expect(container.querySelector('.video-browser')).toHaveClass(
      'is-fullscreen',
    );
  });

  it('turns a guest video double-click into graph fullscreen', async () => {
    const { container } = render(<App />);
    await act(async () => Promise.resolve());
    fireEvent.click(screen.getByRole('tab', { name: 'Online Media' }));
    act(() => claimPlayback('media'));

    const view = container.querySelector('webview');
    if (!view) {
      throw new Error('Online Media did not mount its webview');
    }
    const request = new Event('ipc-message');
    Object.defineProperty(request, 'channel', {
      value: VIDEO_GRAPH_FULLSCREEN_REQUEST,
    });
    fireEvent(view as HTMLElement, request);

    await waitFor(() =>
      expect(setWindowFullScreen).toHaveBeenLastCalledWith(true),
    );
    expect(container.querySelector('.center-workspace')).toHaveClass(
      'is-graph-full',
    );
    expect(container.querySelector('.video-browser')).toHaveClass(
      'is-playback-backdrop',
    );
    expect(container.querySelector('.video-browser')).not.toHaveClass(
      'is-fullscreen',
    );

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    await waitFor(() =>
      expect(setWindowFullScreen).toHaveBeenLastCalledWith(false),
    );
  });

  it.each([
    ['karaoke', 'Karaoke'],
    ['dsp', 'DSP'],
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

  it('puts the acknowledgement in front of the workspace on a fresh profile', async () => {
    // The one test here that does not clear the gate first. Everything above
    // asserts the app is usable; this asserts that on a machine that has never
    // seen the disclaimer, it is not — which is the whole point of mounting it.
    window.localStorage.removeItem(DISCLAIMER_ACCEPTED_KEY);
    render(<App />);
    await act(async () => Promise.resolve());

    const gate = screen.getByRole('alertdialog');
    expect(gate).toHaveAttribute('aria-modal', 'true');
    expect(gate).toContainElement(document.activeElement as HTMLElement);
  });
});
