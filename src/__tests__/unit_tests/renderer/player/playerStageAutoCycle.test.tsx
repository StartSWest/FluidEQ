/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Auto counts a scene's time in the Compact player from its first frame, as
 * the graph's canvas does: a scene still compiling is never passed over
 * before it has been seen (Ivan, 2026-10-29, Auto in the amp).
 */

import { act, render } from '@testing-library/react';
import type { ISceneFrame } from 'renderer/graph/sceneGl';
import PlayerStage from 'renderer/player/PlayerStage';
import type { IGraphScenePack } from 'renderer/player/useGraphScenePack';
import { useGraphAutoCycle } from 'renderer/utils/graphAutoCycle';
import { cycleGraphLookUnattended } from 'renderer/utils/graphStyle';

let drawFrame: ((frame: ISceneFrame) => void) | undefined;

jest.mock('renderer/plus/ScenePreview', () => ({
  __esModule: true,
  default: (props: { onDrawn?: (frame: ISceneFrame) => void }) => {
    drawFrame = props.onDrawn;
    return null;
  },
}));

jest.mock('renderer/player/usePlayerScenePulse', () => ({
  __esModule: true,
  default: () => () => undefined,
}));

jest.mock('renderer/utils/graphStyle', () => ({
  ...jest.requireActual('renderer/utils/graphStyle'),
  cycleGraphLookUnattended: jest.fn(),
}));

const SCENE = {
  identity: 'premium:neon-horizon@3',
  lookId: 'premium:neon-horizon',
} as unknown as IGraphScenePack;

/** The player's stage beside a running ten-second cycle. */
const Amp = ({ scene }: { scene: IGraphScenePack | undefined }) => {
  useGraphAutoCycle(10, false, 'premium:neon-horizon');
  return <PlayerStage scene={scene} onTrouble={() => undefined} />;
};

describe("Auto in the Compact player's stage", () => {
  let now = 0;
  let nextId = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const paintAt = (time: number) => {
    now = time;
    const callbacks = [...frames.values()];
    frames.clear();
    act(() => callbacks.forEach((callback) => callback(time)));
  };

  beforeEach(() => {
    now = 0;
    frames.clear();
    drawFrame = undefined;
    jest.clearAllMocks();
    jest.spyOn(performance, 'now').mockImplementation(() => now);
    jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        nextId += 1;
        frames.set(nextId, callback);
        return nextId;
      });
    jest
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation((id) => frames.delete(id));
  });

  afterEach(() => jest.restoreAllMocks());

  it('switches on the interval with no scene to wait for', () => {
    const { unmount } = render(<Amp scene={undefined} />);
    paintAt(10000);
    expect(cycleGraphLookUnattended).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('starts a scene’s time when it draws its first frame', () => {
    const { unmount } = render(<Amp scene={SCENE} />);
    paintAt(15000);
    expect(cycleGraphLookUnattended).not.toHaveBeenCalled();
    act(() => drawFrame?.({} as ISceneFrame));
    paintAt(24999);
    expect(cycleGraphLookUnattended).not.toHaveBeenCalled();
    paintAt(25000);
    expect(cycleGraphLookUnattended).toHaveBeenCalledTimes(1);
    unmount();
  });
});
