/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type IHelpChapter, WINDOW } from './model';

/** Shaping the sound on the EQ page: bands, EQ mode, games, corrections, outputs and the config. */
const SOUND_CHAPTERS = [
  {
    id: 'eq',
    group: 'sound',
    // The Bands page twice, from the running window at 2560 x 1392 on
    // 2026-09-29 at Brightness 50: as it opens, with nothing selected and
    // the Tone row under the bands, and with one band selected. The graph
    // stands between the title row and the bands card, so both are cut from
    // the title row to the card's foot with the graph between them, and the
    // second from the tabs, for Game mode beside the engine's name. Every box
    // is that element's rectangle as the capture was drawn.
    figures: [
      {
        image: '16-eq-bands.png',
        width: 2094,
        height: 1206,
        caption: 'help.eq.bandsCaption',
        controls: [
          {
            box: [1381, 12, 151, 32],
            // `dsp.presets`, the picker's label on screen: it was Voicing
            // until the catalogue became whole chains instead of curves, and
            // that label and its key are gone.
            name: 'dsp.presets',
            text: 'help.eq.voicing',
          },
          {
            box: [1542, 12, 97, 32],
            name: 'eq.smart',
            text: 'help.eq.smart',
          },
          {
            box: [2041, 12, 32, 32],
            name: 'eq.clear',
            text: 'help.eq.clear',
          },
          {
            box: [1649, 12, 102, 32],
            name: 'eq.mode',
            text: 'help.eq.mode',
          },
          {
            box: [1871, 12, 32, 32],
            name: 'eq.addBand',
            text: 'help.eq.add',
          },
          {
            box: [1761, 12, 104, 32],
            name: 'eq.quickLayouts',
            text: 'help.eq.layouts',
          },
          {
            // The layer itself, not the row with its label: the label is
            // not a control.
            box: [1913, 12, 118, 32],
            name: 'graph.curves',
            text: 'help.eq.layers',
          },
          {
            box: [1165, 748, 64, 290],
            name: 'help.eq.bandName',
            text: 'help.eq.band',
          },
          {
            box: [901, 1063, 88, 108],
            name: 'eq.tone.bass',
            text: 'help.eq.bass',
          },
          {
            box: [1003, 1063, 88, 108],
            name: 'eq.tone.mid',
            text: 'help.eq.mid',
          },
          {
            box: [1105, 1063, 88, 108],
            name: 'eq.tone.treble',
            text: 'help.eq.treble',
          },
        ],
      },
      {
        image: '36-eq-band-selected.png',
        width: 2094,
        height: 1246,
        caption: 'help.eq.bandCaption',
        controls: [
          {
            // Numbered here rather than above, where it stands over EQ mode
            // with Also applied under that and a button on either side: no
            // straight line could reach EQ mode without crossing one of them.
            box: [1964, 7, 109, 32],
            name: 'dsp.latency.gameMode',
            text: 'help.eq.gameMode',
          },
          {
            box: [695, 1103, 104, 108],
            name: 'eq.selected',
            text: 'help.eq.selected',
          },
          {
            box: [807, 1103, 162, 108],
            name: 'eq.filter',
            text: 'help.eq.filter',
          },
          {
            box: [977, 1103, 84, 108],
            name: 'eq.frequency',
            text: 'help.eq.frequency',
          },
          {
            box: [1069, 1103, 84, 108],
            name: 'eq.gain',
            text: 'help.eq.gain',
          },
          {
            box: [1161, 1103, 84, 108],
            name: 'eq.quality',
            text: 'help.eq.q',
          },
          {
            box: [1253, 1103, 56, 108],
            name: 'eq.active',
            text: 'help.eq.disable',
          },
          {
            box: [1317, 1136, 38, 38],
            name: 'eq.delete',
            text: 'help.eq.delete',
          },
        ],
      },
      {
        image: '17-band-menu.png',
        width: 236,
        height: 311,
        caption: 'help.eq.menuCaption',
        controls: [
          {
            box: [26, 140, 188, 34],
            name: 'eq.menu.reset',
            text: 'help.eq.reset',
          },
          {
            box: [26, 175, 188, 34],
            name: 'eq.menu.disable',
            text: 'help.eq.disable',
          },
          {
            box: [26, 220, 188, 34],
            name: 'eq.menu.addLeft',
            text: 'help.eq.addLeft',
          },
          {
            box: [26, 255, 188, 34],
            name: 'eq.menu.addRight',
            text: 'help.eq.addRight',
          },
        ],
      },
    ],
  },
  {
    id: 'eqmode',
    group: 'sound',
    figures: [
      {
        // The menu from the running window at 2560 x 1392 on 2026-09-29,
        // under the FluidEQ Engine; each numbered setting is its whole row,
        // its name over its choices.
        image: '18-eq-mode.png',
        width: 340,
        height: 905,
        caption: 'help.eqmode.modeCaption',
        controls: [
          {
            box: [32, 139, 276, 50],
            name: 'eq.mode.strength',
            text: 'help.eqmode.strength',
          },
          {
            box: [32, 197, 276, 50],
            name: 'eq.mode.q',
            text: 'help.eqmode.q',
          },
          {
            box: [32, 255, 276, 88],
            name: 'eq.mode.phase',
            text: 'help.eqmode.phase',
          },
          {
            box: [32, 351, 276, 81],
            name: 'eq.mode.treble',
            text: 'help.eqmode.treble',
          },
          {
            box: [32, 603, 276, 50],
            name: 'eq.mode.smoothing',
            text: 'help.eqmode.smoothing',
          },
          {
            box: [252, 61, 65, 32],
            name: 'eq.mode.reset',
            text: 'help.eqmode.reset',
          },
        ],
      },
      {
        image: '19-band-designs.png',
        width: 358,
        height: 286,
        caption: 'help.eqmode.designsCaption',
        controls: [
          {
            box: [29, 91, 300, 70],
            name: 'eq.layouts.builtIn',
            text: 'help.eqmode.builtIn',
          },
          {
            box: [219, 225, 111, 32],
            name: 'eq.layouts.saveNew',
            text: 'help.eqmode.save',
          },
        ],
      },
    ],
  },
  {
    // The Game presets page with two games on it, cut to its tabs and rows:
    // at 2560 wide the rest of the page below them is empty.
    id: 'games',
    group: 'sound',
    figures: [
      {
        image: '41-game-presets.png',
        width: 2068,
        height: 276,
        controls: [
          {
            box: [291, 12, 109, 31],
            name: 'tabs.games',
            text: 'help.games.tab',
          },
          {
            box: [1926, 58, 126, 32],
            name: 'games.add',
            text: 'help.games.add',
          },
          {
            // The icon and the words: the column they sit in stretches all
            // the way to the picker.
            box: [23, 106, 150, 38],
            name: 'help.games.gameName',
            text: 'help.games.game',
          },
          {
            box: [1749, 109, 179, 32],
            name: 'help.games.soundName',
            text: 'help.games.sound',
          },
          {
            box: [2001, 109, 40, 32],
            name: 'help.games.removeName',
            text: 'help.games.remove',
          },
        ],
      },
    ],
  },
  {
    id: 'headphones',
    group: 'sound',
    figures: [
      { image: '04-eq-headphone-correction-and-import.png', ...WINDOW },
    ],
  },
  {
    id: 'convolution',
    group: 'sound',
    figures: [{ image: '05-eq-convolution-library.png', ...WINDOW }],
  },
  {
    // The right rail with every section open, from the running window at
    // 2560 x 1392 on 2026-09-29, down to its last section: the site link
    // under it is not a control. It runs to the window's right edge, so the
    // picture does. Restore has no number of its own: 2.0 stands it between
    // New profile and Update, where no line can reach it without crossing
    // one of them, so Update's text says what the button beside it does.
    id: 'profiles',
    group: 'sound',
    figures: [
      {
        image: '40-rail-right.png',
        width: 338,
        height: 1053,
        controls: [
          {
            box: [29, 175, 287, 54],
            name: 'profiles.title',
            text: 'help.profiles.list',
          },
          {
            box: [233, 235, 83, 32],
            name: 'profiles.update',
            text: 'help.profiles.update',
          },
          {
            box: [29, 235, 107, 32],
            name: 'profiles.new',
            text: 'help.profiles.new',
          },
          {
            box: [17, 106, 311, 64],
            name: 'output.device',
            text: 'help.profiles.output',
          },
          {
            box: [29, 277, 287, 29],
            name: 'output.mapping',
            text: 'help.profiles.mapping',
          },
          {
            box: [17, 368, 311, 76],
            name: 'extraOutput.singlePlayer',
            text: 'help.profiles.onePlayer',
          },
          {
            box: [17, 444, 311, 235],
            name: 'extraOutput.title',
            text: 'help.profiles.outputs',
          },
          {
            box: [17, 689, 311, 106],
            name: 'driver.title',
            text: 'help.profiles.driver',
          },
        ],
      },
    ],
  },
  {
    id: 'config',
    group: 'sound',
    figures: [{ image: '06-eq-equalizer-apo-config.png', ...WINDOW }],
  },
] as const satisfies readonly IHelpChapter[];

export default SOUND_CHAPTERS;
