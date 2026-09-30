/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Backdrop takes the window only once its scene has drawn a picture
 * (Ivan, 2026-09-29: "jump straight to the visualizer graphics so we don't
 * see this"). Marked at once, every pane turned to glass over a flat dark
 * ground for as long as the scene took to compile, and only then did the
 * picture arrive under it. The scene's loop is stood in for here, so the
 * test hands the canvas its frames itself.
 */

import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import SceneCanvas from '../../../renderer/graph/SceneCanvas';
import type { IUsableScene } from '../../../renderer/utils/scenePacks';

type TOnDrawn = (frame: ISceneFrame, ...rest: unknown[]) => void;
let mockOnDrawn: TOnDrawn | undefined;

jest.mock('../../../renderer/graph/useSceneRunner', () => ({
  __esModule: true,
  default: (options: { onDrawn?: TOnDrawn }) => {
    mockOnDrawn = options.onDrawn;
    return { current: null };
  },
}));
jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: jest.fn(),
}));
jest.mock('../../../renderer/graph/sceneUpdateStore', () => ({
  reportScenePlayed: () => Promise.resolve(),
}));

const scene: IUsableScene = {
  id: 'aurora',
  version: 1,
  lookId: 'scene:aurora',
  names: { en: 'Aurora' },
  fallbackStyle: 'skyline',
  swatch: ['#102030', '#a0b0c0'],
};

const layer = (name: string) => {
  const element = document.createElement('div');
  element.dataset.sceneLayer = name;
  document.body.appendChild(element);
  return element;
};

/** A frame as the loop hands one over: `fade` 0 is still black. */
const drawFrame = (fade: number) =>
  act(() => mockOnDrawn?.({ fade } as ISceneFrame, 1, 0, {}, {}));

const root = document.documentElement;

afterEach(() => {
  mockOnDrawn = undefined;
  document.body.innerHTML = '';
});

describe('the Backdrop and its first picture', () => {
  it('keeps the window as it was until the scene has drawn a picture', () => {
    const { unmount } = render(
      <SceneCanvas scene={scene} target={layer('backdrop')} plot={undefined} />,
    );
    expect(root).not.toHaveClass('is-scene-backdrop');
    // A frame still black is not a picture.
    drawFrame(0);
    expect(root).not.toHaveClass('is-scene-backdrop');
    drawFrame(0.2);
    expect(root).toHaveClass('is-scene-backdrop');
    unmount();
    expect(root).not.toHaveClass('is-scene-backdrop');
  });

  // The positive control: the rule is the Backdrop's, which is the only
  // layer that turns the whole window to glass; the column's layer is
  // marked as soon as it is there, as it always was.
  it('marks the column layer at once', () => {
    const { unmount } = render(
      <SceneCanvas scene={scene} target={layer('column')} plot={undefined} />,
    );
    expect(root).toHaveClass('is-scene-column');
    unmount();
    expect(root).not.toHaveClass('is-scene-column');
  });

  it('keeps the glass while the next look is handed to the same canvas', () => {
    const target = layer('backdrop');
    const { rerender, unmount } = render(
      <SceneCanvas scene={scene} target={target} plot={undefined} />,
    );
    drawFrame(1);
    expect(root).toHaveClass('is-scene-backdrop');
    rerender(
      <SceneCanvas
        scene={{ ...scene, id: 'bloom', lookId: 'scene:bloom' }}
        target={target}
        plot={undefined}
      />,
    );
    expect(root).toHaveClass('is-scene-backdrop');
    unmount();
  });
});
