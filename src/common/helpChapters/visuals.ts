/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import CAPTURED from './captured';
import { type IHelpChapter } from './model';

/** The graph, its looks and the Plus visualizers in it. */
const VISUAL_CHAPTERS = [
  {
    id: 'graph',
    group: 'visuals',
    figures: [
      {
        image: '21-graph-strip.png',
        width: 694,
        height: 44,
        caption: 'help.graph.stripCaption',
        controls: [
          {
            box: [12, 8, 81, 28],
            name: 'graph.liveOutput',
            text: 'help.graph.live',
          },
          {
            box: [102, 13, 16, 18],
            name: 'graph.style.previous',
            text: 'help.graph.previous',
          },
          {
            box: [128, 8, 194, 28],
            name: 'graph.picker.label',
            text: 'help.graph.picker',
          },
          {
            box: [332, 13, 16, 18],
            name: 'graph.style.next',
            text: 'help.graph.next',
          },
          {
            box: [358, 8, 99, 28],
            name: 'help.graph.autoName',
            text: 'help.graph.auto',
          },
          {
            box: [468, 13, 18, 18],
            name: 'look.palette.cycle',
            text: 'help.graph.colouring',
          },
          {
            box: [496, 8, 67, 28],
            name: 'graph.design.new',
            text: 'help.graph.newLook',
          },
          {
            box: [572, 13, 18, 18],
            name: 'help.graph.bandsName',
            text: 'help.graph.bands',
          },
          {
            box: [600, 13, 18, 18],
            name: 'help.graph.gridName',
            text: 'help.graph.grid',
          },
          {
            box: [628, 8, 56, 28],
            name: 'help.graph.viewName',
            text: 'help.graph.view',
          },
        ],
      },
      {
        image: '22-graph-strip-plus.png',
        width: 767,
        height: 44,
        caption: 'help.graph.plusCaption',
        controls: [
          {
            box: [513, 8, 94, 28],
            name: 'help.graph.tintName',
            text: 'help.graph.tint',
          },
          {
            box: [461, 8, 42, 28],
            name: 'help.graph.likeName',
            text: 'help.graph.like',
          },
          {
            box: [617, 13, 18, 18],
            name: 'lighting.title',
            text: 'help.graph.lighting',
          },
          {
            box: [645, 13, 18, 18],
            name: 'wallpaper.action',
            text: 'help.graph.desktop',
          },
        ],
      },
      // Taken by `scripts/help-captures` (`captured.ts`).
      CAPTURED['23-graph-view-menu.png'],
    ],
  },
  {
    id: 'looks',
    group: 'visuals',
    figures: [
      {
        // The picker, open, drawn by its own list (`help/live/lookFigures`)
        // from FluidEQ's styles and made-up scenes on the stills the app
        // ships. The filters are each column's whole row of chips: a line
        // to one chip read as pointing at it and struck through the others.
        // Its still is the 2.0 capture, for the exported guide.
        live: 'look-picker',
        width: 780,
        height: 560,
        // The picker's own box: on a window under 796px it is narrower than
        // the 780 it is laid out at, as the real one is there.
        frame: '.look-picker__menu',
        still: '24-look-picker.png',
        controls: [
          {
            target: '.look-picker__search',
            name: 'help.looks.searchName',
            text: 'help.looks.search',
          },
          {
            target: '.look-picker__column--styles .look-picker__head',
            name: 'graph.picker.styles',
            text: 'help.looks.styles',
          },
          {
            target: '.look-picker__column--styles .gallery-chip',
            name: 'help.looks.familiesName',
            text: 'help.looks.families',
          },
          {
            target: '.look-picker__column--plus .look-picker__head',
            name: 'graph.picker.plus',
            text: 'help.looks.plus',
          },
          {
            target: '.look-picker__column--plus .gallery-chip',
            name: 'help.looks.categoriesName',
            text: 'help.looks.categories',
          },
        ],
      },
    ],
  },
] as const satisfies readonly IHelpChapter[];

export default VISUAL_CHAPTERS;
