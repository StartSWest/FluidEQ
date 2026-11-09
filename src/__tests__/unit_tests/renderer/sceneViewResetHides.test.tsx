/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A Plus scene's Reset view hides by itself (Ivan, 2026-11-08: "reset view
 * button in plus viz that moves cam needs to auto hide"): there while the
 * pointer is over the scene or the button has the keyboard's focus, away when
 * the pointer leaves, away with the window's idle chrome, and back at the
 * next move or wheel over the scene.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ISceneInteraction } from '../../../renderer/graph/sceneInteraction';

let mockIdle = false;
jest.mock('../../../renderer/graph/graphChromeIdle', () => ({
  __esModule: true,
  default: () => mockIdle,
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// eslint-disable-next-line import/first -- the mocks above have to be in place first
import SceneViewReset from '../../../renderer/graph/SceneViewReset';

const interactionMoved = (moved: boolean): ISceneInteraction =>
  ({
    moved: () => moved,
    subscribe: () => () => undefined,
    reset: jest.fn(),
  }) as unknown as ISceneInteraction;

const renderOnSurface = (moved = true) => {
  const interaction = interactionMoved(moved);
  const view = render(
    <div data-testid="surface">
      <SceneViewReset interaction={interaction} className="" />
    </div>,
  );
  const plate = () =>
    view.container.querySelector('.scene-view-reset') as HTMLElement | null;
  return {
    ...view,
    interaction,
    plate,
    surface: screen.getByTestId('surface'),
  };
};

const isShown = (plate: HTMLElement | null) =>
  plate !== null && !plate.classList.contains('is-idle');

beforeEach(() => {
  mockIdle = false;
});

describe('the Reset view button on a turned scene', () => {
  // The control: a scene nobody turned has no button at all.
  it('is not there while the view is the scene’s own', () => {
    expect(renderOnSurface(false).plate()).toBeNull();
  });

  it('shows while the pointer is over the scene and hides when it leaves', () => {
    const { plate, surface } = renderOnSurface();
    expect(plate()).not.toBeNull();
    expect(isShown(plate())).toBe(false);
    fireEvent.pointerEnter(surface);
    expect(isShown(plate())).toBe(true);
    fireEvent.pointerLeave(surface);
    expect(isShown(plate())).toBe(false);
  });

  it('fades with the idle chrome over a still pointer, and a move brings it back', () => {
    const { plate, surface, rerender, interaction } = renderOnSurface();
    fireEvent.pointerEnter(surface);
    expect(isShown(plate())).toBe(true);
    mockIdle = true;
    rerender(
      <div data-testid="surface">
        <SceneViewReset interaction={interaction} className="" />
      </div>,
    );
    expect(isShown(plate())).toBe(false);
    fireEvent.pointerMove(surface);
    expect(isShown(plate())).toBe(true);
    // A wheel over the scene — how its view is turned again — does the same.
    fireEvent.pointerLeave(surface);
    expect(isShown(plate())).toBe(false);
    fireEvent.wheel(surface);
    expect(isShown(plate())).toBe(true);
  });

  it('is reached by the keyboard while hidden, and shows with its focus', () => {
    const { plate } = renderOnSurface();
    expect(isShown(plate())).toBe(false);
    const button = screen.getByRole('button', {
      name: 'graph.scene.resetView',
    });
    act(() => button.focus());
    expect(isShown(plate())).toBe(true);
    act(() => button.blur());
    expect(isShown(plate())).toBe(false);
  });

  it('puts the view back when pressed', () => {
    const { interaction, surface } = renderOnSurface();
    fireEvent.pointerEnter(surface);
    fireEvent.click(
      screen.getByRole('button', { name: 'graph.scene.resetView' }),
    );
    expect(interaction.reset).toHaveBeenCalled();
  });
});
