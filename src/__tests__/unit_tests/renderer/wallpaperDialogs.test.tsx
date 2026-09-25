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
// Aurora can be pictured; Alpine is a look with no frame anywhere, which
// keeps its maker's colours.
jest.mock('../../../renderer/wallpaper/wallpaperLooks', () => ({
  __esModule: true,
  default: () => (lookId: string) => ({
    name: lookId === 'premium:aurora' ? 'Aurora' : 'Alpine',
    swatch: ['#0b1f2c', '#00e5cf'],
    picture:
      lookId === 'premium:aurora'
        ? { lookId, version: '1' }
        : { lookId, version: '' },
  }),
}));
jest.mock('../../../renderer/graph/lookThumbnails', () => ({
  useLookThumbnail: (ref: { lookId: string; version: string }) =>
    ref.version
      ? { state: 'ready', url: `picture:${ref.lookId}` }
      : { state: 'none' },
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
      followsGraph: false,
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

  // The choice used to be made on two colours on a glass; it is made on a
  // frame of the scene, on the monitor it will play on.
  it('shows a frame of the visualizer on the monitor it will play on, and how it will move', () => {
    withScreens([]);
    render(<WallpaperDialog lookId="premium:aurora" onClose={jest.fn()} />);
    const dialog = screen.getByRole('dialog');
    const pictures = [
      ...dialog.querySelectorAll('.wallpaper-monitor__picture'),
    ];
    expect(pictures.map((picture) => picture.getAttribute('src'))).toEqual([
      'picture:premium:aurora',
    ]);
    // The mark in its corner says the motion, in place of the silhouette that
    // stands in for a scene with no frame — over a picture it read as stripes.
    expect(dialog.querySelector('.wallpaper-monitor__motion')).toHaveAttribute(
      'data-motion',
      'music',
    );
    expect(
      dialog.querySelectorAll('.wallpaper-monitor__glass--pictured'),
    ).toHaveLength(1);

    fireEvent.click(screen.getByRole('radio', { name: /Calm/ }));
    expect(dialog.querySelector('.wallpaper-monitor__motion')).toHaveAttribute(
      'data-motion',
      'calm',
    );
  });

  it('keeps a visualizer’s colours on the monitor when there is no frame of it', () => {
    withScreens([]);
    render(<WallpaperDialog lookId="premium:alpine" onClose={jest.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelectorAll('.wallpaper-monitor__picture')).toHaveLength(
      0,
    );
    expect(dialog.querySelectorAll('.wallpaper-monitor__motion')).toHaveLength(
      0,
    );
    expect(dialog.querySelector('.wallpaper-monitor__glass')).toBeTruthy();
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

// The graph's desktop button and the player's open this dialog, not the
// Manage one: the switch was only in Manage, where Ivan never looked for it.
describe('following the graph from the dialog the graph opens', () => {
  it('sets the chosen monitors to follow the graph, and marks each on its tile', () => {
    withScreens([]);
    render(<WallpaperDialog lookId="premium:alpine" onClose={jest.fn()} />);
    // The app's switch is a checkbox underneath, named by its label.
    const follow = screen.getByRole('checkbox', { name: 'Follow graph' });
    expect(follow).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: /Y27qf-30/ }),
    ).not.toHaveAccessibleName(/Follow graph/);

    fireEvent.click(follow);
    expect(follow).toBeChecked();
    // The chosen monitor says it will follow; the others do not.
    expect(
      screen.getByRole('checkbox', { name: /Y27qf-30/ }),
    ).toHaveAccessibleName(/Follow graph/);
    expect(
      screen.getByRole('checkbox', { name: /Odyssey G5/ }),
    ).not.toHaveAccessibleName(/Follow graph/);
    expect(
      screen.getByRole('dialog').querySelectorAll('.wallpaper-monitor__follow'),
    ).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Set background' }));
    expect(startWallpaper).toHaveBeenCalledWith(
      expect.objectContaining({ displayIds: [2], followsGraph: true }),
    );
  });

  it('opens on when every monitor showing the visualizer already follows', () => {
    withScreens([
      showing(3, { followsGraph: true }),
      showing(1, { followsGraph: true }),
    ]);
    render(<WallpaperDialog lookId="premium:aurora" onClose={jest.fn()} />);
    expect(
      screen.getByRole('checkbox', { name: 'Follow graph' }),
    ).toBeChecked();
  });

  // Positive control for the case above: one of them not following is off,
  // and what the switch shows is what setting it sends.
  it('opens off when any of them does not, and sends what it shows', () => {
    withScreens([showing(3, { followsGraph: true }), showing(1)]);
    render(<WallpaperDialog lookId="premium:aurora" onClose={jest.fn()} />);
    expect(
      screen.getByRole('checkbox', { name: 'Follow graph' }),
    ).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Set on 2 monitors' }));
    expect(startWallpaper).toHaveBeenCalledWith(
      expect.objectContaining({ displayIds: [1, 3], followsGraph: false }),
    );
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
      followsGraph: false,
    });
  });

  // One monitor can follow the graph while the others keep what they were
  // given, so the switch is each row's own and changes nothing else about it.
  it('lets each monitor follow the graph on its own, keeping how it moves', () => {
    withScreens([
      showing(3),
      showing(2, {
        lookId: 'premium:alpine',
        motion: 'music',
        followsGraph: true,
      }),
    ]);
    render(<WallpaperManageDialog onClose={jest.fn()} />);
    const rows = screen.getAllByRole('listitem');
    const odyssey = rows.find((row) => within(row).queryByText('Odyssey G5'));
    const middle = rows.find((row) => within(row).queryByText('Y27qf-30'));
    if (!odyssey || !middle) {
      throw new Error('each monitor should have its row');
    }
    const followOnOdyssey = within(odyssey).getByRole('button', {
      name: 'Follow graph',
    });
    const followOnMiddle = within(middle).getByRole('button', {
      name: 'Follow graph',
    });
    expect(followOnOdyssey).toHaveAttribute('aria-pressed', 'false');
    expect(followOnMiddle).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(followOnOdyssey);
    expect(startWallpaper).toHaveBeenLastCalledWith({
      lookId: 'premium:aurora',
      displayIds: [3],
      pauseOnBattery: false,
      wave: { height: 0.4, position: 0.65 },
      motion: 'calm',
      followsGraph: true,
    });

    fireEvent.click(followOnMiddle);
    expect(startWallpaper).toHaveBeenLastCalledWith({
      lookId: 'premium:alpine',
      displayIds: [2],
      pauseOnBattery: false,
      wave: { height: 0.4, position: 0.65 },
      motion: 'music',
      followsGraph: false,
    });
  });

  it('offers a stopped monitor a retry that keeps how it moved, not a Calm switch', () => {
    withScreens([
      showing(3, { phase: 'error', error: 'host', followsGraph: true }),
    ]);
    render(<WallpaperManageDialog onClose={jest.fn()} />);
    expect(
      screen.queryByRole('button', { name: 'Calm' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Follow graph' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(startWallpaper).toHaveBeenCalledWith(
      expect.objectContaining({
        displayIds: [3],
        motion: 'calm',
        followsGraph: true,
      }),
    );
  });

  // Nothing on disk remembers the failure any more, so another try is a real
  // attempt rather than meeting a refusal: the button has to be there.
  it('tells a monitor whose visualizer failed why, and offers another try', () => {
    withScreens([showing(3, { phase: 'error', error: 'refused' })]);
    render(<WallpaperManageDialog onClose={jest.fn()} />);
    const row = screen
      .getByText(/failed on this computer's graphics/)
      .closest('li');
    expect(row).not.toBeNull();
    expect(
      within(row as HTMLElement).getByRole('button', { name: 'Stop' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(startWallpaper).toHaveBeenCalledWith(
      expect.objectContaining({ displayIds: [3] }),
    );
  });

  it('carries each visualizer’s frame beside its line as well as on its monitor', () => {
    withScreens([showing(3), showing(2, { lookId: 'premium:alpine' })]);
    render(<WallpaperManageDialog onClose={jest.fn()} />);
    const dialog = screen.getByRole('dialog');
    const swatches = [...dialog.querySelectorAll('.wallpaper-screen__swatch')];
    expect(swatches).toHaveLength(2);
    // Aurora's line carries its frame; Alpine, with none, keeps its colours.
    expect(
      swatches.filter((swatch) => swatch.querySelector('img')),
    ).toHaveLength(1);
    expect(dialog.querySelectorAll('.wallpaper-monitor__picture')).toHaveLength(
      1,
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

  // The line is cut short on screen, so the whole reason is on hover too.
  it('says a visualizer that failed here can be set again', () => {
    withScreens([showing(2, { phase: 'error', error: 'refused' })]);
    render(<WallpaperStatus />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Set it again to try it once more',
    );
    expect(
      screen.getByTitle(/failed on this computer's graphics/),
    ).toBeInTheDocument();
  });
});
