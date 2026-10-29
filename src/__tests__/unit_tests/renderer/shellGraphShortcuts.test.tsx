/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import useShellFullScreen from '../../../renderer/shell/useShellFullScreen';
import useTabGraph from '../../../renderer/shell/useTabGraph';
import {
  exitGraphFullScreen,
  toggleGraphExpanded,
  toggleGraphFullScreen,
} from '../../../renderer/utils/graphStyle';
import {
  WORKSPACE_TABS,
  type TWorkspaceTab,
} from '../../../renderer/workspaceTabs';

jest.mock('../../../renderer/utils/graphStyle', () => ({
  getGraphView: () => 'normal',
  useFullScreenTopBar: () => true,
  onWindowFullScreenChange: jest.fn(),
  toggleGraphExpanded: jest.fn(),
  toggleGraphFullScreen: jest.fn(),
  exitGraphFullScreen: jest.fn(),
}));
jest.mock('../../../renderer/utils/idleChrome', () => ({
  useIsChromeIdle: () => false,
  useIsPointerNearChrome: () => true,
  useIsPointerNearSideChrome: () => false,
  watchChromeIdle: jest.fn(),
}));
jest.mock('../../../renderer/player/windowModeStore', () => ({
  afterNextFrame: () => Promise.resolve(),
  untilViewportIsWindow: () => Promise.resolve(),
}));
jest.mock('../../../renderer/player/playerLayout', () => ({
  setPlayerVisFull: jest.fn(),
}));
jest.mock('../../../renderer/graph/graphArrival', () => ({
  holdGraphUntil: jest.fn(),
}));

const enableGraph = jest.fn();
function Shell({
  page,
  showsGraph,
}: {
  page: TWorkspaceTab;
  showsGraph: boolean;
}) {
  useShellFullScreen({
    activeWorkspaceTab: page,
    showsGraph,
    graphView: 'normal',
    isPlayerVisFull: false,
    setActiveTabGraphVisibility: enableGraph,
  });
  return null;
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  window.electron = {
    ipcRenderer: {
      getWindowState: () => Promise.resolve({ isFullScreen: false }),
      on: () => () => undefined,
      setWindowFullScreen: jest.fn().mockResolvedValue(true),
    },
  } as unknown as typeof window.electron;
});
afterEach(cleanup);

function GraphSwitch({ page }: { page: TWorkspaceTab }) {
  const { showsGraph, setActiveTabGraphVisibility } = useTabGraph({
    activeWorkspaceTab: page,
    graphView: 'expanded',
    isGraphViewOn: true,
  });
  return (
    <button
      type="button"
      aria-pressed={showsGraph}
      onClick={() => setActiveTabGraphVisibility(!showsGraph)}
    >
      Graph
    </button>
  );
}

it.each(['karaoke', 'library', 'community'] as const)(
  'respects the %s graph switch even while a larger mode was selected',
  (page) => {
    render(<GraphSwitch page={page} />);
    const control = screen.getByRole('button', { name: 'Graph' });
    expect(control.getAttribute('aria-pressed')).toBe('false');
    expect(exitGraphFullScreen).toHaveBeenCalledTimes(1);
    fireEvent.click(control);
    expect(control.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(control);
    expect(control.getAttribute('aria-pressed')).toBe('false');
    expect(exitGraphFullScreen).toHaveBeenCalledTimes(2);
  },
);

const shortcut = (key: string, target: EventTarget = window) => {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
};

it.each(WORKSPACE_TABS)(
  'does not open a hidden graph or native Save/Find on %s',
  async (page) => {
    await act(async () => {
      render(<Shell page={page} showsGraph={false} />);
    });
    expect(shortcut('s').defaultPrevented).toBe(true);
    expect(shortcut('f').defaultPrevented).toBe(true);
    expect(enableGraph).not.toHaveBeenCalled();
    expect(toggleGraphExpanded).not.toHaveBeenCalled();
    expect(toggleGraphFullScreen).not.toHaveBeenCalled();
  },
);

it.each(['karaoke', 'library', 'video'] as const)(
  'expands and takes the enabled %s graph fullscreen',
  async (page) => {
    await act(async () => {
      render(<Shell page={page} showsGraph />);
    });
    expect(shortcut('s').defaultPrevented).toBe(true);
    expect(toggleGraphExpanded).toHaveBeenCalledTimes(1);
    expect(shortcut('f').defaultPrevented).toBe(true);
    expect(toggleGraphFullScreen).toHaveBeenCalledTimes(1);
  },
);

it.each(['eq', 'config', 'community'] as const)(
  'leaves enabled %s graph shortcuts to its own chart listener',
  async (page) => {
    await act(async () => {
      render(<Shell page={page} showsGraph />);
    });
    const heard = jest.fn();
    window.addEventListener('keydown', heard);
    try {
      expect(shortcut('s').defaultPrevented).toBe(false);
      expect(shortcut('f').defaultPrevented).toBe(false);
      expect(heard).toHaveBeenCalledTimes(2);
    } finally {
      window.removeEventListener('keydown', heard);
    }
  },
);

it('protects a hidden Karaoke graph from Ctrl+W, and permits the visible graph', async () => {
  const { rerender } = render(<Shell page="karaoke" showsGraph={false} />);
  await act(async () => Promise.resolve());
  expect(shortcut('w').defaultPrevented).toBe(true);
  rerender(<Shell page="karaoke" showsGraph />);
  expect(shortcut('w').defaultPrevented).toBe(false);
});

it('does not steal the compact player shortcuts from the page behind it', async () => {
  await act(async () => {
    render(<Shell page="karaoke" showsGraph={false} />);
  });
  const amp = document.createElement('div');
  amp.className = 'mini-player-host';
  document.body.appendChild(amp);
  try {
    expect(shortcut('s', amp).defaultPrevented).toBe(false);
    expect(shortcut('f', amp).defaultPrevented).toBe(false);
  } finally {
    amp.remove();
  }
});
