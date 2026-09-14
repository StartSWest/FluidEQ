/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type {
  IWallpaperScreen,
  IWallpaperState,
} from '../../../common/wallpaper';
import WallpaperDialog from '../../../renderer/wallpaper/WallpaperDialog';
import WallpaperManageDialog from '../../../renderer/wallpaper/WallpaperManageDialog';
import { WallpaperStatus } from '../../../renderer/wallpaper/WallpaperControls';
import {
  startWallpaper,
  useWallpaperState,
} from '../../../renderer/wallpaper/wallpaperStore';

jest.mock('../../../renderer/wallpaper/wallpaperStore', () => ({
  useWallpaperState: jest.fn(),
  useWallpaperMutation: () => ({ pending: false }),
  startWallpaper: jest.fn(async () => ({ screens: [] })),
  stopWallpaper: jest.fn(async () => ({ screens: [] })),
}));
jest.mock('../../../renderer/wallpaper/wallpaperLooks', () => ({
  __esModule: true,
  default: () => (lookId: string) => ({
    name: lookId === 'premium:aurora' ? 'Aurora' : 'Alpine',
    swatch: ['#0b1f2c', '#00e5cf'],
  }),
}));
jest.mock('../../../renderer/utils/graphViewSettings', () => ({
  getWatchedGraphWave: () => ({ height: 0.75, position: 0.1 }),
}));

const displays: IWallpaperState['displays'] = [
  {
    id: 1,
    label: '',
    x: -2560,
    y: 0,
    width: 2560,
    height: 1600,
    primary: false,
  },
  {
    id: 2,
    label: 'Y27qf-30',
    x: 0,
    y: 0,
    width: 2560,
    height: 1440,
    primary: true,
  },
  {
    id: 3,
    label: 'Odyssey G5',
    x: 2560,
    y: 0,
    width: 2560,
    height: 1440,
    primary: false,
  },
];

const showing = (
  displayId: number,
  over: Partial<IWallpaperScreen> = {},
): IWallpaperScreen => ({
  displayId,
  lookId: 'premium:aurora',
  wave: { height: 0.4, position: 0.65 },
  motion: 'calm',
  phase: 'running',
  ...over,
});

const withScreens = (screens: IWallpaperScreen[]) =>
  jest.mocked(useWallpaperState).mockReturnValue({
    supported: true,
    displays,
    screens,
    pauseOnBattery: false,
  });

beforeEach(() => jest.clearAllMocks());

describe('choosing how a background moves', () => {
  it('starts on the music, and sets it calm on the chosen monitor with the graph’s wave', async () => {
    withScreens([]);
    render(<WallpaperDialog lookId="premium:alpine" onClose={jest.fn()} />);
    const music = screen.getByRole('radio', { name: /With the music/ });
    const calm = screen.getByRole('radio', { name: /Calm/ });
    expect(music).toBeChecked();
    expect(calm).not.toBeChecked();

    fireEvent.click(calm);
    expect(calm).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Set background' }));
    expect(startWallpaper).toHaveBeenCalledWith({
      lookId: 'premium:alpine',
      displayIds: [2],
      pauseOnBattery: false,
      wave: { height: 0.75, position: 0.1 },
      motion: 'calm',
    });
    await screen.findByRole('dialog');
  });

  it('sets it with the wave it was given, when it was given one', () => {
    withScreens([]);
    render(
      <WallpaperDialog
        lookId="premium:alpine"
        wave={{ height: 0.2, position: 0.9 }}
        onClose={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Set background' }));
    expect(startWallpaper).toHaveBeenCalledWith(
      expect.objectContaining({
        wave: { height: 0.2, position: 0.9 },
        motion: 'music',
      }),
    );
  });

  it('opens on Calm when every monitor showing this visualizer is calm', () => {
    withScreens([showing(3), showing(1)]);
    render(<WallpaperDialog lookId="premium:aurora" onClose={jest.fn()} />);
    expect(screen.getByRole('radio', { name: /Calm/ })).toBeChecked();
  });

  it('opens on the music when any monitor showing it follows the music', () => {
    withScreens([showing(3), showing(1, { motion: 'music' })]);
    render(<WallpaperDialog lookId="premium:aurora" onClose={jest.fn()} />);
    expect(screen.getByRole('radio', { name: /With the music/ })).toBeChecked();
  });
});

describe('what each monitor shows', () => {
  it('switches a playing monitor between calm and the music, keeping its wave', () => {
    withScreens([
      showing(3),
      showing(2, { lookId: 'premium:alpine', motion: 'music' }),
    ]);
    render(<WallpaperManageDialog onClose={jest.fn()} />);
    const rows = screen.getAllByRole('listitem');
    const odyssey = rows.find((row) => within(row).queryByText('Odyssey G5'));
    const middle = rows.find((row) => within(row).queryByText('Y27qf-30'));
    if (!odyssey || !middle) {
      throw new Error('each monitor should have its row');
    }
    const calmOnOdyssey = within(odyssey).getByRole('button', { name: 'Calm' });
    expect(calmOnOdyssey).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(middle).getByRole('button', { name: 'Calm' }),
    ).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(calmOnOdyssey);
    expect(startWallpaper).toHaveBeenCalledWith({
      lookId: 'premium:aurora',
      displayIds: [3],
      pauseOnBattery: false,
      wave: { height: 0.4, position: 0.65 },
      motion: 'music',
    });
  });

  it('offers a stopped monitor a retry that keeps how it moved, not a Calm switch', () => {
    withScreens([showing(3, { phase: 'error', error: 'host' })]);
    render(<WallpaperManageDialog onClose={jest.fn()} />);
    expect(
      screen.queryByRole('button', { name: 'Calm' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(startWallpaper).toHaveBeenCalledWith(
      expect.objectContaining({ displayIds: [3], motion: 'calm' }),
    );
  });

  it('says Calm on the tile of a monitor playing calm', () => {
    withScreens([showing(3)]);
    render(<WallpaperManageDialog onClose={jest.fn()} />);
    expect(
      screen.getByRole('img', { name: /Odyssey G5, Aurora/ }),
    ).toHaveTextContent('Calm');
  });
});

describe('the line beside the Visualizers title', () => {
  // Unplugged is waiting, not broken: its background comes back with it.
  it('does not raise an alarm for a monitor that is only unplugged', () => {
    withScreens([
      showing(2, { motion: 'music' }),
      showing(7, { phase: 'error', error: 'missing-display' }),
    ]);
    render(<WallpaperStatus />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Desktop background is playing',
    );
  });

  it('alarms for a monitor that stopped for a reason', () => {
    withScreens([showing(2, { phase: 'error', error: 'renderer' })]);
    render(<WallpaperStatus />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
