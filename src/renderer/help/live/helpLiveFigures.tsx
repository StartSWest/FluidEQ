/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { ComponentType } from 'react';
import type { THelpLiveId } from 'common/helpGuide';
import {
  PlayerDrawing,
  PlayerFoldDrawing,
  PlayerMenuDrawing,
} from './playerFigures';
import ShareDrawing from './shareFigures';
import WindowHeaderDrawing from './windowFigures';

/**
 * Every live figure's drawing, by the name its chapter gives it
 * (`helpChapters/*.ts`, `live:`). Typed by those names, so a chapter that
 * names a drawing this list does not have fails to build, and one this list
 * keeps after its chapter dropped it fails too.
 *
 * A drawing is a component with no props that draws its panel the way the
 * app does, from made-up content — songs, outputs, curves, computers — and
 * never from the reader's own: it can show a whole panel and leave the
 * framing to its figures, as the player's does. Whatever it renders is
 * inert, hidden from assistive tech and scaled by the figure
 * (`HelpLiveSurface`); `helpLiveFigures.test.tsx` draws every one in every
 * language and fails on a drawing that throws or a control it cannot find.
 */
const HELP_LIVE_FIGURES: Readonly<Record<THelpLiveId, ComponentType>> = {
  'header-left': WindowHeaderDrawing,
  'header-right': WindowHeaderDrawing,
  'player-top': PlayerDrawing,
  'player-sound': PlayerDrawing,
  'player-queue': PlayerDrawing,
  'player-menu': PlayerMenuDrawing,
  'player-folded': PlayerFoldDrawing,
  'share-page': ShareDrawing,
};

const DRAWINGS: ReadonlyMap<string, ComponentType> = new Map(
  Object.entries(HELP_LIVE_FIGURES),
);

/** A figure's drawing by the name its chapter gives it. */
export const helpLiveDrawing = (live: string): ComponentType | undefined =>
  DRAWINGS.get(live);

export default HELP_LIVE_FIGURES;
