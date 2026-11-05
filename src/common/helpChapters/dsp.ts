/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type IHelpChapter } from './model';

/** The DSP rack, the Room and the source analysis. */
const DSP_CHAPTERS = [
  {
    id: 'dsp',
    group: 'sound',
    figures: [
      {
        live: 'dsp-overview',
        width: 1280,
        height: 808,
        still: '20-dsp.png',
        controls: [
          {
            target: '[data-dsp-section="normalizer"]',
            name: 'dsp.normalizer.title',
            text: 'help.dsp.normalizer',
          },
          {
            target: '[data-dsp-section="denoise"]',
            name: 'dsp.denoise.title',
            text: 'help.dsp.denoise',
          },
          {
            target: '[data-dsp-section="deEsser"]',
            name: 'dsp.deEsser.title',
            text: 'help.deesser.intro',
          },
          {
            target: '[data-dsp-section="exciter"]',
            name: 'dsp.exciter.title',
            text: 'help.dsp.exciter',
          },
          {
            target: '[data-dsp-section="bassForge"]',
            name: 'dsp.bassForge.title',
            text: 'help.dsp.bassForge',
          },
          {
            target: '[data-dsp-section="eq"]',
            name: 'dsp.eq.title',
            text: 'help.dsp.equaliser',
          },
          {
            target: '[data-dsp-section="bassPunch"]',
            name: 'dsp.bassPunch.title',
            text: 'help.dsp.bassPunch',
          },
          {
            target: '[data-dsp-section="dimension"]',
            name: 'dsp.dimension.title',
            text: 'help.dsp.dimension',
          },
          {
            target: '[data-dsp-section="room"]',
            name: 'dsp.room.title',
            text: 'help.dsp.room',
          },
          {
            target: '[data-dsp-section="dynamics"]',
            name: 'dsp.dynamics.title',
            text: 'help.dynamics.intro',
          },
          {
            target: '[data-dsp-section="maximizer"]',
            name: 'dsp.maximizer.title',
            text: 'help.dsp.maximizer',
          },
          {
            target: '[data-dsp-section="master"]',
            name: 'dsp.master.title',
            text: 'help.dsp.master',
          },
          {
            target: '[data-dsp-section="crossfade"]',
            name: 'dsp.crossfade.title',
            text: 'help.dsp.crossfade',
          },
          {
            target: '.dsp-presets',
            name: 'dsp.presets',
            text: 'help.dsp.presets',
          },
        ],
      },
    ],
  },
  { id: 'normalizer', group: 'sound', figures: [] },
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
  {
    id: 'deesser',
    group: 'sound',
    figures: [
      {
        live: 'dsp-deesser',
        width: 1180,
        height: 297,
        still: '43-dsp-deesser.png',
        controls: [
          {
            target: '.dsp-de-esser-controls > .dsp-band:nth-child(1)',
            name: 'dsp.deEsser.group.find',
            text: 'dsp.deEsser.group.findHint',
          },
          {
            target: '.dsp-de-esser-controls > .dsp-band:nth-child(2)',
            name: 'dsp.deEsser.group.reduce',
            text: 'dsp.deEsser.mode.spectralHint',
          },
          {
            target: '.dsp-de-esser-controls > .dsp-band:nth-child(3)',
            name: 'dsp.deEsser.group.timing',
            text: 'dsp.deEsser.group.timingHint',
          },
          {
            target: '.dsp-de-esser-controls > .dsp-band:nth-child(4)',
            name: 'dsp.deEsser.group.where',
            text: 'dsp.deEsser.description',
          },
        ],
      },
    ],
  },
  {
    id: 'dynamics',
    group: 'sound',
    figures: [
      {
        live: 'dsp-dynamics',
        width: 1180,
        height: 755,
        still: '42-dsp-dynamics.png',
        controls: [
          {
            target: '.is-band-0',
            name: 'dsp.dynamics.band.low',
            text: 'dsp.dynamics.band.lowHint',
          },
          {
            target: '.is-band-1',
            name: 'dsp.dynamics.band.mid',
            text: 'dsp.dynamics.band.midHint',
          },
          {
            target: '.is-band-2',
            name: 'dsp.dynamics.band.high',
            text: 'dsp.dynamics.band.highHint',
          },
          {
            target: '.dsp-dynamics-timing',
            name: 'dsp.dynamics.timing',
            text: 'dsp.dynamics.timingHint',
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
  { id: 'crossfade', group: 'sound', figures: [] },
] as const satisfies readonly IHelpChapter[];

export default DSP_CHAPTERS;
