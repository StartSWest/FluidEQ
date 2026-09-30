/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type IHelpChapter, WINDOW } from './model';

/** Listening, singing and sharing, and where to turn when something is wrong. */
const LISTEN_CHAPTERS = [
  {
    // The running window on 2026-09-29 as it stood, 1776 x 1392, with the
    // web view laid into its rectangle: a picture of the window leaves it
    // empty. NASA's channel, signed out, as since 1.7.3: United States
    // government work, no advertising in it.
    id: 'online',
    group: 'listen',
    figures: [
      {
        image: '01-online-media-youtube-live-eq.png',
        width: 1776,
        height: 1392,
      },
    ],
  },
  {
    id: 'library',
    group: 'listen',
    figures: [{ image: '08-library-artists-and-up-next.png', ...WINDOW }],
  },
  {
    id: 'queue',
    group: 'listen',
    figures: [{ image: '09-library-album-and-play-queue.png', ...WINDOW }],
  },
  {
    id: 'karaoke',
    group: 'listen',
    // The Karaoke page alone, from the running window at 2560 x 1392 on
    // 2026-09-30, on FluidEQ's own song: somebody else's songs stay out of
    // the guide, the playlist shows only ours, and the bar at the
    // window's foot, which names whatever else the computer plays, is
    // left outside the picture.
    figures: [{ image: '11-karaoke-player.png', width: 2098, height: 1254 }],
  },
  {
    id: 'maker',
    group: 'listen',
    figures: [
      {
        image: '12-karaoke-maker-pitch-and-lyrics.png',
        width: 2098,
        height: 1254,
      },
      {
        image: '35-karaoke-maker-toolbar.png',
        width: 830,
        height: 42,
        caption: 'help.makerBar.caption',
        controls: [
          {
            box: [4, 5, 32, 32],
            name: 'karaoke.maker.openProject',
            text: 'help.makerBar.import',
          },
          {
            box: [40, 5, 32, 32],
            name: 'karaoke.maker.lyrics',
            text: 'help.makerBar.lyrics',
          },
          {
            box: [148, 5, 32, 32],
            name: 'karaoke.maker.lyricsTiming',
            text: 'help.makerBar.timing',
          },
          {
            box: [184, 5, 32, 32],
            name: 'karaoke.maker.panView',
            text: 'help.makerBar.pan',
          },
          {
            // The "As recorded" picker itself. The old box ran on over the
            // bin to "Add a language", and its middle — where the line lands —
            // was the bin.
            box: [230, 5, 108, 32],
            name: 'karaoke.translation.picker',
            text: 'help.makerBar.language',
          },
          {
            box: [494, 5, 32, 32],
            name: 'karaoke.maker.recordLines',
            text: 'help.makerBar.record',
          },
          {
            box: [530, 5, 32, 32],
            name: 'karaoke.maker.selectNotes',
            text: 'help.makerBar.select',
          },
          {
            box: [566, 5, 32, 32],
            name: 'karaoke.maker.paintNotes',
            text: 'help.makerBar.paint',
          },
          {
            box: [674, 5, 32, 32],
            name: 'karaoke.maker.split',
            text: 'help.makerBar.split',
          },
          {
            box: [756, 5, 32, 32],
            name: 'karaoke.maker.advanced',
            text: 'help.makerBar.repair',
          },
          {
            box: [798, 5, 32, 32],
            name: 'karaoke.maker.export',
            text: 'help.makerBar.export',
          },
        ],
      },
      {
        image: '34-karaoke-maker-lyrics.png',
        width: 1312,
        height: 852,
        caption: 'help.maker.lyricsCaption',
        controls: [
          {
            box: [309, 65, 369, 685],
            name: 'help.maker.referenceName',
            text: 'help.maker.reference',
          },
          {
            box: [702, 77, 553, 431],
            name: 'help.maker.timingName',
            text: 'help.maker.timing',
          },
          {
            box: [702, 517, 553, 221],
            name: 'help.maker.wordName',
            text: 'help.maker.word',
          },
        ],
      },
      {
        image: '33-karaoke-maker-tools.png',
        width: 454,
        height: 525,
        caption: 'help.maker.toolsCaption',
        controls: [
          {
            box: [29, 52, 396, 32],
            name: 'karaoke.maker.removeBackground',
            text: 'help.maker.separate',
          },
          {
            box: [29, 89, 396, 32],
            name: 'karaoke.maker.vocalStem',
            text: 'help.maker.loadVocals',
          },
          {
            box: [29, 175, 396, 32],
            name: 'karaoke.maker.repairLyrics',
            text: 'help.maker.redetectTiming',
          },
          {
            box: [29, 212, 396, 32],
            name: 'karaoke.maker.repairMelody',
            text: 'help.maker.redetectNotes',
          },
          {
            box: [39, 298, 376, 127],
            name: 'help.maker.modelsName',
            text: 'help.maker.models',
          },
          {
            box: [39, 434, 376, 54],
            name: 'help.maker.idleName',
            text: 'help.maker.idle',
          },
        ],
      },
    ],
  },
  {
    id: 'share',
    group: 'listen',
    figures: [{ image: '14-share-audio-roles.png', ...WINDOW }],
  },
  {
    id: 'trouble',
    group: 'help',
    figures: [{ image: '06-eq-equalizer-apo-config.png', ...WINDOW }],
  },
  {
    id: 'forum',
    group: 'help',
    figures: [{ image: '30-forum.png', width: 2560, height: 1392 }],
  },
] as const satisfies readonly IHelpChapter[];

export default LISTEN_CHAPTERS;
