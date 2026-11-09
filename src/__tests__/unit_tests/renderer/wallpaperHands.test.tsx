/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type {
  IWallpaperSurfaceBridge,
  IWallpaperWheel,
} from '../../../common/wallpaper';
import type { IScenePack } from '../../../common/scenePacks';
import { createSceneInteraction } from '../../../renderer/graph/sceneInteraction';
import WallpaperHands from '../../../renderer/wallpaper/WallpaperHands';

/**
 * The hands a desktop background's scene is given: the graph's own, so the
 * wheel main hands the page — with Ctrl, as on the graph — moves the camera
 * in, the view's reset appears, and turning the mouse off sends the view back
 * to the scene's own.
 */

const LIMITS = { yaw: [-1, 1], pitch: [-0.5, 0.5], zoom: [0.5, 2] } as const;

const setUp = () => {
  let wheel: ((next: IWallpaperWheel) => void) | undefined;
  const bridge = {
    onWheel: jest.fn((listener: (next: IWallpaperWheel) => void) => {
      wheel = listener;
      return () => {
        wheel = undefined;
      };
    }),
  } as unknown as IWallpaperSurfaceBridge;
  const interaction = createSceneInteraction();
  interaction.setLimits(LIMITS);
  const stage = document.createElement('div');
  document.body.appendChild(stage);
  // jsdom lays nothing out: what is under the pointer is the stage itself.
  document.elementFromPoint = () => stage;
  const pack = { id: 'aurora' } as IScenePack;
  const turn = (next: IWallpaperWheel) =>
    act(() => {
      wheel?.(next);
      interaction.read(16);
    });
  return { bridge, interaction, stage, pack, turn, wheel: () => wheel };
};

describe('a desktop scene’s hands', () => {
  it('zooms the camera on Ctrl and the wheel main hands it, and offers the way back', () => {
    const { bridge, interaction, stage, pack, turn } = setUp();
    render(
      <WallpaperHands
        interaction={interaction}
        stage={stage}
        bridge={bridge}
        pack={pack}
        interactive
        awake
      />,
      { container: stage },
    );
    // The plain wheel is never the camera's, here as on the graph.
    turn({ x: 50, y: 50, deltaY: -100, ctrlKey: false });
    expect(interaction.moved()).toBe(false);
    turn({ x: 50, y: 50, deltaY: -100, ctrlKey: true });
    expect(interaction.moved()).toBe(true);
    expect(interaction.read(16).camera[2]).toBeGreaterThan(1);
    const reset = screen.getByRole('button', { name: 'Reset view' });
    fireEvent.click(reset);
    for (let frame = 0; frame < 120 && interaction.moved(); frame += 1) {
      interaction.read(16);
    }
    expect(interaction.moved()).toBe(false);
  });

  it('takes no wheel while paused, and keeps a turned view for when it plays', () => {
    const { bridge, interaction, stage, pack, turn, wheel } = setUp();
    const { rerender } = render(
      <WallpaperHands
        interaction={interaction}
        stage={stage}
        bridge={bridge}
        pack={pack}
        interactive
        awake
      />,
      { container: stage },
    );
    turn({ x: 50, y: 50, deltaY: -100, ctrlKey: true });
    rerender(
      <WallpaperHands
        interaction={interaction}
        stage={stage}
        bridge={bridge}
        pack={pack}
        interactive
        awake={false}
      />,
    );
    expect(wheel()).toBeUndefined();
    expect(interaction.moved()).toBe(true);
  });

  it('goes back to the scene’s own view when the mouse is turned off', () => {
    const { bridge, interaction, stage, pack, turn, wheel } = setUp();
    const { rerender } = render(
      <WallpaperHands
        interaction={interaction}
        stage={stage}
        bridge={bridge}
        pack={pack}
        interactive
        awake
      />,
      { container: stage },
    );
    turn({ x: 50, y: 50, deltaY: -100, ctrlKey: true });
    expect(interaction.moved()).toBe(true);
    rerender(
      <WallpaperHands
        interaction={interaction}
        stage={stage}
        bridge={bridge}
        pack={pack}
        interactive={false}
        awake
      />,
    );
    expect(interaction.moved()).toBe(false);
    expect(wheel()).toBeUndefined();
    expect(screen.queryByRole('button', { name: 'Reset view' })).toBeNull();
  });
});
