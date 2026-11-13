/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { PLAYER_PICTURE_HEIGHT } from 'common/constants';
import { ULTRA_WIDE_SHOWN } from 'common/stageShapes';
import { studioAgentViewOf } from 'common/studioAgent';
import {
  PICTURE_HEIGHT,
  PICTURE_PANEL_FOOT,
  PICTURE_WIDTH,
} from 'renderer/components/featureTour/playerPictureData';
import StudioStageControls from 'renderer/studio/StudioStageControls';
import {
  PLATE_GAP,
  PLAYER_PANEL_VIEW,
  PREVIEW_INSET,
  ULTRA_WIDE_BAND,
  ULTRA_WIDE_GRAPH_SHAPE,
  ULTRA_WIDE_PANEL_VIEW,
  ULTRA_WIDE_WINDOW_SHAPE,
  stageScreen,
  type TStagePreview,
} from 'renderer/studio/studioStageScreen';

jest.mock('renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/**
 * What the Studio's stage can show a scene as besides itself (Ivan,
 * 2026-11-09: "an ultra wide mode on studio to test scenes on the graph",
 * "we don't allow 2 columns anymore", "don't show the amp", "allow user to
 * select if just the frame and if with amp ui on top"): the EQ graph of an
 * ultra-wide window, and the Compact player's one column, each a window
 * standing on the stage, clear of the plate in its corner.
 */

const PLAYER_SHAPE = PICTURE_WIDTH / PICTURE_HEIGHT;

describe('the stage itself', () => {
  it('is the whole stage until a preview is asked for', () => {
    expect(
      stageScreen({ width: 1280, height: 720 }, 'stage', {
        left: 900,
        bottom: 60,
      }),
    ).toEqual({ width: 1280, height: 720 });
  });
});

describe('the Compact player on the stage', () => {
  it('is one column, as tall as the stage allows', () => {
    const drawn = stageScreen(
      { width: 1280, height: 720 },
      'player',
      undefined,
    );
    expect(drawn.height).toBe(720 - 2 * PREVIEW_INSET);
    expect(drawn.width).toBe(Math.floor(drawn.height * PLAYER_SHAPE));
    // Taller than wide: the column, never the wide box it used to be.
    expect(drawn.width).toBeLessThan(drawn.height);
    expect(drawn.left).toBe(Math.round((1280 - drawn.width) / 2));
    expect(drawn.top).toBe(PREVIEW_INSET);
  });

  it('is never taller than the player itself, so full screen shows its real size', () => {
    const drawn = stageScreen(
      { width: 2560, height: 1440 },
      'player',
      undefined,
    );
    expect(drawn.height).toBe(PICTURE_HEIGHT);
    expect(drawn.width).toBe(PICTURE_WIDTH);
    expect(drawn.top).toBe(Math.round((1440 - PICTURE_HEIGHT) / 2));
  });

  it('moves left of the plate where the plate would stand over it', () => {
    const box = { width: 1280, height: 400 };
    const centred = stageScreen(box, 'player', undefined);
    const plate = { left: 660, bottom: 52 };
    const clear = stageScreen(box, 'player', plate);
    expect(clear.left).toBeLessThan(centred.left ?? 0);
    expect((clear.left ?? 0) + clear.width).toBe(plate.left - PLATE_GAP);
    // A plate far to the right leaves it in the middle.
    expect(stageScreen(box, 'player', { left: 1270, bottom: 52 }).left).toBe(
      centred.left,
    );
  });

  it('never leaves the stage for a plate it cannot clear', () => {
    const drawn = stageScreen({ width: 300, height: 720 }, 'player', {
      left: 40,
      bottom: 52,
    });
    expect(drawn.left).toBe(PREVIEW_INSET);
    // A narrow stage keeps the shape by being shorter, never squeezed.
    expect(drawn.width).toBeLessThanOrEqual(300 - 2 * PREVIEW_INSET);
    expect(drawn.width).toBe(Math.floor(drawn.height * PLAYER_SHAPE));
  });

  it('frames the scene to the player’s top panel, as the player does', () => {
    // The panel ends at the measured foot and is the amp's picture tall.
    const top = (PICTURE_PANEL_FOOT - PLAYER_PICTURE_HEIGHT) / PICTURE_HEIGHT;
    const height = PLAYER_PICTURE_HEIGHT / PICTURE_HEIGHT;
    const [left, bottom, width, tall] = PLAYER_PANEL_VIEW;
    expect(left).toBe(0);
    expect(width).toBe(1);
    expect(tall).toBeCloseTo(height, 10);
    // `sceneView` counts from the bottom, as GL does.
    expect(bottom).toBeCloseTo(1 - top - height, 10);
    // The panel is the column's top third: the rest of the column is more
    // of the same scene, not part of its panel.
    expect(tall).toBeLessThan(0.4);
  });
});

describe('the ultra-wide graph on the stage', () => {
  it('is the 3440-wide window’s graph, measured: 2956 by 534', () => {
    expect(ULTRA_WIDE_GRAPH_SHAPE).toBeCloseTo(5.54, 2);
  });

  // The window the scene covers, the graph framed in it where it stands
  // (Ivan, 2026-11-12: "the scene must be seen complete"), as far as a
  // band's height round the graph: the overflow "at a maximum size".
  it('shows the 3440-wide window from its top to a band’s height under the graph', () => {
    // 174 above the band (all the window has), 534 of band, 534 under it.
    expect(ULTRA_WIDE_SHOWN).toEqual({
      left: 0,
      top: 0,
      width: 3440,
      height: 1242,
    });
    expect(ULTRA_WIDE_WINDOW_SHAPE).toBeCloseTo(3440 / 1242, 6);
    // The control: still far more than the band alone.
    expect(ULTRA_WIDE_WINDOW_SHAPE).toBeLessThan(ULTRA_WIDE_GRAPH_SHAPE / 1.9);
  });

  it('frames the scene to the graph where it stands on the window, 143,174', () => {
    const [left, bottom, width, height] = ULTRA_WIDE_PANEL_VIEW;
    expect(left).toBeCloseTo(143 / 3440, 10);
    expect(width).toBeCloseTo(2956 / 3440, 10);
    expect(height).toBeCloseTo(534 / 1242, 10);
    // From the bottom, as GL counts: the band's foot at row 708 of the
    // 1242 shown, a band's height above the foot of what is shown.
    expect(bottom).toBeCloseTo(534 / 1242, 10);
    // The frame the page lays over it is the same rectangle from the top.
    expect(ULTRA_WIDE_BAND.top).toBeCloseTo(174 / 1242, 10);
    expect(ULTRA_WIDE_BAND.top + ULTRA_WIDE_BAND.height).toBeCloseTo(
      1 - bottom,
      10,
    );
    expect(ULTRA_WIDE_BAND.left).toBeCloseTo(left, 10);
    // In pixels it is the graph's own shape.
    expect(
      (ULTRA_WIDE_BAND.width * 3440) / (ULTRA_WIDE_BAND.height * 1242),
    ).toBeCloseTo(ULTRA_WIDE_GRAPH_SHAPE, 6);
  });

  // The member's AI looks at what the member sees (Ivan, 2026-11-09: "make
  // sure when I ask the agent it knows is that aspect ratio").
  it('gives the AI’s look the same cut of the window', () => {
    expect(studioAgentViewOf('ultra-wide-window')).toEqual(
      ULTRA_WIDE_PANEL_VIEW,
    );
  });

  it('spans the stage between its insets, in its middle', () => {
    const box = { width: 1280, height: 720 };
    const drawn = stageScreen(box, 'ultraWide', undefined);
    expect(drawn.width).toBe(1280 - 2 * PREVIEW_INSET);
    expect(drawn.height).toBe(
      Math.floor(drawn.width / ULTRA_WIDE_WINDOW_SHAPE),
    );
    expect(drawn.left).toBe(PREVIEW_INSET);
    expect(drawn.top).toBe(Math.round((720 - drawn.height) / 2));
  });

  it('goes under the plate where the plate would cover its top', () => {
    // Centred, the window's top would sit under a plate grown to two rows.
    const box = { width: 1280, height: 720 };
    const centred = stageScreen(box, 'ultraWide', undefined);
    const plate = { left: 900, bottom: 140 };
    expect(centred.top ?? 0).toBeLessThan(plate.bottom + PLATE_GAP);
    const clear = stageScreen(box, 'ultraWide', plate);
    expect(clear.top).toBe(plate.bottom + PLATE_GAP);
    // A plate already above it changes nothing.
    expect(stageScreen(box, 'ultraWide', { left: 900, bottom: 20 }).top).toBe(
      centred.top,
    );
  });

  it('never falls off the stage’s foot to clear a plate', () => {
    const box = { width: 1280, height: 300 };
    const drawn = stageScreen(box, 'ultraWide', { left: 900, bottom: 280 });
    expect((drawn.top ?? 0) + drawn.height).toBe(300 - PREVIEW_INSET);
  });

  it('is held to the stage’s height on a stage shaped wider than it', () => {
    const box = { width: 2000, height: 200 };
    const drawn = stageScreen(box, 'ultraWide', undefined);
    expect(drawn.width).toBe(
      Math.floor((200 - 2 * PREVIEW_INSET) * ULTRA_WIDE_WINDOW_SHAPE),
    );
    expect(drawn.width).toBeLessThan(2000 - 2 * PREVIEW_INSET);
  });
});

describe('the stage’s own plate', () => {
  const controls = (
    preview: TStagePreview,
    onPreview = jest.fn(),
    hasPlayerParts = false,
    onPlayerParts = jest.fn(),
  ) => (
    <StudioStageControls
      isFullscreen={false}
      onFullscreen={jest.fn()}
      preview={preview}
      onPreview={onPreview}
      hasPlayerParts={hasPlayerParts}
      onPlayerParts={onPlayerParts}
    />
  );

  it('switches each shape on its own button, which says whether it is on', () => {
    const onPreview = jest.fn();
    const { rerender } = render(controls('stage', onPreview));
    const ultraWide = screen.getByRole('button', {
      name: 'studio.size.ultraWide',
    });
    const player = screen.getByRole('button', { name: 'studio.size.player' });
    expect(ultraWide).toHaveAttribute('aria-pressed', 'false');
    expect(player).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(ultraWide);
    expect(onPreview).toHaveBeenLastCalledWith('ultraWide');
    fireEvent.click(player);
    expect(onPreview).toHaveBeenLastCalledWith('player');

    rerender(controls('ultraWide', onPreview));
    expect(ultraWide).toHaveAttribute('aria-pressed', 'true');
    expect(player).toHaveAttribute('aria-pressed', 'false');
    rerender(controls('player', onPreview));
    expect(ultraWide).toHaveAttribute('aria-pressed', 'false');
    expect(player).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers the player’s parts in the grid’s place only while the player is shown', () => {
    const onPlayerParts = jest.fn();
    const { rerender } = render(
      controls('stage', jest.fn(), false, onPlayerParts),
    );
    expect(
      screen.queryByRole('button', { name: 'studio.size.playerParts' }),
    ).toBeNull();
    // POSITIVE CONTROL: the grid is there on the graph's shapes.
    expect(
      screen.getByRole('button', { name: 'studio.grid.label' }),
    ).toBeInTheDocument();

    rerender(controls('player', jest.fn(), false, onPlayerParts));
    expect(
      screen.queryByRole('button', { name: 'studio.grid.label' }),
    ).toBeNull();
    const parts = screen.getByRole('button', {
      name: 'studio.size.playerParts',
    });
    expect(parts).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(parts);
    expect(onPlayerParts).toHaveBeenCalledTimes(1);

    rerender(controls('player', jest.fn(), true, onPlayerParts));
    expect(
      screen.getByRole('button', { name: 'studio.size.playerParts' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});
