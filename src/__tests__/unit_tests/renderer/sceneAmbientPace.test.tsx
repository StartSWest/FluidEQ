/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The ambient layer is drawn by the page, on one canvas the size of the
 * window, and is held to the 2D graph's budget: thirty frames a second, and
 * every frame the display offers while the window is euphoric. It used to
 * draw on every frame the display offered — up to 144 a second.
 */

import '@testing-library/jest-dom';
import { act, render, waitFor } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import SceneAmbient from '../../../renderer/ambient/SceneAmbient';
import { paintAmbient } from '../../../renderer/ambient/ambientPaint';
import { useSceneLook } from '../../../renderer/utils/graphStyle';
import { loadScenePack } from '../../../renderer/utils/scenePacks';
import {
  useSceneTintMode,
  useStudioTintSource,
} from '../../../renderer/utils/sceneTintStore';

jest.mock('../../../renderer/ambient/ambientPaint', () => ({
  paintAmbient: jest.fn(),
}));
jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioControl: () => ({ readFrame: () => undefined, isPaused: true }),
}));
jest.mock('../../../renderer/utils/graphStyle', () => ({
  useSceneLook: jest.fn(),
}));
jest.mock('../../../renderer/utils/scenePacks', () => ({
  loadScenePack: jest.fn(),
}));
jest.mock('../../../renderer/utils/memberScenes', () => ({
  loadMemberScene: jest.fn(),
}));
jest.mock('../../../renderer/utils/sceneTintStore', () => {
  const useSceneTintMode = jest.fn();
  return {
    // The real rule for which modes show the graph's scene elements (Ambient
    // and the Backdrop); only what reads the stores is stood in for.
    isAmbientMode: jest.requireActual('../../../renderer/utils/sceneTintStore')
      .isAmbientMode,
    useSceneTintMode,
    // The mode the window wears: with no Studio holding it, the app's.
    useWindowTintMode: () => useSceneTintMode(),
    useStudioTintSource: jest.fn(),
  };
});

const withBirds: IScenePack = {
  id: 'alpine',
  version: 1,
  params: [],
  source: '',
  ambient: {
    elements: [
      {
        id: 'gulls',
        shape: 'bird',
        colours: ['#dfe9ff'],
        count: 4,
        size: [14, 24],
        opacity: 0.7,
        motion: 'fly',
        speed: 0.3,
        area: 'top',
        flap: 0.7,
        turn: 0.3,
        music: 'none',
        react: 0,
      },
    ],
    params: [],
  },
} as unknown as IScenePack;

let frames: FrameRequestCallback[] = [];

/** Runs the frame the layer asked for, at `time`. */
const frameAt = (time: number) => {
  const due = frames;
  frames = [];
  act(() => due.forEach((draw) => draw(time)));
};

const layerDrawn = async () => {
  render(<SceneAmbient />);
  await waitFor(() =>
    expect(
      document.body.querySelector('canvas.scene-ambient'),
    ).toBeInTheDocument(),
  );
  // The loop starts once the scene's elements are in.
  await waitFor(() => expect(frames.length).toBeGreaterThan(0));
};

beforeEach(() => {
  jest.clearAllMocks();
  frames = [];
  document.documentElement.classList.remove('is-euphoric');
  // What the loop needs of a context outside `paintAmbient`, which is mocked:
  // nothing, until the layer fades out.
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(
      (() => ({})) as unknown as HTMLCanvasElement['getContext'],
    );
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((draw) => {
    frames.push(draw);
    return frames.length;
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  jest.mocked(useSceneLook).mockReturnValue({
    id: 'alpine',
    version: 1,
    lookId: 'premium:alpine',
  } as ReturnType<typeof useSceneLook>);
  jest.mocked(loadScenePack).mockResolvedValue(withBirds);
  jest.mocked(useSceneTintMode).mockReturnValue('pulse');
  jest.mocked(useStudioTintSource).mockReturnValue(undefined);
});

afterEach(() => {
  document.documentElement.classList.remove('is-euphoric');
  jest.restoreAllMocks();
});

// Every frame the display offers, as the graph beside it draws, in Rainbow
// mode or not: the layer was held to thirty a second whenever Rainbow was
// off, and that cap is gone with the graph's.
it.each([false, true])(
  'draws every frame a 60 Hz display offers, Rainbow mode %s',
  async (euphoric) => {
    if (euphoric) {
      document.documentElement.classList.add('is-euphoric');
    }
    await layerDrawn();
    // Frame times as a 60 Hz display hands them out, to a tenth of a
    // millisecond.
    [1000, 1016.7, 1033.3, 1050, 1066.7].forEach(frameAt);
    expect(paintAmbient).toHaveBeenCalledTimes(5);
  },
);
