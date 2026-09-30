/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The desktop dialog plays the visualizer being placed in the monitor it is
 * going to (Ivan, 2026-09-28: "shows the preview on the desktop"): the first
 * chosen monitor on the desk, one scene at a time, and a tile whose scene
 * cannot play keeps its still frame and its drawn glass.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type {
  IWallpaperScreen,
  IWallpaperState,
} from '../../../common/wallpaper';
import type { TPreviewTrouble } from '../../../renderer/plus/ScenePreview';
import WallpaperDialog from '../../../renderer/wallpaper/WallpaperDialog';
import { useWallpaperState } from '../../../renderer/wallpaper/wallpaperStore';

jest.mock('../../../renderer/wallpaper/wallpaperStore', () => ({
  useWallpaperState: jest.fn(),
  useWallpaperMutation: () => ({ pending: false }),
  startWallpaper: jest.fn(async () => ({ screens: [] })),
  stopWallpaper: jest.fn(async () => ({ screens: [] })),
}));

const mockLoad = jest.fn();
// Aurora can be played; Lost is a look uninstalled since it was set, which
// has nothing to play and no frame.
jest.mock('../../../renderer/wallpaper/wallpaperLooks', () => ({
  __esModule: true,
  default: () => (lookId: string) =>
    lookId === 'premium:aurora'
      ? {
          name: 'Aurora',
          swatch: ['#0b1f2c', '#00e5cf'],
          picture: { lookId, version: '3', load: mockLoad },
          madeBy: 'fluideq',
        }
      : { name: 'Lost', swatch: [] },
}));
// No still frame anywhere, as on a machine that cannot draw the scene: what
// the glass shows then is only what the scene and the tile draw.
jest.mock('../../../renderer/graph/lookThumbnails', () => ({
  useLookThumbnail: () => ({ state: 'none' }),
}));
jest.mock('../../../renderer/utils/graphOverlaySettings', () => ({
  getWatchedGraphWave: () => ({ height: 0.75, position: 0.1 }),
}));
let mockTrouble: ((trouble: TPreviewTrouble) => void) | undefined;
jest.mock('../../../renderer/plus/ScenePreview', () => ({
  __esModule: true,
  default: (props: {
    identity: string;
    madeBy: string;
    onTrouble: (trouble: TPreviewTrouble) => void;
    wave?: { height: number; position: number };
  }) => {
    mockTrouble = props.onTrouble;
    return (
      <i
        data-testid="playing"
        data-identity={props.identity}
        data-maker={props.madeBy}
        data-wave={JSON.stringify(props.wave)}
      />
    );
  },
}));

const display = (
  id: number,
  label: string,
  x: number,
  primary = false,
): IWallpaperState['displays'][number] => ({
  id,
  label,
  x,
  y: 0,
  width: 2560,
  height: 1440,
  primary,
});

const withScreens = (screens: IWallpaperScreen[]) =>
  jest.mocked(useWallpaperState).mockReturnValue({
    supported: true,
    // Listed out of desk order: the desk, left to right, decides.
    displays: [
      display(3, 'Odyssey G5', 2560),
      display(2, 'Y27qf-30', 0, true),
      display(1, 'Dell U2720Q', -2560),
    ],
    screens,
    pauseOnBattery: false,
  });

const showing = (displayId: number): IWallpaperScreen => ({
  displayId,
  lookId: 'premium:aurora',
  wave: { height: 0.4, position: 0.65 },
  motion: 'music',
  phase: 'running',
});

const tile = (name: RegExp) => screen.getByRole('checkbox', { name });
const glassOf = (name: RegExp) =>
  tile(name).querySelector('.wallpaper-monitor__glass');

beforeEach(() => {
  mockLoad.mockReset().mockResolvedValue({ id: 'aurora' });
  mockTrouble = undefined;
});

it('plays the visualizer in the first chosen monitor on the desk, and only there', async () => {
  withScreens([showing(3), showing(2)]);
  render(<WallpaperDialog lookId="premium:aurora" onClose={jest.fn()} />);
  const playing = await within(tile(/Y27qf-30/)).findByTestId('playing');
  expect(playing).toHaveAttribute('data-identity', 'premium:aurora@3');
  expect(playing).toHaveAttribute('data-maker', 'fluideq');
  // The graph's wave, as the monitor will be set with it.
  expect(playing).toHaveAttribute(
    'data-wave',
    JSON.stringify({ height: 0.75, position: 0.1 }),
  );
  expect(screen.getAllByTestId('playing')).toHaveLength(1);
  expect(tile(/Odyssey G5/)).toHaveAttribute('aria-checked', 'true');
  expect(mockLoad).toHaveBeenCalledTimes(1);
});

it('moves to the monitor the choice leaves first', async () => {
  withScreens([]);
  render(<WallpaperDialog lookId="premium:aurora" onClose={jest.fn()} />);
  await within(tile(/Y27qf-30/)).findByTestId('playing');

  // A monitor further right joins the choice: the scene stays where it is.
  fireEvent.click(tile(/Odyssey G5/));
  expect(within(tile(/Y27qf-30/)).getByTestId('playing')).toBeInTheDocument();
  expect(within(tile(/Odyssey G5/)).queryByTestId('playing')).toBeNull();

  // One further left does, and it plays there instead.
  fireEvent.click(tile(/Dell U2720Q/));
  expect(
    within(tile(/Dell U2720Q/)).getByTestId('playing'),
  ).toBeInTheDocument();
  expect(screen.getAllByTestId('playing')).toHaveLength(1);

  // Loaded once for the dialog, wherever it plays.
  expect(mockLoad).toHaveBeenCalledTimes(1);
});

it('keeps the drawn glass on a tile whose scene cannot play', async () => {
  withScreens([]);
  render(<WallpaperDialog lookId="premium:aurora" onClose={jest.fn()} />);
  await within(tile(/Y27qf-30/)).findByTestId('playing');
  // POSITIVE CONTROL: playing, the glass counts as pictured.
  expect(glassOf(/Y27qf-30/)).toHaveClass('wallpaper-monitor__glass--pictured');

  act(() => mockTrouble?.('compile'));
  expect(screen.queryByTestId('playing')).toBeNull();
  // No frame to fall back on here, so the glass is drawn as it is for any
  // monitor, not left blank as if a picture were on it.
  expect(glassOf(/Y27qf-30/)).not.toHaveClass(
    'wallpaper-monitor__glass--pictured',
  );
});

it('never pictures a scene that did not load, or a look with nothing to play', async () => {
  mockLoad.mockRejectedValue(new Error('not installed'));
  withScreens([]);
  const { unmount } = render(
    <WallpaperDialog lookId="premium:aurora" onClose={jest.fn()} />,
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(mockLoad).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('playing')).toBeNull();
  expect(glassOf(/Y27qf-30/)).not.toHaveClass(
    'wallpaper-monitor__glass--pictured',
  );
  unmount();

  render(<WallpaperDialog lookId="premium:lost" onClose={jest.fn()} />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.queryByTestId('playing')).toBeNull();
  expect(mockLoad).toHaveBeenCalledTimes(1);
});
