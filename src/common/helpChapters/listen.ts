/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type IHelpChapter, WINDOW } from './model';

/** Listening, singing and sharing, and where to turn when something is wrong. */
const LISTEN_CHAPTERS = [
  {
    id: 'online',
    group: 'listen',
    figures: [{ image: '01-online-media-youtube-live-eq.png', ...WINDOW }],
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
    figures: [{ image: '11-karaoke-player.png', ...WINDOW }],
  },
  {
    id: 'maker',
    group: 'listen',
    figures: [
      { image: '12-karaoke-maker-pitch-and-lyrics.png', ...WINDOW },
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
            box: [226, 1, 118, 40],
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
        width: 1080,
        height: 720,
        caption: 'help.maker.lyricsCaption',
        controls: [
          {
            box: [19, 114, 402, 529],
            name: 'help.maker.referenceName',
            text: 'help.maker.reference',
          },
          {
            box: [433, 114, 628, 529],
            name: 'help.maker.timingName',
            text: 'help.maker.timing',
          },
          {
            box: [445, 437, 604, 194],
            name: 'help.maker.wordName',
            text: 'help.maker.word',
          },
        ],
      },
      {
        image: '33-karaoke-maker-tools.png',
        width: 430,
        height: 536,
        caption: 'help.maker.toolsCaption',
        controls: [
          {
            box: [17, 40, 396, 32],
            name: 'karaoke.maker.removeBackground',
            text: 'help.maker.separate',
          },
          {
            box: [17, 77, 396, 32],
            name: 'karaoke.maker.vocalStem',
            text: 'help.maker.loadVocals',
          },
          {
            box: [17, 163, 396, 32],
            name: 'karaoke.maker.repairLyrics',
            text: 'help.maker.redetectTiming',
          },
          {
            box: [17, 200, 396, 32],
            name: 'karaoke.maker.repairMelody',
            text: 'help.maker.redetectNotes',
          },
          {
            box: [17, 276, 396, 152],
            name: 'help.maker.modelsName',
            text: 'help.maker.models',
          },
          {
            box: [17, 430, 396, 90],
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
    figures: [{ image: '30-forum.png', width: 2560, height: 1230 }],
  },
] as const satisfies readonly IHelpChapter[];

export default LISTEN_CHAPTERS;
