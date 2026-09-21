/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type IHelpChapter } from './model';

/** The DSP rack, the Room and the source analysis. */
const DSP_CHAPTERS = [
  {
    id: 'dsp',
    group: 'sound',
    figures: [
      {
        image: '20-dsp.png',
        width: 1976,
        height: 622,
        controls: [
          {
            box: [0, 83, 200, 42],
            name: 'dsp.normalizer.title',
            text: 'help.dsp.normalizer',
          },
          {
            box: [0, 129, 200, 42],
            name: 'dsp.denoise.title',
            text: 'help.dsp.denoise',
          },
          {
            box: [0, 175, 200, 42],
            name: 'dsp.exciter.title',
            text: 'help.dsp.exciter',
          },
          {
            box: [0, 221, 200, 42],
            name: 'dsp.bassForge.title',
            text: 'help.dsp.bassForge',
          },
          {
            box: [0, 267, 200, 42],
            name: 'dsp.eq.title',
            text: 'help.dsp.equaliser',
          },
          {
            box: [0, 313, 200, 42],
            name: 'dsp.bassPunch.title',
            text: 'help.dsp.bassPunch',
          },
          {
            box: [0, 359, 200, 42],
            name: 'dsp.dimension.title',
            text: 'help.dsp.dimension',
          },
          {
            box: [0, 451, 200, 42],
            name: 'dsp.maximizer.title',
            text: 'help.dsp.maximizer',
          },
          {
            box: [0, 497, 200, 42],
            name: 'dsp.master.title',
            text: 'help.dsp.master',
          },
          {
            box: [0, 580, 200, 42],
            name: 'dsp.crossfade.title',
            text: 'help.dsp.crossfade',
          },
          {
            // The chip under the header, not the On switch at the other end
            // of it, which is where this pointed until 1.7.5: the line is
            // about where the rack runs, and the chip is what says so.
            box: [0, 30, 580, 31],
            name: 'help.dsp.scopeName',
            text: 'help.dsp.scope',
          },
          {
            box: [123, 3, 210, 32],
            name: 'dsp.presets',
            text: 'help.dsp.presets',
          },
        ],
      },
    ],
  },
  {
    // The Room card alone, at 1372 CSS pixels and 1.5 device pixels to the
    // pixel like the rest: the Reference room as it ships, stereo playing so
    // five speakers and the sub are drawn asleep, and the front left chosen
    // so the pane beside the picture holds a speaker's own controls rather
    // than the card that asks for one. Every box below is that element's own
    // rectangle in the capture, measured rather than eyeballed — the page
    // was rebuilt twice in two days and boxes placed by eye survive neither.
    id: 'room',
    group: 'sound',
    figures: [
      {
        image: '32-dsp-room.png',
        width: 2010,
        height: 1131,
        controls: [
          {
            box: [23, 128, 728, 831],
            name: 'dsp.room.graphLabel',
            text: 'help.room.picture',
          },
          {
            box: [765, 128, 604, 250],
            name: 'help.room.speakerName',
            text: 'help.room.speaker',
          },
          {
            box: [1384, 128, 604, 250],
            name: 'help.room.dialsName',
            text: 'help.room.dials',
          },
          {
            box: [23, 92, 164, 21],
            name: 'help.room.liveName',
            text: 'help.room.live',
          },
          {
            box: [89, 24, 315, 48],
            name: 'dsp.room.presets',
            text: 'help.room.picker',
          },
          {
            box: [1579, 988, 213, 48],
            name: 'dsp.room.fitView.start',
            text: 'help.room.fit',
          },
          {
            box: [1400, 859, 571, 84],
            name: 'dsp.room.groupHead',
            text: 'help.room.head',
          },
          {
            box: [654, 24, 98, 48],
            name: 'dsp.eqSave.save',
            text: 'help.room.saved',
          },
        ],
      },
    ],
  },
  {
    id: 'denoise',
    group: 'sound',
    // Not WINDOW: this one is a crop of the page, not the whole window.
    figures: [
      {
        image: '13-dsp-denoise-and-source-analysis.png',
        width: 1762,
        height: 693,
      },
    ],
  },
] as const satisfies readonly IHelpChapter[];

export default DSP_CHAPTERS;
