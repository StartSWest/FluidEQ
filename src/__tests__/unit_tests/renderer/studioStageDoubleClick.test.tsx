/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * Double-clicking the Studio stage: the graph's gesture for full screen, and
 * back. Not on a button inside the stage, whose own click has already acted —
 * the exit button's first click brings the stage back, and a toggle on its
 * second would send it straight back to full screen.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import StudioStage, {
  type TStudioSize,
} from '../../../renderer/studio/StudioStage';

jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: jest.fn(),
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../renderer/graph/useSceneRunner', () => ({
  __esModule: true,
  default: jest.fn(() => ({ current: null })),
}));

const pack = { names: { en: 'Alpine' }, params: [] } as unknown as IScenePack;

const stage = (size: TStudioSize, onToggleFullscreen: () => void) => (
  <StudioStage
    identity="one"
    pack={pack}
    serial={1}
    signal="live"
    size={size}
    wave={{ height: 1, position: 0 }}
    onTrouble={jest.fn()}
    onDrawn={jest.fn()}
    onExitFullscreen={jest.fn()}
    onToggleFullscreen={onToggleFullscreen}
  />
);

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'requestFullscreen');
});

it('toggles full screen on a double click on the stage', () => {
  const toggle = jest.fn();
  render(stage('graph', toggle));
  fireEvent.doubleClick(screen.getByTestId('studio-stage'));
  expect(toggle).toHaveBeenCalledTimes(1);
});

it('leaves a double click on a button inside the stage to the button', () => {
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
    configurable: true,
    value: jest.fn(() => Promise.resolve()),
  });
  const toggle = jest.fn();
  render(stage('full', toggle));
  fireEvent.doubleClick(
    screen.getByRole('button', { name: 'studio.size.exit' }),
  );
  expect(toggle).not.toHaveBeenCalled();
  // The control: the same gesture on the stage around the button toggles.
  fireEvent.doubleClick(screen.getByTestId('studio-stage'));
  expect(toggle).toHaveBeenCalledTimes(1);
});
