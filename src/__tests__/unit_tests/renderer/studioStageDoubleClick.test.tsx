/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * Double-clicking the Studio stage leaves its size alone (Ivan, 2026-11-25:
 * "in Studio double click should not go into full screen, only the icon
 * button does"). The stage is where a member drags, picks and edits; full
 * screen is the stage's own button alone.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import StudioStage, {
  type TStudioSize,
} from '../../../renderer/studio/StudioStage';

jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: jest.fn(),
  // No capture running: nothing is heard for the member's AI.
  useLiveAudioControl: () => ({ claim: () => undefined, capture: undefined }),
}));
// The window's sound, which the stage's Bass, Mids and Treble hear their
// part of; none here.
jest.mock('../../../renderer/audio/SceneAudioContext', () => ({
  useSceneAudio: () => ({
    points: [],
    waveform: [],
    isPaused: false,
    readFrame: () => undefined,
  }),
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../renderer/graph/useSceneRunner', () => ({
  __esModule: true,
  default: jest.fn(() => ({ current: null })),
}));

const pack = { names: { en: 'Alpine' }, params: [] } as unknown as IScenePack;

const stage = (size: TStudioSize, onExitFullscreen: () => void) => (
  <StudioStage
    identity="one"
    pack={pack}
    serial={1}
    signal="live"
    demo={false}
    size={size}
    preview="stage"
    motion="music"
    onToggleMotion={jest.fn()}
    wave={{ height: 1, position: 0 }}
    isGridShown={false}
    readingRef={{ current: null }}
    onTrouble={jest.fn()}
    onDrawn={jest.fn()}
    onExitFullscreen={onExitFullscreen}
  />
);

let requestFullscreen: jest.Mock;

beforeEach(() => {
  requestFullscreen = jest.fn(() => Promise.resolve());
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
    configurable: true,
    value: requestFullscreen,
  });
});

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'requestFullscreen');
});

it('does not go full screen on a double click on the stage', () => {
  const exit = jest.fn();
  render(stage('graph', exit));
  fireEvent.doubleClick(screen.getByTestId('studio-stage'));
  expect(requestFullscreen).not.toHaveBeenCalled();
  expect(exit).not.toHaveBeenCalled();
});

it('does not leave full screen on a double click on the stage', () => {
  const exit = jest.fn();
  render(stage('full', exit));
  const before = requestFullscreen.mock.calls.length;
  fireEvent.doubleClick(screen.getByTestId('studio-stage'));
  expect(requestFullscreen).toHaveBeenCalledTimes(before);
  expect(exit).not.toHaveBeenCalled();
  // The control: the stage's own exit button still leaves full screen.
  fireEvent.click(screen.getByRole('button', { name: 'studio.size.exit' }));
  expect(exit).toHaveBeenCalledTimes(1);
});
