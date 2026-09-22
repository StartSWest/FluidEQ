/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type IHelpChapter, WINDOW } from './model';

/** Getting started: the first session, the window, what a PC needs and the engine. */
const START_CHAPTERS = [
  {
    id: 'start',
    group: 'start',
    figures: [
      { image: '03-eq-parametric-bands-and-live-response.png', ...WINDOW },
    ],
  },
  {
    // The window's frame, taken from the running window at 2560 x 1392 on
    // 2026-09-21. The header is cut at the signal into two captures: whole,
    // it is 2560 x 96 and is drawn about forty pixels tall in the guide, too
    // small to read a label. Its boxes are the elements' own rectangles.
    id: 'window',
    group: 'start',
    figures: [
      {
        image: '37-header-left.png',
        width: 1498,
        height: 96,
        caption: 'help.window.headerLeftCaption',
        controls: [
          {
            box: [664, 29, 150, 39],
            name: 'tabs.media',
            text: 'help.window.media',
          },
          {
            box: [820, 29, 143, 39],
            name: 'tabs.share',
            text: 'help.window.share',
          },
          { box: [969, 29, 85, 39], name: 'tabs.eq', text: 'help.window.eq' },
          {
            // Below the Rainbow mode pill, which sits on the signal's top
            // edge: a box that took the whole signal would hold the pill, and
            // the pill's line would count as crossing it.
            box: [1070, 34, 420, 47],
            name: 'help.window.waveName',
            text: 'help.window.wave',
          },
          {
            box: [1226, 18, 109, 15],
            name: 'support.game.euphoria',
            text: 'help.window.rainbow',
          },
        ],
      },
      {
        image: '38-header-right.png',
        width: 1062,
        height: 96,
        caption: 'help.window.headerRightCaption',
        controls: [
          { box: [8, 29, 93, 39], name: 'tabs.dsp', text: 'help.window.dsp' },
          {
            box: [107, 29, 112, 39],
            name: 'tabs.library',
            text: 'help.window.library',
          },
          {
            box: [225, 29, 118, 39],
            name: 'tabs.karaoke',
            text: 'help.window.karaoke',
          },
          {
            box: [349, 29, 94, 39],
            name: 'tabs.plus',
            text: 'help.window.plus',
          },
          {
            box: [722, 29, 40, 40],
            name: 'app.menu.support',
            text: 'help.window.support',
          },
          {
            box: [772, 31, 55, 36],
            name: 'help.menu',
            text: 'help.window.help',
          },
          {
            box: [838, 31, 52, 36],
            name: 'app.actions',
            text: 'help.window.actions',
          },
        ],
      },
      {
        image: '39-rail-left.png',
        width: 180,
        height: 1221,
        caption: 'help.window.railCaption',
        controls: [
          {
            box: [21, 21, 139, 89],
            name: 'sidebar.systemEq',
            text: 'help.window.systemEq',
          },
          {
            box: [21, 120, 139, 202],
            name: 'sidebar.preamp',
            text: 'help.window.preamp',
          },
          {
            box: [21, 332, 139, 89],
            name: 'sidebar.autoPreamp',
            text: 'help.window.autoNormalize',
          },
          {
            // The card's head and switch only: the meter below is its own
            // control, and one box holding the other would stop either line
            // from reaching its own without crossing.
            box: [21, 432, 139, 85],
            name: 'sidebar.graphView',
            text: 'help.window.responseGraph',
          },
          {
            box: [29, 527, 122, 662],
            name: 'help.window.meterName',
            text: 'help.window.meter',
          },
        ],
      },
    ],
  },
  {
    // The Compact player, taken on 2026-09-22 from the real player and its
    // stylesheets at its first-launch size, 480 x 1080 CSS pixels, drawn at
    // two device pixels each so it stays sharp enlarged — with a made-up
    // queue and drawn covers, nobody's real albums. Boxes are the elements'
    // own rectangles, doubled. Each deck is its own picture: the whole player
    // held twenty-seven numbered controls, which no layout keeps readable.
    id: 'player',
    group: 'start',
    figures: [
      {
        image: '42-player-top.png',
        width: 960,
        height: 560,
        caption: 'help.player.topCaption',
        controls: [
          {
            box: [12, 7, 80, 52],
            name: 'player.menu',
            text: 'help.player.menu',
          },
          {
            box: [646, 7, 56, 52],
            name: 'player.menu.alwaysOnTop',
            text: 'help.player.pin',
          },
          {
            box: [708, 7, 116, 52],
            name: 'player.switch.name',
            text: 'help.player.switch',
          },
          {
            box: [52, 146, 325, 101],
            name: 'player.clock.aria',
            text: 'help.player.clock',
          },
          {
            box: [52, 257, 365, 68],
            name: 'player.well.aria',
            text: 'help.player.well',
          },
          {
            box: [583, 211, 110, 30],
            name: 'player.readout.level',
            text: 'help.player.level',
          },
          {
            box: [32, 359, 518, 48],
            name: 'player.volume.system',
            text: 'help.player.volume',
          },
          {
            box: [566, 357, 362, 52],
            name: 'help.player.decksName',
            text: 'help.player.decks',
          },
          {
            box: [116, 425, 728, 36],
            name: 'player.seek',
            text: 'help.player.seek',
          },
          {
            box: [32, 477, 482, 60],
            name: 'help.player.playingName',
            text: 'help.player.playing',
          },
          {
            box: [736, 477, 130, 60],
            name: 'help.player.orderName',
            text: 'help.player.order',
          },
          {
            box: [876, 479, 52, 56],
            name: 'help.player.lookName',
            text: 'help.player.look',
          },
        ],
      },
      {
        image: '43-player-eq.png',
        width: 960,
        height: 708,
        caption: 'help.player.eqCaption',
        controls: [
          {
            box: [32, 29, 102, 52],
            name: 'player.eq.on',
            text: 'help.window.systemEq',
          },
          { box: [146, 31, 193, 48], name: 'eq.smart', text: 'help.eq.smart' },
          {
            box: [736, 29, 192, 52],
            name: 'dsp.presets',
            text: 'help.eq.voicing',
          },
          {
            box: [34, 105, 892, 186],
            name: 'player.eq.curve',
            text: 'help.player.screen',
          },
          {
            box: [70, 343, 64, 268],
            name: 'sidebar.preamp',
            text: 'help.window.preamp',
          },
          {
            box: [174, 352, 740, 208],
            name: 'tabs.eqMain',
            text: 'help.player.bands',
          },
          {
            box: [32, 627, 199, 52],
            name: 'eq.tone',
            text: 'help.player.tone',
          },
          {
            box: [241, 627, 151, 52],
            name: 'eq.quickLayouts',
            text: 'help.eq.layouts',
          },
          { box: [402, 627, 286, 52], name: 'eq.mode', text: 'help.eq.mode' },
          { box: [795, 627, 133, 52], name: 'eq.clear', text: 'help.eq.clear' },
        ],
      },
      {
        image: '44-player-queue.png',
        width: 960,
        height: 900,
        caption: 'help.player.queueCaption',
        controls: [
          {
            box: [144, 44, 169, 26],
            name: 'library.upNext',
            text: 'help.player.upNext',
          },
          {
            box: [789, 31, 139, 52],
            name: 'tabs.library',
            text: 'help.player.library',
          },
          {
            box: [42, 109, 876, 320],
            name: 'help.player.songsName',
            text: 'help.player.songs',
          },
        ],
      },
      {
        image: '45-player-menu.png',
        width: 672,
        height: 736,
        caption: 'help.player.menuCaption',
        controls: [
          {
            box: [30, 85, 612, 60],
            name: 'player.menu.fullApp',
            text: 'help.player.switch',
          },
          {
            box: [30, 179, 612, 260],
            name: 'player.menu.openIn',
            text: 'help.player.openIn',
          },
          {
            box: [30, 465, 612, 88],
            name: 'theme.aria',
            text: 'help.player.theme',
          },
          {
            box: [30, 579, 612, 60],
            name: 'player.menu.alwaysOnTop',
            text: 'help.player.pin',
          },
          {
            box: [30, 643, 612, 60],
            name: 'player.menu.fold',
            text: 'help.player.fold',
          },
        ],
      },
      {
        image: '46-player-folded.png',
        width: 960,
        height: 112,
        caption: 'help.player.foldedCaption',
        controls: [
          {
            box: [12, 30, 56, 52],
            name: 'player.unfold',
            text: 'help.player.unfold',
          },
          {
            box: [199, 30, 246, 52],
            name: 'help.player.playingName',
            text: 'help.player.foldedPlaying',
          },
          {
            box: [483, 42, 194, 28],
            name: 'player.clock.aria',
            text: 'help.player.foldedClock',
          },
          {
            box: [685, 30, 96, 52],
            name: 'player.eq.short',
            text: 'help.window.systemEq',
          },
        ],
      },
    ],
  },
  {
    // What a machine needs, before anything is installed on it. The only
    // chapter with no capture: a list of numbers has nothing to point at, and
    // a screenshot of the window here would be one already shown above.
    id: 'requirements',
    group: 'start',
    figures: [],
  },
  {
    id: 'engine',
    group: 'start',
    figures: [
      {
        image: '15-engine-dialog.png',
        width: 620,
        height: 444,
        controls: [
          {
            box: [66, 100, 512, 109],
            name: 'engine.fluid.name',
            text: 'help.engine.fluid',
          },
          {
            box: [66, 251, 512, 86],
            name: 'engine.apo.name',
            text: 'help.engine.apo',
          },
          {
            box: [541, 387, 54, 32],
            name: 'engine.apply',
            text: 'help.engine.apply',
          },
        ],
      },
    ],
  },
] as const satisfies readonly IHelpChapter[];

export default START_CHAPTERS;
