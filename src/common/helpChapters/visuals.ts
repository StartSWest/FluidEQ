/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

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
      {
        image: '23-graph-view-menu.png',
        width: 396,
        height: 928,
        caption: 'help.graph.viewCaption',
        controls: [
          {
            box: [18, 79, 360, 28],
            name: 'graph.view.expand',
            text: 'help.graph.expand',
            keys: 'Ctrl+S',
          },
          {
            box: [18, 107, 360, 28],
            name: 'graph.view.fullscreen',
            text: 'help.graph.fullscreen',
            keys: 'Ctrl+F',
          },
          {
            box: [18, 200, 360, 28],
            name: 'help.graph.showingName',
            text: 'help.graph.showing',
            keys: 'Ctrl+W',
          },
          {
            box: [18, 368, 360, 28],
            name: 'help.graph.waveName',
            text: 'help.graph.wave',
          },
          {
            box: [18, 396, 360, 28],
            name: 'help.graph.topWaveName',
            text: 'help.graph.topWave',
          },
          {
            box: [18, 424, 360, 28],
            name: 'help.graph.gridName',
            text: 'help.graph.grid',
            keys: 'Ctrl+G',
          },
          {
            box: [18, 452, 360, 28],
            name: 'help.graph.bandsName',
            text: 'help.graph.bandsMenu',
          },
          {
            box: [18, 480, 360, 28],
            name: 'help.graph.meterName',
            text: 'help.graph.meter',
          },
          {
            box: [18, 508, 360, 24],
            name: 'graph.waveHeight',
            text: 'help.graph.waveHeight',
          },
          {
            box: [18, 532, 360, 24],
            name: 'graph.wavePosition',
            text: 'help.graph.wavePosition',
          },
          {
            box: [18, 593, 360, 28],
            name: 'graph.style.next',
            text: 'help.graph.next',
            keys: 'Space',
          },
          {
            box: [18, 621, 360, 28],
            name: 'graph.style.previous',
            text: 'help.graph.previous',
            keys: 'Ctrl+Space',
          },
          {
            box: [18, 797, 360, 24],
            name: 'graph.scene.attack',
            text: 'help.graph.attack',
          },
          {
            box: [18, 821, 360, 24],
            name: 'graph.scene.release',
            text: 'help.graph.release',
          },
          {
            box: [18, 845, 360, 28],
            name: 'graph.scene.ownTiming',
            text: 'help.graph.ownTiming',
          },
          {
            box: [18, 135, 360, 28],
            name: 'wallpaper.action',
            text: 'help.graph.desktop',
          },
        ],
      },
    ],
  },
  {
    id: 'looks',
    group: 'visuals',
    figures: [
      {
        image: '24-look-picker.png',
        width: 800,
        height: 580,
        controls: [
          {
            box: [11, 11, 778, 32],
            name: 'help.looks.searchName',
            text: 'help.looks.search',
          },
          {
            box: [19, 53, 310, 12],
            name: 'graph.picker.styles',
            text: 'help.looks.styles',
          },
          {
            // Every filter chip, both rows, not "Lines" alone — a line to
            // the one chip read as pointing at it and struck through "All".
            box: [19, 73, 310, 20],
            name: 'help.looks.familiesName',
            text: 'help.looks.families',
          },
          {
            box: [346, 53, 435, 17],
            name: 'graph.picker.plus',
            text: 'help.looks.plus',
          },
          {
            // From "All" to "Made by you", not "Nature" alone: a line to the
            // one chip had to strike through the other four to reach it.
            box: [346, 78, 435, 20],
            name: 'help.looks.categoriesName',
            text: 'help.looks.categories',
          },
        ],
      },
    ],
  },
] as const satisfies readonly IHelpChapter[];

export default VISUAL_CHAPTERS;
