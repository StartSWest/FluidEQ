/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { PLAYER_DEFAULT_HEIGHT, PLAYER_DEFAULT_WIDTH } from 'common/constants';
import StudioStageControls from 'renderer/studio/StudioStageControls';
import {
  PLATE_GAP,
  PLAYER_INSET,
  stageScreen,
} from 'renderer/studio/studioStageScreen';

jest.mock('renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/**
 * The Studio's stage can show a scene behind the compact player (Ivan,
 * 2026-09-28: "this app is not for mobile show the amp player instead"): a
 * window the shape the player opens at, as tall as the stage allows, and
 * clear of the plate in the stage's corner.
 */
describe('the scene behind the compact player, on the Studio’s stage', () => {
  const shape = PLAYER_DEFAULT_WIDTH / PLAYER_DEFAULT_HEIGHT;

  it('is the whole stage until it is asked for', () => {
    expect(stageScreen({ width: 1280, height: 720 }, false, 900)).toEqual({
      width: 1280,
      height: 720,
    });
  });

  it('stands in the middle at the player’s shape, as tall as the stage allows', () => {
    const drawn = stageScreen({ width: 1280, height: 720 }, true, undefined);
    expect(drawn.height).toBe(720 - 2 * PLAYER_INSET);
    expect(drawn.width).toBe(Math.floor(drawn.height * shape));
    expect(drawn.left).toBe(Math.round((1280 - drawn.width) / 2));
    expect(drawn.top).toBe(PLAYER_INSET);
  });

  it('moves left of the plate where the plate would stand over it', () => {
    const box = { width: 700, height: 720 };
    const centred = stageScreen(box, true, undefined);
    const plateLeft = 500;
    const clear = stageScreen(box, true, plateLeft);
    expect(clear.left).toBeLessThan(centred.left ?? 0);
    expect((clear.left ?? 0) + clear.width).toBe(plateLeft - PLATE_GAP);
    // A plate far to the right leaves it in the middle.
    expect(stageScreen(box, true, 690).left).toBe(centred.left);
  });

  it('never leaves the stage for a plate it cannot clear', () => {
    const box = { width: 420, height: 720 };
    const drawn = stageScreen(box, true, 100);
    expect(drawn.left).toBe(PLAYER_INSET);
    // A narrow stage keeps the shape by being shorter, never squeezed.
    expect(drawn.width).toBeLessThanOrEqual(420 - 2 * PLAYER_INSET);
    expect(drawn.width).toBe(Math.floor(drawn.height * shape));
  });

  it('is switched on the stage’s own plate, which says whether it is on', () => {
    const onPlayer = jest.fn();
    const { rerender } = render(
      <StudioStageControls
        isFullscreen={false}
        onFullscreen={jest.fn()}
        isPlayer={false}
        onPlayer={onPlayer}
      />,
    );
    const button = screen.getByRole('button', { name: 'studio.size.player' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);
    expect(onPlayer).toHaveBeenCalledTimes(1);

    rerender(
      <StudioStageControls
        isFullscreen={false}
        onFullscreen={jest.fn()}
        isPlayer
        onPlayer={onPlayer}
      />,
    );
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });
});
