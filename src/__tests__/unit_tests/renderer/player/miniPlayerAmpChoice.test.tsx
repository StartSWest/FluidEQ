import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import { type ReactElement, useLayoutEffect } from 'react';
import {
  PLAYER_AMP_CHANNEL,
  PLAYER_HEIGHT_LIMIT_CHANNEL,
  PLAYER_WIDTH_FLOOR_CHANNEL,
  WINDOW_HIDE_FOR_SWITCH_CHANNEL,
  WINDOW_REVEAL_CHANNEL,
} from 'common/windowMode';
import {
  floorPlayerWidth,
  holdPlayerHeight,
  setWindowMode,
} from 'renderer/player/windowModeStore';

let isBackdrop = false;
/** What each amp found on the document when it first measured itself. */
const mockMeasured: string[] = [];

/**
 * An amp as far as the window sees it: on its first frame its parts measure
 * themselves under the stylesheet on the document's root and tell main the
 * height and width they hold the window to (`usePlayerHeightLimit`,
 * `setPlayerWidthNeed`).
 */
const MockAmp = ({ name }: { name: string }) => {
  useLayoutEffect(() => {
    mockMeasured.push(
      `${name} measured under ${document.documentElement.dataset.amp}`,
    );
    holdPlayerHeight(300, 300);
    floorPlayerWidth(480);
  }, [name]);
  return <div data-testid={`${name}-amp`} />;
};

jest.mock('renderer/utils/useIsBackdrop', () => ({
  __esModule: true,
  default: () => isBackdrop,
}));
jest.mock('renderer/player/StageAmp', () => ({
  __esModule: true,
  default: () => <MockAmp name="stage" />,
}));
jest.mock('renderer/player/classic/ClassicAmp', () => ({
  __esModule: true,
  default: () => <MockAmp name="classic" />,
}));

// eslint-disable-next-line import/first
import MiniPlayer from 'renderer/player/MiniPlayer';

afterEach(() => {
  isBackdrop = false;
});

describe('which amp the window is', () => {
  it('is the 2.0 amp in every mode but the Backdrop', () => {
    const { unmount } = render(<MiniPlayer onOpenPage={() => undefined} />);
    expect(screen.getByTestId('classic-amp')).toBeInTheDocument();
    expect(screen.queryByTestId('stage-amp')).not.toBeInTheDocument();
    expect(document.documentElement.dataset.amp).toBe('classic');
    unmount();
  });

  it('is the Stage while the Backdrop is drawn', () => {
    isBackdrop = true;
    const { unmount } = render(<MiniPlayer onOpenPage={() => undefined} />);
    expect(screen.getByTestId('stage-amp')).toBeInTheDocument();
    expect(screen.queryByTestId('classic-amp')).not.toBeInTheDocument();
    expect(document.documentElement.dataset.amp).toBe('stage');
    unmount();
  });

  it('follows the mode as it changes, and leaves no word behind', () => {
    const { rerender, unmount } = render(
      <MiniPlayer onOpenPage={() => undefined} />,
    );
    expect(document.documentElement.dataset.amp).toBe('classic');
    isBackdrop = true;
    act(() => rerender(<MiniPlayer onOpenPage={() => undefined} />));
    expect(screen.getByTestId('stage-amp')).toBeInTheDocument();
    expect(document.documentElement.dataset.amp).toBe('stage');
    unmount();
    // The window is the app again: neither amp's stylesheet applies.
    expect(document.documentElement.dataset.amp).toBeUndefined();
  });
});

// Each amp has a window size of its own (Ivan, 2026-09-28: "we should
// preserve 3 window sizes"), and main puts the window at it when told which
// amp is on screen. Told after the amp's own limits, main applied the new
// amp's height to the old amp's window and then forgot it with the old amp.
describe('what the window is told', () => {
  const sendMessage = jest.fn();

  beforeEach(() => {
    window.electron = {
      ipcRenderer: { sendMessage },
    } as unknown as typeof window.electron;
  });

  afterEach(() => {
    sendMessage.mockReset();
    mockMeasured.length = 0;
  });

  const channels = () =>
    sendMessage.mock.calls.map(([channel]: unknown[]) => channel);

  it('says which amp it is before the amp says what it holds the window to, and the amp measures under its own stylesheet', () => {
    render(<MiniPlayer onOpenPage={() => undefined} />).unmount();
    isBackdrop = true;
    sendMessage.mockReset();
    mockMeasured.length = 0;
    const { unmount } = render(<MiniPlayer onOpenPage={() => undefined} />);
    expect(sendMessage).toHaveBeenCalledWith(PLAYER_AMP_CHANNEL, ['stage']);
    expect(channels().indexOf(PLAYER_AMP_CHANNEL)).toBeLessThan(
      channels().indexOf(PLAYER_HEIGHT_LIMIT_CHANNEL),
    );
    expect(mockMeasured).toEqual(['stage measured under stage']);
    unmount();
  });

  it('says the new amp’s limits again after a change of amp, even where they are the same numbers', () => {
    const { rerender, unmount } = render(
      <MiniPlayer onOpenPage={() => undefined} />,
    );
    sendMessage.mockReset();
    mockMeasured.length = 0;
    isBackdrop = true;
    act(() => rerender(<MiniPlayer onOpenPage={() => undefined} />));
    expect(sendMessage.mock.calls).toEqual([
      [PLAYER_AMP_CHANNEL, ['stage']],
      [PLAYER_HEIGHT_LIMIT_CHANNEL, [300, 300]],
      [PLAYER_WIDTH_FLOOR_CHANNEL, [480]],
    ]);
    expect(mockMeasured).toEqual(['stage measured under stage']);
    unmount();
  });
});

// Ivan, 2026-09-28: "when switching from amp view the UI doesn't show glitchy:
// hide one completely and then show the other when ready, similar to what we
// do for full vs amp".
describe('a change of amp, on Windows', () => {
  const sendMessage = jest.fn();
  /** Main's answer: the window's content is the page's viewport already. */
  const getWindowState = jest.fn(async () => ({
    zoom: 1,
    contentSize: { width: window.innerWidth, height: window.innerHeight },
  }));
  const switchMode = jest.fn();

  beforeEach(() => {
    window.electron = {
      platform: 'win32',
      ipcRenderer: {
        sendMessage,
        getWindowState,
        setWindowMode: switchMode,
      },
    } as unknown as typeof window.electron;
  });

  afterEach(() => {
    sendMessage.mockReset();
    switchMode.mockReset();
    mockMeasured.length = 0;
  });

  const channels = () =>
    sendMessage.mock.calls.map(([channel]: unknown[]) => channel);

  const changeAmp = (
    rerender: (ui: ReactElement) => void,
    toBackdrop: boolean,
  ) => {
    isBackdrop = toBackdrop;
    act(() => rerender(<MiniPlayer onOpenPage={() => undefined} />));
  };

  it('takes the window off the screen before main moves it, and brings it back once the new amp is drawn', async () => {
    const { rerender, unmount } = render(
      <MiniPlayer onOpenPage={() => undefined} />,
    );
    // The first amp comes in with the switch from the full app, which hides
    // the window itself.
    expect(channels()).not.toContain(WINDOW_HIDE_FOR_SWITCH_CHANNEL);
    sendMessage.mockReset();
    changeAmp(rerender, true);
    expect(channels()).toEqual([
      WINDOW_HIDE_FOR_SWITCH_CHANNEL,
      PLAYER_AMP_CHANNEL,
      PLAYER_HEIGHT_LIMIT_CHANNEL,
      PLAYER_WIDTH_FLOOR_CHANNEL,
    ]);
    await waitFor(() => expect(channels()).toContain(WINDOW_REVEAL_CHANNEL));
    expect(sendMessage).toHaveBeenLastCalledWith(WINDOW_REVEAL_CHANNEL, []);
    // Asked after the amp was said, so main's answer is the new amp's size.
    expect(getWindowState).toHaveBeenCalled();
    unmount();
  });

  it('keeps the window off the screen until the page is the new amp’s size', async () => {
    const { rerender, unmount } = render(
      <MiniPlayer onOpenPage={() => undefined} />,
    );
    // Main has put the window at the Stage's own 900 by 600; the page has
    // not heard yet.
    const was = { width: window.innerWidth, height: window.innerHeight };
    getWindowState.mockImplementation(async () => ({
      zoom: 1,
      contentSize: { width: 900, height: 600 },
    }));
    sendMessage.mockReset();
    changeAmp(rerender, true);
    await act(async () => {
      for (let frame = 0; frame < 4; frame += 1) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => {
          requestAnimationFrame(resolve);
        });
      }
    });
    expect(channels()).not.toContain(WINDOW_REVEAL_CHANNEL);
    Object.assign(window, { innerWidth: 900, innerHeight: 600 });
    window.dispatchEvent(new Event('resize'));
    await waitFor(() =>
      expect(sendMessage).toHaveBeenLastCalledWith(WINDOW_REVEAL_CHANNEL, []),
    );
    Object.assign(window, { innerWidth: was.width, innerHeight: was.height });
    getWindowState.mockImplementation(async () => ({
      zoom: 1,
      contentSize: { width: window.innerWidth, height: window.innerHeight },
    }));
    unmount();
  });

  it('leaves the window to a newer change, and brings it back once', async () => {
    const { rerender, unmount } = render(
      <MiniPlayer onOpenPage={() => undefined} />,
    );
    sendMessage.mockReset();
    changeAmp(rerender, true);
    changeAmp(rerender, false);
    await waitFor(() => expect(channels()).toContain(WINDOW_REVEAL_CHANNEL));
    const reveals = channels().filter(
      (channel) => channel === WINDOW_REVEAL_CHANNEL,
    );
    expect(reveals).toHaveLength(1);
    expect(sendMessage).toHaveBeenLastCalledWith(WINDOW_REVEAL_CHANNEL, []);
    expect(
      sendMessage.mock.calls.filter(
        ([channel]) => channel === PLAYER_AMP_CHANNEL,
      ),
    ).toEqual([
      [PLAYER_AMP_CHANNEL, ['stage']],
      [PLAYER_AMP_CHANNEL, ['classic']],
    ]);
    unmount();
  });

  it('leaves the window to a switch to the full app begun in the middle of it', async () => {
    let answer: (mode: string) => void = () => undefined;
    switchMode.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const { rerender, unmount } = render(
      <MiniPlayer onOpenPage={() => undefined} />,
    );
    changeAmp(rerender, true);
    sendMessage.mockReset();
    const switching = setWindowMode('app');
    // Every answer and every frame the amp's own come-back would wait for —
    // two answers from main, then two frames — and two frames more.
    await act(async () => {
      for (let frame = 0; frame < 4; frame += 1) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => {
          requestAnimationFrame(resolve);
        });
      }
    });
    expect(channels()).not.toContain(WINDOW_REVEAL_CHANNEL);
    answer('app');
    await act(async () => {
      await switching;
    });
    expect(
      channels().filter((channel) => channel === WINDOW_REVEAL_CHANNEL),
    ).toHaveLength(1);
    unmount();
  });
});
