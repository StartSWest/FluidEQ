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
      note: 'help.start.videoNote',
      poster: '03-eq-parametric-bands-and-live-response.png',
    },
  },
  {
    // The window's frame. The title bar is drawn by its own parts
    // (`help/live/windowFigures`) and framed in two, cut at the signal:
    // whole, it is drawn too small in the guide to read a label. The drawing
    // is laid out wider than the bar ever comes to, so nothing in it wraps,
    // and each tab is found by its place in its strip. Its stills are the
    // 2.0 captures, for the exported guide.
    //
    // The rails are captures from the running window at 2560 x 1392 on
    // 2026-09-29: their boxes are the elements' own rectangles, and each
    // side column's control is its whole group, name and switch.
    id: 'window',
    group: 'start',
    figures: [
      {
        live: 'header-left',
        width: 2400,
        height: 74,
        frame: '.window-titlebar__left, .titlebar-nav',
        // Under the 8px the bar keeps between its parts below 1920px wide:
        // at 10 the right figure showed a sliver of the signal's rim.
        margin: 6,
        caption: 'help.window.headerLeftCaption',
        still: '37-header-left.png',
        controls: [
          {
            target: '.window-titlebar__left .workspace-tab:nth-of-type(1)',
            name: 'tabs.media',
            text: 'help.window.media',
          },
          {
            target: '.window-titlebar__left .workspace-tab:nth-of-type(2)',
            name: 'tabs.share',
            text: 'help.window.share',
          },
          {
            target: '.window-titlebar__left .workspace-tab:nth-of-type(3)',
            name: 'tabs.eq',
            text: 'help.window.eq',
          },
          {
            // The whole signal, its Colourful switch with it.
            target: '.titlebar-nav .waveform-visualizer-shell',
            name: 'help.window.waveName',
            text: 'help.window.wave',
          },
        ],
      },
      {
        live: 'header-right',
        width: 2400,
        height: 74,
        frame: '.window-titlebar__right',
        margin: 6,
        caption: 'help.window.headerRightCaption',
        still: '38-header-right.png',
        controls: [
          {
            target: '.window-titlebar__right .workspace-tab:nth-of-type(1)',
            name: 'tabs.dsp',
            text: 'help.window.dsp',
          },
          {
            target: '.window-titlebar__right .workspace-tab:nth-of-type(2)',
            name: 'tabs.library',
            text: 'help.window.library',
          },
          {
            target: '.window-titlebar__right .workspace-tab:nth-of-type(3)',
            name: 'tabs.karaoke',
            text: 'help.window.karaoke',
          },
          {
            // Only in a build with accounts (`WorkspaceTabsRight`).
            target: '.window-titlebar__right .workspace-tab:nth-of-type(4)',
            name: 'tabs.plus',
            text: 'help.window.plus',
          },
          {
            target: '.support-pet',
            name: 'app.menu.support',
            text: 'help.window.support',
          },
          {
            target: '.actions-menu .workspace-header__tools-trigger',
            name: 'app.actions',
            text: 'help.window.actions',
          },
          {
            target: '.help-menu__trigger',
            name: 'help.menu',
            text: 'help.window.help',
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
    // The Compact player, drawn by its own parts (`help/live/playerFigures`)
    // playing the made-up queue What's New plays, so the pictures follow the
    // player and speak the reader's language (Ivan, 2026-10-26: "do the help
    // and what new"). The drawing lays the whole player out as its window
    // holds it, 480 CSS pixels wide, and each figure frames one part of it:
    // the whole player held twenty-seven numbered controls, which no layout
    // keeps readable. Each control is found by its own class on the drawing;
    // the stills are the 2.0 captures, for the exported guide.
    id: 'player',
    group: 'start',
    figures: [
      {
        live: 'player-top',
        width: 480,
        height: 362,
        frame: '.player-title, .player-top',
        caption: 'help.player.topCaption',
        still: '42-player-top.png',
        controls: [
          {
            target: '.player-title__mark',
            name: 'player.menu',
            text: 'help.player.menu',
          },
          {
            target:
              '.player-title__controls > .player-title__button:first-child',
            name: 'player.menu.alwaysOnTop',
            text: 'help.player.pin',
          },
          {
            target: '.window-mode-switch',
            name: 'player.switch.name',
            text: 'help.player.switch',
          },
          {
            target: '.player-hero__key',
            name: 'graph.view.fullscreen',
            text: 'help.player.fullScreen',
          },
          {
            target: '.player-source',
            name: 'help.player.sourceName',
            text: 'help.player.source',
          },
          {
            target: '.player-readouts',
            name: 'player.readout.level',
            text: 'help.player.level',
          },
          {
            target: '.player-hero__heart',
            name: 'library.playlist.addToFavorites',
            text: 'help.player.heart',
          },
          {
            target: '.player-dock__seek .player-range--seek',
            name: 'player.seek',
            text: 'help.player.seek',
          },
          {
            // The keys, not their row: the row runs the player's width
            // and its circle stood in the empty space beside them.
            target: '.player-dock__keys > button',
            name: 'help.player.playingName',
            text: 'help.player.playing',
          },
          {
            target: '.player-volume',
            name: 'player.volume.system',
            text: 'help.player.volume',
          },
          {
            target: '.player-dock__mode',
            name: 'help.player.orderName',
            text: 'help.player.order',
          },
          {
            target: '.player-dock__look',
            name: 'help.player.lookName',
            text: 'help.player.look',
          },
        ],
      },
      {
        live: 'player-sound',
        width: 480,
        height: 330,
        frame: '.player-sound',
        caption: 'help.player.eqCaption',
        still: '43-player-eq.png',
        controls: [
          {
            target: '.player-sound__fold',
            name: 'player.sound.title',
            text: 'help.player.soundFold',
          },
          {
            target: '.voicing-pick',
            name: 'dsp.presets',
            text: 'help.eq.voicing',
          },
          { target: '.player-split', name: 'eq.smart', text: 'help.eq.smart' },
          {
            target: '.player-sound__power',
            name: 'sidebar.systemEq',
            text: 'help.window.systemEq',
          },
          {
            target: '.player-eq__faces',
            name: 'eq.tone',
            text: 'help.player.tone',
          },
          {
            target: '.player-bands > :first-child',
            name: 'sidebar.preamp',
            text: 'help.window.preamp',
          },
          {
            target: '.player-bands__window',
            name: 'tabs.eqMain',
            text: 'help.player.bands',
          },
          {
            target: '.quick-layouts',
            name: 'eq.quickLayouts',
            text: 'help.eq.layouts',
          },
          {
            target: '.eq-mode-trigger',
            name: 'eq.mode',
            text: 'help.player.mode',
          },
          {
            target: '.clear-eq-trigger',
            name: 'eq.clear',
            text: 'help.eq.clear',
          },
        ],
      },
      {
        live: 'player-queue',
        width: 480,
        height: 280,
        frame: '.player-shelf, .player-foot',
        caption: 'help.player.queueCaption',
        still: '44-player-queue.png',
        controls: [
          {
            target: '.player-shelf__tab',
            name: 'library.upNext',
            text: 'help.player.upNext',
          },
          {
            target: '.player-shelf__key:not(.player-shelf__fold)',
            name: 'player.queue.save',
            text: 'help.player.save',
          },
          {
            target: '.player-shelf__fold',
            name: 'player.queue.fold',
            text: 'help.player.queueFold',
          },
          {
            // One song, the next to play, by its cover, and a remove key a
            // row below: a target that matches several is pointed at where
            // they stand together, which for a column of rows is the gap
            // between two; and the whole row ends beside its remove key.
            target: 'li:not(.is-ahead) + li.is-ahead .player-queue__art',
            name: 'help.player.songsName',
            text: 'help.player.songs',
          },
          {
            // The song after it, so the two circles stand a row apart.
            target:
              'li:not(.is-ahead) + li.is-ahead + li.is-ahead .player-queue__remove',
            name: 'library.queue.remove',
            text: 'help.player.remove',
          },
          {
            target: '.player-foot__output',
            name: 'sidebar.output',
            text: 'help.player.output',
          },
          {
            target: '.player-foot__engine',
            name: 'help.player.engineName',
            text: 'help.player.engine',
          },
        ],
      },
      {
        // As wide as the menu's longest language: it is as wide as its row
        // of pages, which is 467px in Japanese and over 440 in Spanish,
        // Portuguese and Russian. At 420 their right side was cut off, with
        // the circles of the lines that end there left standing apart.
        live: 'player-menu',
        width: 480,
        height: 560,
        frame: '.player-menu',
        caption: 'help.player.menuCaption',
        still: '45-player-menu.png',
        controls: [
          {
            target: '.player-menu__home',
            name: 'player.menu.fullApp',
            text: 'help.player.switch',
          },
          {
            target: '.player-menu__page:first-child',
            name: 'player.menu.openIn',
            text: 'help.player.openIn',
          },
          {
            target: '.actions-menu__sliders',
            name: 'graph.sceneTint.brightness',
            text: 'help.player.theme',
          },
          {
            // A settings row lays its parts out in the tray's grid and has
            // no box of its own (`display: contents`): its parts are found.
            target: '.actions-menu__sliders + .menu-preference > *',
            name: 'eq.sliders',
            text: 'help.player.sliders',
          },
          {
            target: '.actions-menu__prefs-rule + .menu-preference > *',
            name: 'player.menu.alwaysOnTop',
            text: 'help.player.pin',
          },
          {
            target: '.player-menu__fold',
            name: 'player.menu.fold',
            text: 'help.player.fold',
          },
        ],
      },
      {
        live: 'player-folded',
        width: 480,
        height: 54,
        caption: 'help.player.foldedCaption',
        still: '46-player-folded.png',
        controls: [
          {
            target: '.player-fold__mark',
            name: 'player.unfold',
            text: 'help.player.unfold',
          },
          {
            target: '.player-fold__play',
            name: 'library.play',
            text: 'help.player.foldedPlaying',
          },
          {
            target: '.player-fold__time',
            name: 'player.clock.aria',
            text: 'help.player.clock',
          },
          {
            target: '.player-fold__seek',
            name: 'player.seek',
            text: 'help.player.seek',
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
