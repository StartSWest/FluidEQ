/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { IHelpFigure } from './model';

/**
 * WRITTEN BY `scripts/help-captures/capture.ts`; do not edit by hand.
 *
 * The figures that script takes, each with the boxes of its numbered
 * controls as measured in the same render as the picture in `docs/`. Retake
 * a picture and its boxes come with it: run the script again (its README says
 * how), never move a box here.
 */
const CAPTURED = {
  '16-eq-bands.png': {
    image: '16-eq-bands.png',
    width: 2094,
    height: 1206,
    caption: 'help.eq.bandsCaption',
    controls: [
      {
        box: [1381, 12, 151, 32],
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
  '36-eq-band-selected.png': {
    image: '36-eq-band-selected.png',
    width: 2094,
    height: 1246,
    caption: 'help.eq.bandCaption',
    controls: [
      {
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
  '18-eq-mode.png': {
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
  '40-rail-right.png': {
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
  '23-graph-view-menu.png': {
    image: '23-graph-view-menu.png',
    width: 396,
    height: 928,
    caption: 'help.graph.viewCaption',
    controls: [
      {
        box: [18, 79, 360, 28],
        name: 'graph.view.expand',
        text: 'help.graph.expand',
        keys: 'Ctrl+S',
      },
      {
        box: [18, 107, 360, 28],
        name: 'graph.view.fullscreen',
        text: 'help.graph.fullscreen',
        keys: 'Ctrl+F',
      },
      {
        box: [18, 200, 360, 28],
        name: 'help.graph.showingName',
        text: 'help.graph.showing',
        keys: 'Ctrl+W',
      },
      {
        box: [18, 368, 360, 28],
        name: 'help.graph.waveName',
        text: 'help.graph.wave',
      },
      {
        box: [18, 396, 360, 28],
        name: 'help.graph.topWaveName',
        text: 'help.graph.topWave',
      },
      {
        box: [18, 424, 360, 28],
        name: 'help.graph.gridName',
        text: 'help.graph.grid',
        keys: 'Ctrl+G',
      },
      {
        box: [18, 452, 360, 28],
        name: 'help.graph.bandsName',
        text: 'help.graph.bandsMenu',
      },
      {
        box: [18, 480, 360, 28],
        name: 'help.graph.meterName',
        text: 'help.graph.meter',
      },
      {
        box: [18, 508, 360, 24],
        name: 'graph.waveHeight',
        text: 'help.graph.waveHeight',
      },
      {
        box: [18, 532, 360, 24],
        name: 'graph.wavePosition',
        text: 'help.graph.wavePosition',
      },
      {
        box: [18, 593, 360, 28],
        name: 'graph.style.next',
        text: 'help.graph.next',
        keys: 'Space',
      },
      {
        box: [18, 621, 360, 28],
        name: 'graph.style.previous',
        text: 'help.graph.previous',
        keys: 'Ctrl+Space',
      },
      {
        box: [18, 135, 360, 28],
        name: 'wallpaper.action',
        text: 'help.graph.desktop',
      },
    ],
  },
  '14-share-audio-roles.png': {
    image: '14-share-audio-roles.png',
    width: 2560,
    height: 1392,
  },
} as const satisfies Record<string, IHelpFigure>;

export default CAPTURED;
