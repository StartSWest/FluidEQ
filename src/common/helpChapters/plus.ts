/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type IHelpChapter } from './model';

/** FluidEQ Plus: the account, the gallery, the board, the Studio, the desktop and lighting. */
const PLUS_CHAPTERS = [
  {
    id: 'plus',
    group: 'plus',
    figures: [
      {
        image: '25-plus-visualizers.png',
        width: 1984,
        height: 500,
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
        width: 1984,
        height: 500,
        controls: [
          {
            box: [240, 61, 320, 32],
            name: 'plus.gallery.search',
            text: 'help.gallery.search',
          },
          {
            box: [571, 66, 73, 21],
            name: 'help.gallery.sortName',
            text: 'help.gallery.sort',
          },
          {
            // The chips themselves, not the whole row they sit in: a line to
            // the row's far end pointed at empty space beside them.
            box: [240, 109, 660, 24],
            name: 'help.gallery.categoriesName',
            text: 'help.gallery.categories',
          },
          {
            box: [240, 149, 211, 229],
            name: 'help.gallery.cardName',
            text: 'help.gallery.card',
          },
          {
            box: [1880, 61, 100, 32],
            name: 'plus.gallery.mine',
            text: 'help.gallery.mine',
          },
          {
            box: [1844, 2, 66, 32],
            name: 'wallpaper.manage',
            text: 'help.gallery.manage',
          },
          {
            box: [1917, 2, 63, 32],
            name: 'wallpaper.stopAll',
            text: 'help.gallery.stop',
          },
        ],
      },
      {
        image: '26-plus-scene.png',
        width: 1984,
        height: 1182,
        caption: 'help.gallery.sceneCaption',
        controls: [
          {
            box: [1689, 280, 266, 32],
            name: 'plus.scene.play',
            text: 'help.gallery.play',
          },
          {
            box: [1689, 355, 266, 32],
            name: 'wallpaper.action',
            text: 'help.gallery.desktop',
          },
          {
            box: [1689, 414, 266, 32],
            name: 'plus.inspect.open',
            text: 'help.gallery.inspect',
          },
          {
            box: [240, 61, 58, 24],
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
        width: 1984,
        height: 1182,
        controls: [
          {
            box: [240, 62, 142, 27],
            name: 'help.leaderboard.periodName',
            text: 'help.leaderboard.period',
          },
          {
            box: [385, 123, 1246, 85],
            name: 'leaderboard.hero.title',
            text: 'help.leaderboard.standing',
          },
          {
            box: [1687, 123, 270, 32],
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
        width: 1984,
        height: 1182,
        controls: [
          {
            box: [240, 60, 330, 30],
            name: 'studio.project.label',
            text: 'help.studio.project',
          },
          {
            box: [240, 110, 1460, 632],
            name: 'help.studio.stageName',
            text: 'help.studio.stage',
          },
          {
            box: [253, 1117, 1313, 19],
            name: 'studio.code.title',
            text: 'help.studio.code',
          },
          {
            box: [1724, 110, 248, 215],
            name: 'studio.meters.title',
            text: 'help.studio.hears',
          },
          // These three were measured before the column gained its "Trying
          // the scene" heading, and each pointed one section too high — the
          // test signals' box sat inside the meters above them. Measured
          // again off this capture with a ruler, 2026-09-20. The wave's box
          // stops where the sticky "When it's ready" footer covers the rest
          // of its section in the capture.
          {
            box: [1737, 398, 222, 140],
            name: 'studio.signals.title',
            text: 'help.studio.signals',
          },
          {
            box: [1737, 666, 222, 68],
            name: 'studio.size.title',
            text: 'help.studio.size',
          },
          {
            box: [1737, 998, 222, 36],
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
        width: 580,
        height: 567,
        controls: [
          {
            // The monitor tiles the line describes, not the "All monitors"
            // box above them, which is where this pointed until 1.7.5.
            box: [42, 178, 496, 106],
            name: 'wallpaper.monitors',
            text: 'help.desktop.monitors',
          },
          {
            box: [25, 352, 261, 71],
            name: 'wallpaper.motion.music',
            text: 'help.desktop.music',
          },
          {
            box: [294, 352, 261, 71],
            name: 'wallpaper.motion.calm',
            text: 'help.desktop.calm',
          },
          {
            box: [500, 455, 42, 24],
            name: 'wallpaper.pauseOnBattery',
            text: 'help.desktop.battery',
          },
          {
            box: [448, 511, 107, 32],
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
        width: 1984,
        height: 1182,
        controls: [
          {
            box: [240, 61, 38, 22],
            name: 'lighting.switch',
            text: 'help.lighting.switch',
          },
          {
            box: [240, 170, 1732, 432],
            name: 'help.lighting.previewName',
            text: 'help.lighting.preview',
          },
          {
            // The device rows, not the whole card: the card held the "All
            // devices" chip, so that chip's line could run down through every
            // row of the list without it counting as a crossing.
            box: [256, 684, 934, 304],
            name: 'lighting.devices.title',
            text: 'help.lighting.devices',
          },
          {
            // The four style buttons, not the card's header row — that box
            // put the line on the card's Reset button.
            box: [1282, 686, 678, 116],
            name: 'lighting.tuning.title',
            text: 'help.lighting.style',
          },
          {
            box: [1837, 111, 120, 32],
            name: 'lighting.pickScene',
            text: 'help.lighting.browse',
          },
          {
            box: [1161, 630, 80, 32],
            name: 'lighting.target.all',
            text: 'help.lighting.all',
          },
        ],
      },
    ],
  },
] as const satisfies readonly IHelpChapter[];

export default PLUS_CHAPTERS;
