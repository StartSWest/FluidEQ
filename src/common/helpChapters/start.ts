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
