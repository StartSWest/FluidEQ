/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type IHelpChapter } from './model';

/** The DSP rack, the Room and the source analysis. */
const DSP_CHAPTERS = [
  {
    // The rack from the running window at 2560 x 1392 on 2026-09-29, on
    // Dimension: a stage the preset already has on, so nothing is switched
    // and the header keeps the preset's name, and one that draws its curve
    // with nothing playing. The System-wide pill is gone: Game mode and the
    // delay it moves sit in the header now, and the Room is a stage of the
    // rail.
    id: 'dsp',
    group: 'sound',
    figures: [
      {
        image: '20-dsp.png',
        width: 2060,
        height: 652,
        controls: [
          {
            box: [12, 64, 200, 42],
            name: 'dsp.normalizer.title',
            text: 'help.dsp.normalizer',
          },
          {
            box: [12, 110, 200, 42],
            name: 'dsp.denoise.title',
            text: 'help.dsp.denoise',
          },
          {
            box: [12, 156, 200, 42],
            name: 'dsp.exciter.title',
            text: 'help.dsp.exciter',
          },
          {
            box: [12, 202, 200, 42],
            name: 'dsp.bassForge.title',
            text: 'help.dsp.bassForge',
          },
          {
            box: [12, 248, 200, 42],
            name: 'dsp.eq.title',
            text: 'help.dsp.equaliser',
          },
          {
            box: [12, 294, 200, 42],
            name: 'dsp.bassPunch.title',
            text: 'help.dsp.bassPunch',
          },
          {
            box: [12, 340, 200, 42],
            name: 'dsp.dimension.title',
            text: 'help.dsp.dimension',
          },
          {
            box: [12, 386, 200, 42],
            name: 'dsp.room.title',
            text: 'help.dsp.room',
          },
          {
            box: [12, 432, 200, 42],
            name: 'dsp.maximizer.title',
            text: 'help.dsp.maximizer',
          },
          {
            box: [12, 478, 200, 42],
            name: 'dsp.master.title',
            text: 'help.dsp.master',
          },
          {
            box: [12, 561, 200, 42],
            name: 'dsp.crossfade.title',
            text: 'help.dsp.crossfade',
          },
          {
            box: [1498, 17, 305, 28],
            name: 'dsp.latency.gameMode',
            text: 'help.eq.gameMode',
          },
          {
            box: [135, 15, 210, 32],
            name: 'dsp.presets',
            text: 'help.dsp.presets',
          },
        ],
      },
    ],
  },
  {
    // The Room card alone, from the running window at 2560 x 1392 on
    // 2026-09-29: the room it had on, stereo playing so
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
        width: 1838,
        height: 705,
        controls: [
          {
            box: [32, 102, 502, 502],
            name: 'dsp.room.graphLabel',
            text: 'help.room.picture',
          },
          {
            box: [553, 93, 414, 260],
            name: 'help.room.speakerName',
            text: 'help.room.speaker',
          },
          {
            box: [977, 93, 414, 260],
            name: 'help.room.dialsName',
            text: 'help.room.dials',
          },
          {
            box: [23, 69, 112, 14],
            name: 'help.room.liveName',
            text: 'help.room.live',
          },
          {
            box: [67, 24, 210, 32],
            name: 'dsp.room.presets',
            text: 'help.room.picker',
          },
          {
            box: [1537, 478, 142, 32],
            name: 'dsp.room.fitView.start',
            text: 'help.room.fit',
          },
          {
            box: [1401, 363, 414, 316],
            name: 'dsp.room.groupHead',
            text: 'help.room.head',
          },
          {
            box: [444, 24, 65, 32],
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
        width: 1838,
        height: 731,
      },
    ],
  },
] as const satisfies readonly IHelpChapter[];

export default DSP_CHAPTERS;
