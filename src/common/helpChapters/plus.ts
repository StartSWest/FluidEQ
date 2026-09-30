/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type IHelpChapter } from './model';

/** FluidEQ Plus: the account, the gallery, the board, the Studio, the desktop and lighting. */
// The Plus pictures come from the running window at 2560 x 1392 on
// 2026-09-29, signed in as FluidEQ's maker. The Admin channel only an
// administrator sees is hidden for them, and on the leaderboard every member
// but the one signed in is blurred: they are real people.
const PLUS_CHAPTERS = [
  {
    id: 'plus',
    group: 'plus',
    figures: [
      {
        image: '25-plus-visualizers.png',
        width: 2078,
        height: 406,
        controls: [
          {
            box: [5, 47, 218, 42],
            name: 'leaderboard.title',
            text: 'help.plus.leaderboard',
          },
          {
            box: [5, 91, 218, 42],
            name: 'plus.visualizers.title',
            text: 'help.plus.visualizers',
          },
          {
            box: [5, 135, 218, 42],
            name: 'studio.title',
            text: 'help.plus.studio',
          },
          {
            box: [5, 179, 218, 42],
            name: 'lighting.title',
            text: 'help.plus.lighting',
          },
          {
            box: [11, 9, 28, 28],
            name: 'plus.rail.collapse',
            text: 'help.plus.fold',
          },
        ],
      },
    ],
  },
  {
    id: 'gallery',
    group: 'plus',
    figures: [
      {
        image: '25-plus-visualizers.png',
        width: 2078,
        height: 406,
        controls: [
          {
            box: [285, 75, 277, 27],
            name: 'plus.gallery.search',
            text: 'help.gallery.search',
          },
          {
            box: [581, 74, 206, 27],
            name: 'help.gallery.sortName',
            text: 'help.gallery.sort',
          },
          {
            // The chips themselves, not the whole row they sit in: a line to
            // the row's far end pointed at empty space beside them.
            box: [253, 120, 660, 24],
            name: 'help.gallery.categoriesName',
            text: 'help.gallery.categories',
          },
          {
            box: [253, 160, 219, 234],
            name: 'help.gallery.cardName',
            text: 'help.gallery.card',
          },
          {
            box: [1961, 72, 100, 32],
            name: 'plus.gallery.mine',
            text: 'help.gallery.mine',
          },
          {
            box: [1940, 13, 66, 32],
            name: 'wallpaper.manage',
            text: 'help.gallery.manage',
          },
          {
            box: [2014, 13, 47, 32],
            // "Stop" with one monitor playing, "Stop all" with more: the
            // picture has one.
            name: 'wallpaper.stop',
            text: 'help.gallery.stop',
          },
        ],
      },
      {
        image: '26-plus-scene.png',
        width: 2078,
        height: 1236,
        caption: 'help.gallery.sceneCaption',
        controls: [
          {
            box: [1778, 288, 266, 32],
            name: 'plus.scene.play',
            text: 'help.gallery.play',
          },
          {
            box: [1778, 363, 266, 32],
            name: 'wallpaper.action',
            text: 'help.gallery.desktop',
          },
          {
            box: [1778, 422, 266, 32],
            name: 'plus.inspect.open',
            text: 'help.gallery.inspect',
          },
          {
            box: [253, 71, 58, 24],
            name: 'plus.scene.back',
            text: 'help.gallery.back',
          },
        ],
      },
    ],
  },
  {
    id: 'leaderboard',
    group: 'plus',
    figures: [
      {
        image: '28-plus-leaderboard.png',
        width: 2078,
        height: 834,
        controls: [
          {
            box: [253, 73, 142, 27],
            name: 'help.leaderboard.periodName',
            text: 'help.leaderboard.period',
          },
          {
            box: [253, 119, 1492, 115],
            name: 'leaderboard.hero.title',
            text: 'help.leaderboard.standing',
          },
          {
            box: [1776, 134, 270, 32],
            name: 'leaderboard.guide.title',
            text: 'help.leaderboard.earn',
          },
        ],
      },
    ],
  },
  {
    id: 'studio',
    group: 'plus',
    figures: [
      {
        image: '31-plus-studio.png',
        width: 2372,
        height: 1236,
        controls: [
          {
            box: [253, 72, 330, 30],
            name: 'studio.project.label',
            text: 'help.studio.project',
          },
          {
            box: [253, 119, 1830, 779],
            name: 'help.studio.stageName',
            text: 'help.studio.stage',
          },
          {
            box: [357, 910, 54, 40],
            name: 'studio.code.title',
            text: 'help.studio.code',
          },
          {
            box: [2099, 414, 248, 559],
            name: 'studio.meters.title',
            text: 'help.studio.hears',
          },
          // Code is a tab under the stage in 2.0, beside Tune, whose Wave on
          // the graph is the last box: the picture keeps the Tune tab open.
          {
            box: [2099, 123, 248, 283],
            name: 'studio.signals.title',
            text: 'help.studio.signals',
          },
          {
            box: [1969, 135, 31, 28],
            name: 'studio.size.full',
            text: 'help.studio.size',
          },
          {
            box: [729, 996, 423, 129],
            name: 'studio.wave.title',
            text: 'help.studio.wave',
          },
        ],
      },
    ],
  },
  {
    id: 'desktop',
    group: 'plus',
    figures: [
      {
        image: '27-desktop-dialog.png',
        width: 924,
        height: 636,
        controls: [
          {
            // The monitor tiles the line describes, not the "All monitors"
            // box above them, which is where this pointed until 1.7.5.
            box: [305, 104, 578, 181],
            name: 'wallpaper.monitors',
            text: 'help.desktop.monitors',
          },
          {
            box: [305, 321, 285, 71],
            name: 'wallpaper.motion.music',
            text: 'help.desktop.music',
          },
          {
            box: [598, 321, 285, 71],
            name: 'wallpaper.motion.calm',
            text: 'help.desktop.calm',
          },
          {
            box: [306, 407, 576, 72],
            name: 'wallpaper.follow',
            text: 'help.desktop.follow',
          },
          {
            box: [306, 479, 576, 58],
            name: 'wallpaper.pauseOnBattery',
            text: 'help.desktop.battery',
          },
          {
            box: [786, 575, 107, 32],
            name: 'wallpaper.start',
            text: 'help.desktop.start',
          },
        ],
      },
    ],
  },
  {
    id: 'lighting',
    group: 'plus',
    figures: [
      {
        image: '29-plus-lighting.png',
        width: 2078,
        height: 1236,
        controls: [
          {
            box: [253, 72, 38, 22],
            name: 'lighting.switch',
            text: 'help.lighting.switch',
          },
          {
            box: [253, 181, 1800, 432],
            name: 'help.lighting.previewName',
            text: 'help.lighting.preview',
          },
          {
            // The device rows, not the whole card: the card held the "All
            // devices" chip, so that chip's line could run down through every
            // row of the list without it counting as a crossing.
            box: [266, 694, 1028, 366],
            name: 'lighting.devices.title',
            text: 'help.lighting.devices',
          },
          {
            // The four style buttons, not the card's header row — that box
            // put the line on the card's Reset button.
            box: [1336, 698, 704, 116],
            name: 'lighting.tuning.title',
            text: 'help.lighting.style',
          },
          {
            box: [1918, 122, 120, 32],
            name: 'lighting.pickScene',
            text: 'help.lighting.browse',
          },
          {
            box: [1215, 641, 80, 32],
            name: 'lighting.target.all',
            text: 'help.lighting.all',
          },
        ],
      },
    ],
  },
] as const satisfies readonly IHelpChapter[];

export default PLUS_CHAPTERS;
