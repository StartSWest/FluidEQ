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
        still: 'help/dsp-overview.png',
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
            target: '.dsp-studio__bar .dsp-eq-preset-first',
            name: 'dsp.wholeChain',
            text: 'help.dsp.presets',
          },
          {
            target: '.dsp-studio__bar .dsp-chain-transfer',
            name: 'help.dsp.chainActionsName',
            text: 'help.dsp.chainActions',
          },
          {
            target: '.dsp-studio__bar .dsp-header-switches',
            name: 'help.dsp.switchesName',
            text: 'help.dsp.switches',
          },
          {
            target: '.dsp-stage .dsp-card-header .dsp-eq-preset-first',
            name: 'help.dsp.stagePresetName',
            text: 'help.dsp.stagePreset',
          },
        ],
      },
    ],
  },
  { id: 'normalizer', group: 'sound', figures: [] },
  {
    id: 'denoise',
    group: 'sound',
    figures: [
      {
        live: 'dsp-denoise',
        width: 1180,
        height: 600,
        still: 'help/dsp-denoise.png',
        controls: [
          {
            target: '.dsp-card-header .dsp-eq-preset-first',
            name: 'dsp.presets',
            text: 'help.denoise.preset',
          },
          {
            target: '.dsp-monitor-isolate',
            name: 'dsp.denoise.isolate',
            text: 'help.denoise.isolate',
          },
          {
            target: '.dsp-denoise-graph',
            name: 'help.denoise.graphName',
            text: 'help.denoise.graph',
          },
          {
            target: '.dsp-normalizer-stats:not(.dsp-denoise-live)',
            name: 'dsp.denoise.analysis',
            text: 'help.denoise.analysis',
          },
          {
            target: '.dsp-denoise-module.is-hiss',
            name: 'dsp.denoise.hiss',
            text: 'help.denoise.hiss',
          },
          {
            target: '.dsp-denoise-module.is-hum',
            name: 'dsp.denoise.hum',
            text: 'help.denoise.hum',
          },
          {
            target: '.dsp-denoise-module.is-clicks',
            name: 'dsp.denoise.click',
            text: 'help.denoise.clicks',
          },
          {
            target: '.dsp-denoise-module.is-voice',
            name: 'dsp.denoise.voice',
            text: 'help.denoise.voice',
          },
          {
            target: '.dsp-denoise-live',
            name: 'help.denoise.liveName',
            text: 'help.denoise.live',
          },
        ],
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
        still: 'help/dsp-deesser.png',
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
        still: 'help/dsp-dynamics.png',
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
        live: 'dsp-room',
        width: 1280,
        height: 860,
        still: 'help/dsp-room.png',
        controls: [
          {
            target: '.dsp-room-bar .dsp-eq-preset-first',
            name: 'dsp.room.presets',
            text: 'help.room.picker',
          },
          {
            target: '.dsp-room-bar .dsp-eq-transfer',
            name: 'dsp.eqSave.save',
            text: 'help.room.saved',
          },
          {
            target: '.dsp-room-source',
            name: 'help.room.liveName',
            text: 'help.room.live',
          },
          {
            target: '.dsp-room-picture',
            name: 'dsp.room.graphLabel',
            text: 'help.room.picture',
          },
          {
            target: '.dsp-room-pane',
            name: 'help.room.speakerName',
            text: 'help.room.speaker',
          },
          {
            target: '.dsp-room-quick',
            name: 'dsp.room.quick.title',
            text: 'help.room.dials',
          },
          {
            target: '.dsp-room-tune > .dsp-band:nth-child(2)',
            name: 'dsp.room.tune.bassCentre',
            text: 'help.room.bass',
          },
          {
            target: '.dsp-room-tune > .dsp-band:nth-child(3)',
            name: 'dsp.room.tune.stereo',
            text: 'help.room.stereo',
          },
          {
            target: '.dsp-room-fit .dsp-band',
            name: 'dsp.room.fitView.head',
            text: 'help.room.head',
          },
        ],
      },
    ],
  },
  { id: 'crossfade', group: 'sound', figures: [] },
  {
    // The Mic tab, drawn by its own parts (`help/live/micFigures`).
    id: 'mic',
    group: 'sound',
    figures: [
      {
        live: 'mic-page',
        width: 1280,
        height: 760,
        still: 'help/mic-page.png',
        controls: [
          {
            // The maker's own effects: the first row, over the rack's switch.
            target: '.mic-rail > .dsp-rail-row:first-child',
            name: 'mic.stage.own',
            text: 'help.mic.own',
          },
          {
            target: '.mic-rail__master',
            name: 'mic.rail.master',
            text: 'help.mic.master',
          },
          {
            target: '.mic-rail > .mic-rail__master ~ .dsp-rail-row',
            name: 'help.mic.stagesName',
            text: 'help.mic.stages',
          },
          {
            target: '.mic-head__pick .rich-pick__trigger',
            name: 'mic.label',
            text: 'help.mic.pick',
          },
          {
            target: '.mic-picture',
            name: 'help.mic.pictureName',
            text: 'help.mic.picture',
          },
          {
            target: '.mic-head__profile .rich-pick__trigger',
            name: 'mic.profile.label',
            text: 'help.mic.profile',
          },
          {
            target: '.mic-head__delay',
            name: 'mic.delay.label',
            text: 'help.mic.delay',
          },
        ],
      },
    ],
  },
] as const satisfies readonly IHelpChapter[];

export default DSP_CHAPTERS;
