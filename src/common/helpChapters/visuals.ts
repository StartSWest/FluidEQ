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
        width: 966,
        height: 52,
        caption: 'help.graph.stripCaption',
        controls: [
          {
            box: [289, 12, 81, 28],
            name: 'graph.liveOutput',
            text: 'help.graph.live',
          },
          {
            box: [380, 17, 16, 18],
            name: 'graph.style.previous',
            text: 'help.graph.previous',
          },
          {
            box: [406, 15, 194, 22],
            name: 'graph.picker.label',
            text: 'help.graph.picker',
          },
          {
            box: [610, 17, 16, 18],
            name: 'graph.style.next',
            text: 'help.graph.next',
          },
          {
            box: [738, 17, 18, 18],
            name: 'help.graph.autoName',
            text: 'help.graph.auto',
          },
          {
            box: [738, 17, 18, 18],
            name: 'look.palette.cycle',
            text: 'help.graph.colouring',
          },
          {
            box: [766, 12, 67, 28],
            name: 'graph.design.new',
            text: 'help.graph.newLook',
          },
          {
            box: [842, 17, 18, 18],
            name: 'help.graph.bandsName',
            text: 'help.graph.bands',
          },
          {
            box: [870, 17, 18, 18],
            name: 'help.graph.gridName',
            text: 'help.graph.grid',
          },
          {
            box: [898, 12, 56, 28],
            name: 'help.graph.viewName',
            text: 'help.graph.view',
          },
        ],
      },
      {
        image: '22-graph-strip-plus.png',
        width: 917,
        height: 52,
        caption: 'help.graph.plusCaption',
        controls: [
          {
            box: [737, 17, 18, 18],
            name: 'help.graph.tintName',
            text: 'help.graph.tint',
          },
          {
            box: [765, 17, 18, 18],
            name: 'lighting.title',
            text: 'help.graph.lighting',
          },
          {
            box: [793, 17, 18, 18],
            name: 'wallpaper.action',
            text: 'help.graph.desktop',
          },
        ],
      },
      {
        image: '23-graph-view-menu.png',
        width: 372,
        height: 780,
        caption: 'help.graph.viewCaption',
        controls: [
          {
            box: [6, 34, 352, 28],
            name: 'graph.view.expand',
            text: 'help.graph.expand',
            keys: 'Ctrl+S',
          },
          {
            box: [6, 62, 352, 28],
            name: 'graph.view.fullscreen',
            text: 'help.graph.fullscreen',
            keys: 'Ctrl+F',
          },
          {
            box: [6, 155, 352, 28],
            name: 'help.graph.showingName',
            text: 'help.graph.showing',
            keys: 'Ctrl+W',
          },
          {
            box: [6, 267, 352, 28],
            name: 'help.graph.waveName',
            text: 'help.graph.wave',
          },
          {
            box: [6, 295, 352, 28],
            name: 'help.graph.topWaveName',
            text: 'help.graph.topWave',
          },
          {
            box: [6, 323, 352, 28],
            name: 'help.graph.gridName',
            text: 'help.graph.grid',
            keys: 'Ctrl+G',
          },
          {
            box: [6, 351, 352, 28],
            name: 'help.graph.bandsName',
            text: 'help.graph.bandsMenu',
          },
          {
            box: [6, 379, 352, 28],
            name: 'help.graph.meterName',
            text: 'help.graph.meter',
          },
          {
            box: [214, 418, 96, 3],
            name: 'graph.waveHeight',
            text: 'help.graph.waveHeight',
          },
          {
            box: [214, 442, 96, 3],
            name: 'graph.wavePosition',
            text: 'help.graph.wavePosition',
          },
          {
            box: [6, 492, 352, 28],
            name: 'graph.style.next',
            text: 'help.graph.next',
            keys: 'Space',
          },
          {
            box: [6, 520, 352, 28],
            name: 'graph.style.previous',
            text: 'help.graph.previous',
            keys: 'Ctrl+Space',
          },
          {
            box: [6, 600, 352, 24],
            name: 'graph.scene.attack',
            text: 'help.graph.attack',
          },
          {
            box: [6, 624, 352, 24],
            name: 'graph.scene.release',
            text: 'help.graph.release',
          },
          {
            box: [6, 648, 352, 28],
            name: 'graph.scene.ownTiming',
            text: 'help.graph.ownTiming',
          },
          {
            box: [6, 90, 352, 28],
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
        width: 780,
        height: 560,
        controls: [
          {
            box: [1, 1, 778, 32],
            name: 'help.looks.searchName',
            text: 'help.looks.search',
          },
          {
            box: [1, 33, 326, 526],
            name: 'graph.picker.styles',
            text: 'help.looks.styles',
          },
          {
            // Every filter chip, both rows, not "Lines" alone — a line to
            // the one chip read as pointing at it and struck through "All".
            box: [10, 62, 268, 47],
            name: 'help.looks.familiesName',
            text: 'help.looks.families',
          },
          {
            box: [327, 33, 452, 526],
            name: 'graph.picker.plus',
            text: 'help.looks.plus',
          },
          {
            // From "All" to "Made by you", not "Nature" alone: a line to the
            // one chip had to strike through the other four to reach it.
            box: [338, 67, 274, 22],
            name: 'help.looks.categoriesName',
            text: 'help.looks.categories',
          },
        ],
      },
    ],
  },
] as const satisfies readonly IHelpChapter[];

export default VISUAL_CHAPTERS;
