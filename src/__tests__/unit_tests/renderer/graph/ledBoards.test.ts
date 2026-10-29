/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The LED wall's and LED bars' unlit glass reaches the top of the canvas,
 * where the graph's lines start, while a reading still lights only the
 * band's own rows (Ivan, 2026-10-25: "bg needs to reach this line").
 */

import { ledBoard } from '../../../../renderer/graph/sceneViews/ledWall';
import { panelSegments } from '../../../../renderer/graph/sceneViews/ledBars';
import {
  createPieceRow,
  type IPieceRow,
} from '../../../../renderer/graph/sceneViews/scenePieces';

const band = (top: number, bottom: number, flipped = false) => ({
  top,
  bottom,
  flipped,
  opacity: 1,
});

const row = (body: number): IPieceRow => ({
  ...createPieceRow(),
  count: 30,
  pitch: body + 2,
  body,
});

describe('the LED wall’s board', () => {
  it('prints unlit lamps to the canvas’s top, the last one cut by that edge', () => {
    // A band from 40 down to 300, on a 10px pitch: 26 rows a reading lights.
    const board = ledBoard(band(40, 300), 10);
    expect(board.rows).toBe(26);
    expect(board.drawn).toBe(30);
    // The highest unlit lamp's centre stands within one pitch of the top,
    // and the lamp past it, half a pitch or more above, would show nothing.
    const highest = board.foot + board.up * (board.drawn - 1) * 10;
    expect(highest).toBeGreaterThan(-5);
    expect(highest).toBeLessThan(10);
    expect(board.foot + board.up * board.drawn * 10).toBeLessThanOrEqual(-5);
  });

  it('keeps a hanging board to its band', () => {
    const board = ledBoard(band(40, 300, true), 10);
    expect(board.drawn).toBe(board.rows);
  });
});

describe('the LED bars’ panel', () => {
  it('prints unlit segments to the canvas’s top while a reading lights the band’s rows', () => {
    const { rowPitch, cell, boards } = panelSegments([band(40, 300)], row(12));
    const [board] = boards;
    expect(board.rows).toBe(Math.floor(260 / rowPitch));
    expect(board.drawn).toBeGreaterThan(board.rows);
    // The highest unlit segment still shows below the top edge, and the one
    // past it would not show at all.
    const topOf = (step: number) =>
      board.floor - (step + 1) * rowPitch + (rowPitch - cell);
    expect(topOf(board.drawn - 1) + cell).toBeGreaterThan(0);
    expect(topOf(board.drawn) + cell).toBeLessThanOrEqual(0);
  });

  it('keeps a hanging panel to its band', () => {
    const [board] = panelSegments([band(40, 300, true)], row(12)).boards;
    expect(board.drawn).toBe(board.rows);
  });
});
