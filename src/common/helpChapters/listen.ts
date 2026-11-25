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
    // The page drawn by its own parts (`help/live/karaokeFigures`), singing
    // a made-up song a third of the way in with the microphone on; the
    // stage and the song list are framed out of one drawing, and the mix
    // menu, the microphone's panel and the summary at a song's end are
    // drawn apart (`karaokePanelFigures`). Their still is the 2.5 capture,
    // on FluidEQ's own song, for the exported guide.
    figures: [
      {
        live: 'karaoke-stage',
        width: 1000,
        height: 640,
        frame: '.karaoke-workspace__stage',
        still: '11-karaoke-player.png',
        caption: 'help.karaoke.stageCaption',
        controls: [
          {
            target: '.karaoke-stage-bar__switch:not(:has(> :nth-child(3)))',
            name: 'karaoke.stage.show',
            text: 'help.karaoke.guides',
          },
          {
            target: '.karaoke-stage-bar__switch:has(> :nth-child(4))',
            name: 'karaoke.stage.background',
            text: 'help.karaoke.background',
          },
          {
            target: '.karaoke-stage-bar__maker',
            name: 'karaoke.maker.openIn',
            text: 'help.karaoke.maker',
          },
          {
            target: '.view-bar__icon:has(.karaoke-stage-bar__glyph)',
            name: 'karaoke.lyrics.textSize',
            text: 'help.karaoke.textSize',
          },
          {
            target: '.view-bar__icon.is-live',
            name: 'karaoke.mic.settings',
            text: 'help.karaoke.micSettings',
          },
          {
            target: '.view-bar__toggles',
            name: 'karaoke.fullscreen.enter',
            text: 'help.karaoke.fullScreen',
          },
          {
            target: '.karaoke-chords > :first-child',
            name: 'karaoke.stage.chords',
            text: 'help.karaoke.chords',
          },
          {
            target: '.karaoke-pitch canvas',
            name: 'karaoke.pitch.title',
            text: 'help.karaoke.pitch',
          },
          {
            target: '.karaoke-pitch__mic',
            name: 'karaoke.mic.turnOn',
            text: 'help.karaoke.micToggle',
          },
          {
            target: '.karaoke-score',
            name: 'karaoke.score.title',
            text: 'help.karaoke.score',
          },
        ],
      },
      {
        live: 'karaoke-playlist',
        width: 1000,
        height: 640,
        frame: '.karaoke-playlist__heading, .karaoke-playlist__tree',
        margin: 12,
        still: '11-karaoke-player.png',
        caption: 'help.karaoke.playlistCaption',
        controls: [
          {
            target: '.karaoke-playlist__heading > button:nth-of-type(1)',
            name: 'karaoke.playlist.search',
            text: 'help.karaoke.search',
          },
          {
            target: '.karaoke-playlist__add > .karaoke-playlist__tool',
            name: 'karaoke.playlist.add',
            text: 'help.karaoke.add',
          },
          {
            target: '.karaoke-playlist__heading > button:nth-of-type(2)',
            name: 'karaoke.playlist.collapse',
            text: 'help.karaoke.fold',
          },
          {
            target: '.karaoke-playlist__item.is-selected',
            name: 'help.karaoke.singingName',
            text: 'help.karaoke.singing',
          },
          {
            target:
              '.karaoke-playlist__tree > .karaoke-playlist__tree-node:nth-child(2) > .karaoke-playlist__folder',
            name: 'help.karaoke.folderName',
            text: 'help.karaoke.folder',
          },
        ],
      },
      {
        live: 'karaoke-mix',
        width: 480,
        height: 520,
        frame: '.karaoke-transport__mix-popover',
        still: '11-karaoke-player.png',
        caption: 'help.karaoke.mixCaption',
        controls: [
          {
            target: '.karaoke-transport__volume:not([data-channel])',
            name: 'library.volume',
            text: 'help.karaoke.volume',
          },
          {
            target: '.karaoke-transport__volume[data-channel="melody"]',
            name: 'karaoke.pitch.toneVolume',
            text: 'help.karaoke.melody',
          },
          {
            target: '.karaoke-transport__volume[data-channel="backing"]',
            name: 'karaoke.maker.stemBacking',
            text: 'help.karaoke.backing',
          },
          {
            target: '.karaoke-transport__volume[data-channel="vocal"]',
            name: 'karaoke.transport.vocalLevel',
            text: 'help.karaoke.vocal',
          },
          {
            target: '.karaoke-transport__mix-popover > [role="group"]',
            name: 'karaoke.stage.scene',
            text: 'help.karaoke.scene',
          },
        ],
      },
      {
        live: 'karaoke-mic',
        width: 420,
        height: 300,
        frame: '.karaoke-microphone-popover',
        still: '11-karaoke-player.png',
        caption: 'help.karaoke.micCaption',
        controls: [
          {
            target: '.karaoke-microphone__controls > :first-child',
            name: 'karaoke.mic.select',
            text: 'help.karaoke.micInput',
          },
          {
            target: '.karaoke-microphone__toggle',
            name: 'karaoke.mic.turnOn',
            text: 'help.karaoke.micOn',
          },
          {
            target: '.karaoke-microphone__meter',
            name: 'karaoke.mic.level',
            text: 'help.karaoke.micLevel',
          },
          {
            target: '#karaoke-microphone-gain',
            name: 'karaoke.mic.volume',
            text: 'help.karaoke.micVolume',
          },
        ],
      },
      {
        live: 'karaoke-score',
        width: 1000,
        height: 720,
        still: '11-karaoke-player.png',
        caption: 'help.karaoke.scoreCaption',
        controls: [
          {
            target: '.karaoke-score-card__big > :first-child',
            name: 'karaoke.score.recapTitle',
            text: 'help.karaoke.total',
          },
          {
            target: '.karaoke-score-card__stats',
            name: 'help.karaoke.statsName',
            text: 'help.karaoke.stats',
          },
          {
            target:
              '.karaoke-score-card__pane:first-child .karaoke-score-card__block',
            name: 'karaoke.score.hardestTitle',
            text: 'help.karaoke.hardest',
          },
          {
            target: '.karaoke-score-card__actions > .button:not(.subtle)',
            name: 'karaoke.score.practisePassage',
            text: 'help.karaoke.practise',
          },
          {
            target: '.karaoke-score-card__actions > .button.subtle',
            name: 'karaoke.score.singAgain',
            text: 'help.karaoke.again',
          },
          {
            target: '.karaoke-score-card__lines',
            name: 'karaoke.score.mapTitle',
            text: 'help.karaoke.map',
          },
          {
            target: '.karaoke-score-card__history',
            name: 'karaoke.score.historyTitle',
            text: 'help.karaoke.attempts',
          },
        ],
      },
    ],
  },
  {
    id: 'maker',
    group: 'listen',
    // The editor drawn by the Maker's own parts (`help/live/makerFigures`)
    // on the made-up song the Karaoke chapter sings, its tools framed out of
    // the same drawing; the lyrics dialog and the Repair tools drawn apart
    // (`makerPanelFigures`). The stills are the 2.5 captures, for the
    // exported guide.
    figures: [
      {
        live: 'maker-editor',
        width: 1000,
        height: 760,
        still: '12-karaoke-maker-pitch-and-lyrics.png',
        caption: 'help.maker.editorCaption',
        controls: [
          {
            target: '.karaoke-maker__canvas',
            name: 'help.maker.gridName',
            text: 'help.maker.grid',
          },
          {
            target: '.karaoke-maker-pitch',
            name: 'karaoke.maker.pitchRange',
            text: 'help.maker.pitchRange',
          },
          {
            target: '.karaoke-maker-nav__overview',
            name: 'karaoke.maker.songPosition',
            text: 'help.maker.overview',
          },
          {
            target: '.karaoke-maker-nav__follow',
            name: 'karaoke.lyrics.follow',
            text: 'help.maker.follow',
          },
          {
            target: '.karaoke-maker-preview__stage',
            name: 'karaoke.maker.livePreview',
            text: 'help.maker.preview',
          },
          {
            target: '.karaoke-maker__word-state-legend',
            name: 'karaoke.maker.wordStateLegend',
            text: 'help.maker.checked',
          },
        ],
      },
      {
        live: 'maker-bar',
        width: 1000,
        height: 120,
        frame: '.karaoke-maker__header',
        still: '35-karaoke-maker-toolbar.png',
        caption: 'help.makerBar.caption',
        controls: [
          {
            target:
              '.karaoke-maker__tools > .karaoke-maker__tool-group:first-child > :nth-child(1)',
            name: 'karaoke.maker.openProject',
            text: 'help.makerBar.import',
          },
          {
            target:
              '.karaoke-maker__tools > .karaoke-maker__tool-group:first-child > :nth-child(2)',
            name: 'karaoke.maker.lyrics',
            text: 'help.makerBar.lyrics',
          },
          {
            target:
              '.karaoke-maker__tools > .karaoke-maker__tool-group:first-child > .karaoke-maker__tool-cluster',
            name: 'karaoke.maker.lyricsTiming',
            text: 'help.makerBar.timing',
          },
          {
            target: '.karaoke-maker__translation-group > :first-child',
            name: 'karaoke.translation.picker',
            text: 'help.makerBar.language',
          },
          {
            target: '.karaoke-maker__wide-edit-tools > :nth-child(1)',
            name: 'karaoke.maker.recordLines',
            text: 'help.makerBar.record',
          },
          {
            target: '.karaoke-maker__wide-edit-tools > :nth-child(2)',
            name: 'karaoke.maker.selectNotes',
            text: 'help.makerBar.select',
          },
          {
            target: '.karaoke-maker__wide-edit-tools > :nth-child(3)',
            name: 'karaoke.maker.paintNotes',
            text: 'help.makerBar.paint',
          },
          {
            target:
              '.karaoke-maker__wide-analysis-tools .karaoke-maker__tool-button',
            name: 'karaoke.maker.advanced',
            text: 'help.makerBar.repair',
          },
          {
            target: '.karaoke-maker__export-wrap > .karaoke-maker__tool-button',
            name: 'karaoke.maker.export',
            text: 'help.makerBar.export',
          },
          {
            target: '.karaoke-maker__header-action.is-primary',
            name: 'karaoke.maker.apply',
            text: 'help.makerBar.apply',
          },
        ],
      },
      {
        live: 'maker-lyrics',
        width: 1280,
        height: 820,
        still: '34-karaoke-maker-lyrics.png',
        caption: 'help.maker.lyricsCaption',
        controls: [
          {
            target: '.karaoke-maker__lyrics-source',
            name: 'karaoke.maker.referenceLyrics',
            text: 'help.maker.reference',
          },
          {
            target: '.karaoke-maker__lyrics-token-preview',
            name: 'karaoke.maker.wordTiming',
            text: 'help.maker.timing',
          },
          {
            target: '.karaoke-maker__lyrics-word-editor',
            name: 'karaoke.maker.lyricsSelectedWord',
            text: 'help.maker.word',
          },
        ],
      },
      {
        live: 'maker-tools',
        width: 520,
        height: 560,
        frame: '.karaoke-maker__analysis-popover',
        still: '33-karaoke-maker-tools.png',
        caption: 'help.maker.toolsCaption',
        controls: [
          {
            target:
              '.karaoke-maker__tool-group-titled:first-child .karaoke-maker__tool-button:nth-child(1)',
            name: 'karaoke.maker.removeBackground',
            text: 'help.maker.separate',
          },
          {
            target:
              '.karaoke-maker__tool-group-titled:first-child .karaoke-maker__tool-button:nth-child(2)',
            name: 'karaoke.maker.vocalStem',
            text: 'help.maker.loadVocals',
          },
          {
            target:
              '.karaoke-maker__tool-group-titled:nth-child(2) .karaoke-maker__tool-button:nth-child(1)',
            name: 'karaoke.maker.repairLyrics',
            text: 'help.maker.redetectTiming',
          },
          {
            target:
              '.karaoke-maker__tool-group-titled:nth-child(2) .karaoke-maker__tool-button:nth-child(2)',
            name: 'karaoke.maker.repairMelody',
            text: 'help.maker.redetectNotes',
          },
          {
            target: '.karaoke-maker__memory-models',
            name: 'karaoke.maker.speechMemory',
            text: 'help.maker.models',
          },
          {
            target: '.karaoke-maker__memory-options',
            name: 'karaoke.maker.memoryAfterUse',
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
