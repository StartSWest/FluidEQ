/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { OFFICIAL_SITE_URL } from '../branding';
import { type IHelpChapter, WINDOW } from './model';

/** Getting started: the first session, the window, what a PC needs and the engine. */
const START_CHAPTERS = [
  {
    id: 'start',
    group: 'start',
    figures: [
      { image: '03-eq-parametric-bands-and-live-response.png', ...WINDOW },
    ],
    // The first-steps film, where the site shows it (Ivan, 2026-09-30: "put
    // it on the site and be able to be streamed by the app"). Its poster is
    // the chapter's own capture until the film's first frame replaces it.
    video: {
      src: `${OFFICIAL_SITE_URL}/video/first-steps.mp4`,
      captions: {
        src: `${OFFICIAL_SITE_URL}/video/first-steps.en.vtt`,
        lang: 'en',
      },
      page: `${OFFICIAL_SITE_URL}/#first-steps`,
      title: 'help.start.videoTitle',
      poster: '03-eq-parametric-bands-and-live-response.png',
    },
  },
  {
    // The window's frame, taken from the running window at 2560 x 1392 on
    // 2026-09-29. The header is cut at the signal into two captures: whole,
    // it is 2560 x 84 and is drawn about forty pixels tall in the guide, too
    // small to read a label. Its boxes are the elements' own rectangles, and
    // each side column's control is its whole group, name and switch.
    id: 'window',
    group: 'start',
    figures: [
      {
        image: '37-header-left.png',
        width: 1498,
        height: 84,
        caption: 'help.window.headerLeftCaption',
        controls: [
          {
            box: [661, 17, 151, 40],
            name: 'tabs.media',
            text: 'help.window.media',
          },
          {
            box: [818, 17, 144, 40],
            name: 'tabs.share',
            text: 'help.window.share',
          },
          { box: [968, 17, 86, 40], name: 'tabs.eq', text: 'help.window.eq' },
          {
            // The whole signal, its Rainbow badge with it.
            box: [1070, 10, 420, 54],
            name: 'help.window.waveName',
            text: 'help.window.wave',
          },
        ],
      },
      {
        image: '38-header-right.png',
        width: 1062,
        height: 84,
        caption: 'help.window.headerRightCaption',
        controls: [
          { box: [8, 17, 94, 40], name: 'tabs.dsp', text: 'help.window.dsp' },
          {
            box: [108, 17, 113, 40],
            name: 'tabs.library',
            text: 'help.window.library',
          },
          {
            box: [227, 17, 119, 40],
            name: 'tabs.karaoke',
            text: 'help.window.karaoke',
          },
          {
            box: [352, 17, 95, 40],
            name: 'tabs.plus',
            text: 'help.window.plus',
          },
          {
            box: [703, 17, 40, 40],
            name: 'app.menu.support',
            text: 'help.window.support',
          },
          {
            box: [804, 24, 32, 26],
            name: 'help.menu',
            text: 'help.window.help',
          },
          {
            box: [756, 24, 46, 26],
            name: 'app.actions',
            text: 'help.window.actions',
          },
        ],
      },
      {
        image: '39-rail-left.png',
        width: 140,
        height: 1270,
        caption: 'help.window.railCaption',
        controls: [
          {
            box: [18, 22, 96, 123],
            name: 'sidebar.systemEq',
            text: 'help.window.systemEq',
          },
          {
            box: [18, 166, 96, 123],
            name: 'sidebar.preamp',
            text: 'help.window.preamp',
          },
          {
            box: [18, 297, 96, 43],
            name: 'sidebar.autoPreamp',
            text: 'help.window.autoNormalize',
          },
          {
            // The card's head and switch only: the meter below is its own
            // control, and one box holding the other would stop either line
            // from reaching its own without crossing.
            box: [18, 361, 96, 43],
            name: 'sidebar.graphView',
            text: 'help.window.responseGraph',
          },
          {
            box: [18, 425, 96, 827],
            name: 'help.window.meterName',
            text: 'help.window.meter',
          },
        ],
      },
    ],
  },
  {
    // The Compact player, taken on 2026-09-29 from the real player and its
    // stylesheets at 480 CSS pixels wide (560 for the folded strip, which
    // gives up its EQ key below 520), drawn at
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
        height: 564,
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
            box: [583, 194, 110, 30],
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
            box: [116, 425, 728, 32],
            name: 'player.seek',
            text: 'help.player.seek',
          },
          {
            box: [32, 473, 482, 60],
            name: 'help.player.playingName',
            text: 'help.player.playing',
          },
          {
            box: [736, 473, 130, 60],
            name: 'help.player.orderName',
            text: 'help.player.order',
          },
          {
            box: [876, 475, 52, 56],
            name: 'help.player.lookName',
            text: 'help.player.look',
          },
        ],
      },
      {
        image: '43-player-eq.png',
        width: 960,
        height: 770,
        caption: 'help.player.eqCaption',
        controls: [
          {
            box: [32, 33, 102, 52],
            name: 'player.eq.on',
            text: 'help.window.systemEq',
          },
          { box: [144, 33, 197, 52], name: 'eq.smart', text: 'help.eq.smart' },
          {
            box: [736, 33, 192, 52],
            name: 'dsp.presets',
            text: 'help.eq.voicing',
          },
          {
            box: [32, 101, 896, 230],
            name: 'player.eq.curve',
            text: 'help.player.screen',
          },
          {
            box: [32, 347, 64, 324],
            name: 'sidebar.preamp',
            text: 'help.window.preamp',
          },
          {
            box: [130, 347, 798, 324],
            name: 'tabs.eqMain',
            text: 'help.player.bands',
          },
          {
            box: [32, 687, 199, 52],
            name: 'eq.tone',
            text: 'help.player.tone',
          },
          {
            box: [241, 687, 205, 52],
            name: 'eq.quickLayouts',
            text: 'help.eq.layouts',
          },
          { box: [456, 687, 202, 52], name: 'eq.mode', text: 'help.eq.mode' },
          { box: [868, 687, 60, 52], name: 'eq.clear', text: 'help.eq.clear' },
        ],
      },
      {
        image: '44-player-queue.png',
        width: 960,
        height: 1088,
        caption: 'help.player.queueCaption',
        controls: [
          {
            box: [32, 44, 741, 26],
            name: 'library.upNext',
            text: 'help.player.upNext',
          },
          {
            box: [789, 31, 139, 52],
            name: 'tabs.library',
            text: 'help.player.library',
          },
          {
            box: [32, 99, 896, 957],
            name: 'help.player.songsName',
            text: 'help.player.songs',
          },
        ],
      },
      {
        image: '45-player-menu.png',
        width: 634,
        height: 1016,
        caption: 'help.player.menuCaption',
        controls: [
          {
            box: [34, 33, 566, 112],
            name: 'player.menu.fullApp',
            text: 'help.player.switch',
          },
          {
            box: [34, 153, 566, 301],
            name: 'player.menu.openIn',
            text: 'help.player.openIn',
          },
          {
            box: [54, 472, 534, 228],
            name: 'graph.sceneTint.brightness',
            text: 'help.player.theme',
          },
          {
            box: [96, 790, 492, 76],
            name: 'player.menu.alwaysOnTop',
            text: 'help.player.pin',
          },
          {
            box: [34, 898, 566, 84],
            name: 'player.menu.fold',
            text: 'help.player.fold',
          },
        ],
      },
      {
        image: '46-player-folded.png',
        width: 1120,
        height: 80,
        caption: 'help.player.foldedCaption',
        controls: [
          {
            box: [12, 14, 56, 52],
            name: 'player.unfold',
            text: 'help.player.unfold',
          },
          {
            box: [199, 14, 246, 52],
            name: 'help.player.playingName',
            text: 'help.player.foldedPlaying',
          },
          {
            box: [453, 14, 211, 52],
            name: 'player.clock.aria',
            text: 'help.player.foldedClock',
          },
          {
            box: [824, 14, 96, 52],
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
        width: 832,
        height: 453,
        controls: [
          {
            box: [309, 65, 478, 159],
            name: 'engine.fluid.name',
            text: 'help.engine.fluid',
          },
          {
            box: [309, 232, 478, 119],
            name: 'engine.apo.name',
            text: 'help.engine.apo',
          },
          {
            box: [743, 389, 54, 32],
            name: 'engine.apply',
            text: 'help.engine.apply',
          },
        ],
      },
    ],
  },
] as const satisfies readonly IHelpChapter[];

export default START_CHAPTERS;
