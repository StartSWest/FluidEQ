/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { publishGraphSceneRun } from '../../../renderer/graph/graphScenePlace';
import SceneCameraMenu from '../../../renderer/graph/SceneCameraMenu';
import { createSceneInteraction } from '../../../renderer/graph/sceneInteraction';
import {
  readSceneCameraControl,
  resetSceneCameraControlForTesting,
} from '../../../renderer/utils/sceneCameraControlStore';

/**
 * The View menu's rows for how a scene's camera is moved: only over a scene
 * that can be turned, the key stepping through Ctrl, Alt and Shift and then
 * waiting for any other key, and the way stepping between a drag and the
 * mouse moving alone.
 */

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

const LIMITS = {
  yaw: [-1, 1] as const,
  pitch: [-0.5, 0.5] as const,
  zoom: [0.5, 2] as const,
};

const setUp = (turns = true) => {
  const interaction = createSceneInteraction(readSceneCameraControl);
  if (turns) {
    interaction.setLimits(LIMITS);
  }
  publishGraphSceneRun({ interaction });
  render(<SceneCameraMenu />);
  return interaction;
};

// Each row by the hint it carries: its name is its label and its answer.
const keyRow = () => screen.getByTitle('graph.scene.camera.keyHint');
const moveRow = () => screen.getByTitle('graph.scene.camera.moveHint');

beforeEach(() => {
  window.localStorage.clear();
  resetSceneCameraControlForTesting();
});

afterEach(() => {
  act(() => publishGraphSceneRun(undefined));
});

describe('the camera rows in the View menu', () => {
  it('are not there for a scene that cannot be turned, and come with one that can', () => {
    const interaction = setUp(false);
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    act(() => interaction.setLimits(LIMITS));
    expect(keyRow()).toHaveTextContent('graph.scene.camera.key.ctrl');
  });

  it('steps the key through Ctrl, Alt and Shift, saying what Shift gives up', () => {
    setUp();
    fireEvent.click(keyRow());
    expect(readSceneCameraControl().key).toBe('alt');
    fireEvent.click(keyRow());
    expect(readSceneCameraControl().key).toBe('shift');
    expect(keyRow()).toHaveTextContent('graph.scene.camera.key.shiftNote');
  });

  it('waits for a key after Shift, and takes the one pressed', () => {
    setUp();
    fireEvent.click(keyRow());
    fireEvent.click(keyRow());
    fireEvent.click(keyRow());
    expect(keyRow()).toHaveTextContent('graph.scene.camera.key.press');
    // A key that may not be the camera's is passed over, and it waits on.
    fireEvent.keyDown(document.body, { code: 'Tab', key: 'Tab' });
    expect(keyRow()).toHaveTextContent('graph.scene.camera.key.press');
    fireEvent.keyDown(document.body, { code: 'KeyQ', key: 'q' });
    expect(readSceneCameraControl().key).toBe('code:KeyQ');
    expect(keyRow()).toHaveTextContent('Q');
    expect(keyRow()).toHaveTextContent('graph.scene.camera.key.ownNote');
    expect(
      JSON.parse(
        window.localStorage.getItem('fluideq.sceneCameraControl') ?? '',
      ),
    ).toEqual({ key: 'code:KeyQ', move: 'drag' });
  });

  it('stops waiting on Esc and keeps what was chosen', () => {
    setUp();
    fireEvent.click(keyRow());
    fireEvent.click(keyRow());
    fireEvent.click(keyRow());
    const escape = fireEvent.keyDown(document.body, {
      code: 'Escape',
      key: 'Escape',
    });
    // Taken before the menu, which would close on it.
    expect(escape).toBe(false);
    expect(readSceneCameraControl().key).toBe('shift');
    expect(keyRow()).toHaveTextContent('graph.scene.camera.key.shift');
  });

  it('steps the way between a drag and the mouse moving alone', () => {
    setUp();
    expect(moveRow()).toHaveTextContent('graph.scene.camera.move.drag');
    fireEvent.click(moveRow());
    expect(readSceneCameraControl().move).toBe('move');
    expect(moveRow()).toHaveTextContent('graph.scene.camera.move.move');
  });

  it('tells main the choice, so the desktop follows it', () => {
    const told = jest.fn();
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { setSceneCameraControl: told } },
    });
    setUp();
    fireEvent.click(moveRow());
    expect(told).toHaveBeenLastCalledWith({ key: 'ctrl', move: 'move' });
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: undefined,
    });
  });
});
