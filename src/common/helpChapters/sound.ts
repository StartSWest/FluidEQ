/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type IHelpChapter, WINDOW } from './model';

/** Shaping the sound on the EQ page: bands, EQ mode, games, corrections, outputs and the config. */
const SOUND_CHAPTERS = [
  {
    id: 'eq',
    group: 'sound',
    // The Bands page twice, from the running window at 2560 x 1392 on
    // 2026-09-21: as it opens, with nothing selected and the tone controls
    // standing where a band's editor goes, and with one band selected. Both
    // are cut from the title to the editor inside the page's own card, and
    // every box is that element's rectangle as the capture was drawn.
    figures: [
      {
        image: '16-eq-bands.png',
        width: 2016,
        height: 676,
        caption: 'help.eq.bandsCaption',
        controls: [
          {
            box: [673, 75, 93, 32],
            // `dsp.presets`, the picker's label on screen: it was Voicing
            // until the catalogue became whole chains instead of curves, and
            // that label and its key are gone.
            name: 'dsp.presets',
            text: 'help.eq.voicing',
          },
          {
            box: [776, 75, 99, 32],
            name: 'eq.smart',
            text: 'help.eq.smart',
          },
          {
            box: [885, 75, 88, 32],
            name: 'eq.clear',
            text: 'help.eq.clear',
          },
          {
            box: [983, 72, 133, 38],
            name: 'eq.mode',
            text: 'help.eq.mode',
          },
          {
            box: [1126, 75, 95, 32],
            name: 'eq.addBand',
            text: 'help.eq.add',
          },
          {
            box: [1231, 75, 104, 32],
            name: 'eq.quickLayouts',
            text: 'help.eq.layouts',
          },
          {
            // The layer itself, not the row with its label: the label is
            // not a control.
            box: [856, 118, 386, 28],
            name: 'eq.layers',
            text: 'help.eq.layers',
          },
          {
            box: [1092, 162, 128, 378],
            name: 'help.eq.bandName',
            text: 'help.eq.band',
          },
          {
            box: [917, 569, 88, 74],
            name: 'eq.tone.bass',
            text: 'help.eq.bass',
          },
          {
            box: [1019, 569, 88, 74],
            name: 'eq.tone.mid',
            text: 'help.eq.mid',
          },
          {
            box: [1121, 569, 88, 74],
            name: 'eq.tone.treble',
            text: 'help.eq.treble',
          },
        ],
      },
      {
        image: '36-eq-band-selected.png',
        width: 2016,
        height: 654,
        caption: 'help.eq.bandCaption',
        controls: [
          {
            // Numbered here rather than above, where it stands over EQ mode
            // with Also applied under that and a button on either side: no
            // straight line could reach EQ mode without crossing one of them.
            box: [935, 35, 138, 22],
            name: 'dsp.latency.gameMode',
            text: 'help.eq.gameMode',
          },
          {
            box: [1092, 162, 128, 378],
            name: 'eq.selected',
            text: 'help.eq.selected',
          },
          {
            box: [779, 567, 162, 56],
            name: 'eq.filter',
            text: 'help.eq.filter',
          },
          {
            box: [949, 567, 64, 56],
            name: 'eq.frequency',
            text: 'help.eq.frequency',
          },
          {
            box: [1021, 567, 64, 56],
            name: 'eq.gain',
            text: 'help.eq.gain',
          },
          {
            box: [1093, 567, 64, 56],
            name: 'eq.quality',
            text: 'help.eq.q',
          },
          {
            box: [1165, 585, 56, 38],
            name: 'eq.active',
            text: 'help.eq.disable',
          },
          {
            box: [1229, 585, 112, 38],
            name: 'eq.delete',
            text: 'help.eq.delete',
          },
        ],
      },
      {
        image: '17-band-menu.png',
        width: 200,
        height: 185,
        caption: 'help.eq.menuCaption',
        controls: [
          {
            box: [6, 30, 188, 34],
            name: 'eq.menu.reset',
            text: 'help.eq.reset',
          },
          {
            box: [6, 65, 188, 34],
            name: 'eq.menu.disable',
            text: 'help.eq.disable',
          },
          {
            box: [6, 110, 188, 34],
            name: 'eq.menu.addLeft',
            text: 'help.eq.addLeft',
          },
          {
            box: [6, 145, 188, 34],
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
        // The menu on its segmented tracks, at the amp's scale it is drawn at
        // on the page too, under the FluidEQ Engine with every choice at its
        // default (`.claude/harness-eqmode`, 2026-09-22).
        image: '18-eq-mode.png',
        width: 312,
        height: 826,
        caption: 'help.eqmode.modeCaption',
        controls: [
          {
            box: [18, 87, 276, 50],
            name: 'eq.mode.strength',
            text: 'help.eqmode.strength',
          },
          {
            box: [18, 145, 276, 50],
            name: 'eq.mode.q',
            text: 'help.eqmode.q',
          },
          {
            box: [18, 203, 276, 88],
            name: 'eq.mode.phase',
            text: 'help.eqmode.phase',
          },
          {
            box: [18, 299, 276, 67],
            name: 'eq.mode.treble',
            text: 'help.eqmode.treble',
          },
          {
            box: [18, 538, 276, 50],
            name: 'eq.mode.smoothing',
            text: 'help.eqmode.smoothing',
          },
          {
            box: [238, 9, 65, 32],
            name: 'eq.mode.reset',
            text: 'help.eqmode.reset',
          },
        ],
      },
      {
        image: '19-band-designs.png',
        width: 330,
        height: 220,
        caption: 'help.eqmode.designsCaption',
        controls: [
          {
            box: [15, 15, 300, 190],
            name: 'eq.layouts.builtIn',
            text: 'help.eqmode.builtIn',
          },
          {
            box: [205, 173, 111, 32],
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
        width: 2016,
        height: 224,
        controls: [
          {
            box: [294, 5, 109, 31],
            name: 'tabs.games',
            text: 'help.games.tab',
          },
          {
            box: [1871, 51, 126, 32],
            name: 'games.add',
            text: 'help.games.add',
          },
          {
            // The icon and the words: the column they sit in stretches all
            // the way to the picker.
            box: [22, 103, 140, 30],
            name: 'help.games.gameName',
            text: 'help.games.game',
          },
          {
            box: [1694, 102, 179, 32],
            name: 'help.games.soundName',
            text: 'help.games.sound',
          },
          {
            box: [1946, 102, 40, 32],
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
    // 2560 x 1392, down to its last section: the site link under it is not
    // a control. The whole-window capture this replaced was of 1.7.2.
    id: 'profiles',
    group: 'sound',
    figures: [
      {
        image: '40-rail-right.png',
        width: 346,
        height: 1032,
        controls: [
          {
            box: [35, 83, 268, 70],
            name: 'profiles.title',
            text: 'help.profiles.list',
          },
          {
            box: [35, 161, 268, 32],
            name: 'profiles.update',
            text: 'help.profiles.update',
          },
          {
            box: [35, 199, 131, 32],
            name: 'profiles.new',
            text: 'help.profiles.new',
          },
          {
            box: [172, 199, 131, 32],
            name: 'profiles.restore',
            text: 'help.profiles.restore',
          },
          {
            box: [35, 328, 268, 66],
            name: 'output.device',
            text: 'help.profiles.output',
          },
          {
            box: [35, 413, 268, 84],
            name: 'output.mapping',
            text: 'help.profiles.mapping',
          },
          {
            box: [35, 621, 268, 54],
            name: 'extraOutput.singlePlayer',
            text: 'help.profiles.onePlayer',
          },
          {
            box: [35, 701, 268, 116],
            name: 'extraOutput.title',
            text: 'help.profiles.outputs',
          },
          {
            box: [35, 942, 268, 48],
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
