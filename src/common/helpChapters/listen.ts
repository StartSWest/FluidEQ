/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type IHelpChapter, WINDOW } from './model';

/** Listening, singing and sharing, and where to turn when something is wrong. */
const LISTEN_CHAPTERS = [
  {
    // The page drawn by its own bar and the rail it shares with the Library
    // (`help/live/onlineFigure`), on YouTube with made-up recent searches; a
    // still of a film stands where the site plays, which Help cannot draw.
    // Its still is the 2026-09-29 capture of the window on NASA's channel,
    // for the exported guide.
    id: 'online',
    group: 'listen',
    figures: [
      {
        live: 'online-page',
        width: 1100,
        height: 560,
        still: '01-online-media-youtube-live-eq.png',
        controls: [
          {
            target: '.video-rail__item.is-active',
            name: 'video.railSites',
            text: 'help.online.sites',
          },
          {
            target: '.video-rail__recent:first-child',
            name: 'video.searchRecent',
            text: 'help.online.recent',
          },
          {
            target: '.video-rail__match',
            name: 'video.matchColours',
            text: 'help.online.colours',
          },
          {
            target: '.video-rail__sign-out',
            name: 'video.signOut',
            text: 'help.online.signOut',
          },
          {
            target: '.video-browser__nav',
            name: 'help.online.navName',
            text: 'help.online.nav',
          },
          {
            target: '.video-browser__search',
            name: 'video.searchAria',
            text: 'help.online.search',
          },
        ],
      },
    ],
  },
  {
    // The Library drawn by its own rail, bar, place bar and status line from
    // a made-up collection (`help/live/libraryFigures`, `libraryTagFigure`):
    // the Albums shelf in Grid, then an untagged album in the tag editor as
    // Fix tags leaves it, with what Save would write beside it. The stills
    // are the 2.5 captures, for the exported guide.
    id: 'library',
    group: 'listen',
    figures: [
      {
        live: 'library-page',
        width: 1240,
        height: 660,
        still: '08-library-artists-and-up-next.png',
        controls: [
          {
            target: '.library-rail__item.is-active',
            name: 'help.library.shelvesName',
            text: 'help.library.shelves',
          },
          {
            target: '.library-rail__heading--link',
            name: 'library.browse.playlist',
            text: 'help.library.playlists',
          },
          {
            target: '.library-rail__item--add',
            name: 'library.add',
            text: 'help.library.addFolder',
          },
          {
            target: '.library-top__nav',
            name: 'library.history',
            text: 'help.library.history',
          },
          {
            target: '.library-top__search',
            name: 'library.searchPlaceholder',
            text: 'help.library.search',
          },
          {
            target: '.library-top__views',
            name: 'library.view.aria',
            text: 'help.library.views',
          },
          {
            target: '.library-top__sort',
            name: 'library.sort',
            text: 'help.library.sort',
          },
          {
            target: '.library-up-next__chip',
            name: 'library.upNext',
            text: 'help.library.upNext',
          },
          {
            target: '.library-grid__tile:first-child .library-grid__art',
            name: 'library.kind.album',
            text: 'help.library.album',
          },
          {
            target: '.library-status__scan',
            name: 'library.rescan',
            text: 'help.library.rescan',
          },
        ],
      },
      {
        live: 'library-tags',
        width: 1400,
        height: 980,
        frame: '.library-main',
        caption: 'help.library.tagsCaption',
        still: '08-library-artists-and-up-next.png',
        controls: [
          {
            target: '.library-tags-set__fix',
            name: 'library.tags.set.fixAuto',
            text: 'help.library.fixAuto',
          },
          {
            target: '.library-tags-set__web',
            name: 'library.tags.set.searchWeb',
            text: 'help.library.searchWeb',
          },
          {
            target: '.library-tags__cover-frame',
            name: 'library.tags.cover.change',
            text: 'help.library.cover',
          },
          {
            target: '.library-tags-album__title',
            name: 'library.tags.field.album',
            text: 'help.library.albumFields',
          },
          {
            target: '.library-tags-set__replace',
            name: 'library.tags.set.find',
            text: 'help.library.findReplace',
          },
          {
            target: '.library-tags-files__pick',
            name: 'library.tags.files.title',
            text: 'help.library.fileNames',
          },
          {
            // The first song's row: the row under it is its file's new name.
            target: '.library-tags-sheet tbody tr:first-child',
            name: 'library.tags.set.songs',
            text: 'help.library.sheet',
          },
          {
            target: '.library-tags-set__actions > .button:not(.subtle)',
            name: 'library.tags.save',
            text: 'help.library.save',
          },
        ],
      },
      {
        // The same drawing, its side column: the head of what Save writes,
        // the album's values and the first song's.
        live: 'library-tags-changes',
        width: 1400,
        height: 980,
        frame:
          '.library-tags-panel__head, .library-tags-changes > section:first-child, .library-tags-changes__song:first-of-type',
        margin: 8,
        caption: 'help.library.changesCaption',
        still: '08-library-artists-and-up-next.png',
        controls: [
          {
            target: '.library-tags-panel__head h3',
            name: 'library.tags.changes.title',
            text: 'help.library.changes',
          },
          {
            target: '.library-tags-changes > section:first-child > h4',
            name: 'library.tags.changes.album',
            text: 'help.library.changesAlbum',
          },
          {
            target: '.library-tags-changes__song:first-of-type > b',
            name: 'library.tags.changes.songs',
            text: 'help.library.changesSongs',
          },
        ],
      },
    ],
  },
  {
    // One drawing of the Library with a record open and Up next beside it
    // (`help/live/libraryFigures`), framed twice: the record, then the right
    // pane; and the Lyrics tab twice, its timed words and Find other lyrics
    // (`libraryPaneFigures`). The stills are the 2.5 captures.
    id: 'queue',
    group: 'listen',
    figures: [
      {
        live: 'library-record',
        width: 1440,
        height: 720,
        frame: '.library-main',
        caption: 'help.queue.recordCaption',
        still: '09-library-album-and-play-queue.png',
        controls: [
          {
            target: '.library-place__crumb--shelf',
            name: 'library.place.aria',
            text: 'help.queue.place',
          },
          {
            target: '.library-hero__who .library-artist-link',
            name: 'library.kind.artist',
            text: 'help.queue.artist',
          },
          {
            target: '.library-hero__fix',
            name: 'library.tags.hero.fix',
            text: 'help.queue.fix',
          },
          {
            // The row of five as one: numbered apart, their lines ran down
            // through the songs to circles under the table.
            target: '.library-hero__actions > .library-hero__button',
            name: 'help.queue.actionsName',
            text: 'help.queue.actions',
          },
          {
            target: '.library-hero__sound',
            name: 'library.sound.albumTitle',
            text: 'help.queue.albumSound',
          },
          {
            target: '.library-hero__filter',
            name: 'library.filterHere',
            text: 'help.queue.filter',
          },
          {
            target: '.library-list__row--playing .library-list__col--no',
            name: 'help.queue.songsName',
            text: 'help.queue.songs',
          },
        ],
      },
      {
        live: 'library-queue',
        width: 1440,
        height: 720,
        frame: '.library-side',
        caption: 'help.queue.paneCaption',
        still: '09-library-album-and-play-queue.png',
        controls: [
          {
            target: '.library-now',
            name: 'library.nowPlaying',
            text: 'help.queue.now',
          },
          {
            target: '.library-pane__tabs',
            name: 'library.pane.tabs',
            text: 'help.queue.tabs',
          },
          {
            target: '.library-up-next__keep',
            name: 'library.upNext.keepPlaying',
            text: 'help.queue.keep',
          },
          {
            target:
              '.library-up-next__list > :nth-child(3) .library-up-next__row',
            name: 'help.queue.rowsName',
            text: 'help.queue.rows',
          },
          {
            target: '.library-up-next__section.is-added',
            name: 'library.upNext.added',
            text: 'help.queue.picks',
          },
          {
            target: '.library-up-next__surprise',
            name: 'library.upNext.surprise',
            text: 'help.queue.surprise',
          },
        ],
      },
      {
        live: 'library-lyrics',
        width: 624,
        height: 600,
        caption: 'help.queue.lyricsCaption',
        still: '09-library-album-and-play-queue.png',
        controls: [
          {
            target: '.library-lyrics__line.is-active',
            name: 'library.pane.lyrics',
            text: 'help.queue.lyricsLine',
          },
          {
            target: '.library-lyrics__source-row',
            name: 'help.queue.sourceName',
            text: 'help.queue.source',
          },
          {
            target: '.library-lyrics__karaoke',
            name: 'library.lyrics.karaoke.open',
            text: 'help.queue.karaoke',
          },
          {
            target: '.library-lyrics__other',
            name: 'library.lyrics.other',
            text: 'help.queue.findOther',
          },
          {
            target: '.library-lyrics-finder__sites',
            name: 'library.lyrics.find.heading',
            text: 'help.queue.sites',
          },
          {
            target: '.library-lyrics-finder__actions',
            name: 'library.lyrics.import.heading',
            text: 'help.queue.import',
          },
        ],
      },
    ],
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
    // The page drawn by its own parts (`help/live/shareFigures`) with a
    // made-up group of four, laid out at a laptop window's width, where the
    // group and the mix still stand side by side. Its still is the capture
    // from before the group, one computer linked, the connection code and
    // every network address blurred, for the exported guide.
    figures: [
      {
        live: 'share-page',
        width: 1040,
        height: 830,
        still: '14-share-audio-roles.png',
        controls: [
          {
            target: '.remote-audio__mix',
            name: 'remoteAudio.group.mix',
            text: 'help.share.mix',
          },
          {
            target: '.remote-audio__rail-foot',
            name: 'help.share.outputName',
            text: 'help.share.output',
          },
          {
            target: '.remote-audio__head > .button',
            name: 'remoteAudio.group.add',
            text: 'help.share.add',
          },
          {
            target:
              '.remote-audio__group > .remote-audio__group-row .remote-audio__group-actions',
            name: 'remoteAudio.group.share',
            text: 'help.share.shareSwitch',
          },
          {
            target:
              '.remote-audio__group-list > .remote-audio__group-row:nth-child(3) .remote-audio__group-lanes',
            name: 'help.share.laneName',
            text: 'help.share.lane',
          },
          {
            target:
              '.remote-audio__group-list > .remote-audio__group-row:nth-child(3) .remote-audio__group-actions',
            name: 'help.share.switchesName',
            text: 'help.share.switches',
          },
        ],
      },
    ],
  },
  {
    id: 'trouble',
    group: 'help',
    figures: [{ image: '06-eq-equalizer-apo-config.png', ...WINDOW }],
  },
  {
    id: 'forum',
    group: 'help',
    // The page drawn by its own rail and list (`help/live/forumFigures`)
    // from a made-up forum, on All topics with two topics new; its still is
    // the 2.0 capture of the window, for the exported guide.
    figures: [
      {
        live: 'forum-page',
        width: 1120,
        height: 640,
        still: '30-forum.png',
        controls: [
          {
            target: '.community__channels',
            name: 'help.forum.boardsName',
            text: 'help.forum.boards',
          },
          {
            target: '.forum__rail .reading-size',
            name: 'reading.textSize.label',
            text: 'help.forum.textSize',
          },
          {
            target: '.forum__me',
            name: 'help.forum.meName',
            text: 'help.forum.me',
          },
          {
            target: '.forum__head-actions',
            name: 'forum.newTopic',
            text: 'help.forum.newTopic',
          },
          {
            target: '.forum__search',
            name: 'forum.search.placeholder',
            text: 'help.forum.search',
          },
          {
            target: '.forum__stage',
            name: 'help.forum.topicsName',
            text: 'help.forum.topics',
          },
        ],
      },
    ],
  },
] as const satisfies readonly IHelpChapter[];

export default LISTEN_CHAPTERS;
