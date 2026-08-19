/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/** The Library tab: local music and video files. */
const library = {
  'tabs.library': 'Library',

  'library.empty.title': 'No music yet',
  'library.empty.body':
    'Add a folder and FluidEQ will read the songs and videos inside it.',
  'library.empty.add': 'Add folder',
  'library.empty.drop': 'or drop a folder here',
  'library.karaokeSkipped':
    '{count} karaoke songs skipped — open them on the Karaoke tab',

  'library.add': 'Add folder',
  'library.rescan': 'Rescan',
  'library.rescan.force': 'Force rescan',
  'library.search': 'Search the library',
  'library.searchPlaceholder': 'Search songs, artists, albums',

  'library.browse.album': 'Albums',
  'library.browse.artist': 'Artists',
  'library.browse.song': 'Songs',
  'library.view.list': 'List',
  'library.view.grid': 'Grid',
  'library.view.coverflow': 'Cover Flow',
  'library.view.aria': 'How the library is shown',
  'library.browse.aria': 'What the library is showing',

  'library.sort': 'Sort',
  'library.sort.title': 'Title',
  'library.sort.artist': 'Artist',
  'library.sort.album': 'Album',
  'library.sort.year': 'Year',
  'library.sort.added': 'Recently added',

  'library.column.title': 'Title',
  'library.column.artist': 'Artist',
  'library.column.album': 'Album',
  'library.column.year': 'Year',
  'library.column.length': 'Length',

  'library.unknownAlbum': 'Unknown album',
  'library.unknownArtist': 'Unknown artist',
  'library.trackCount': '{count} songs',
  'library.albumCount': '{count} albums',

  'library.videos': 'Videos',
  'library.videos.empty': 'No videos in the folders you have added.',

  'library.scan.running': 'Reading {name}',
  'library.scan.counted': '{parsed} of {seen} files',
  'library.scan.cancel': 'Stop',
  'library.scan.background': 'Continue in the background',
  'library.scan.done': 'Added {count} songs',

  'library.roots': 'Folders',
  'library.root.remove': 'Remove this folder',
  'library.root.offline': 'This folder is not available right now',
  'library.reveal': 'Show in Explorer',

  'library.unplayable': 'FluidEQ cannot play this format',
  'library.metadataError': "FluidEQ could not read this file's tags.",
  'library.pending':
    'This file has been found and its details are still being read.',
  'library.indexReset':
    'The library index could not be read and has been rebuilt.',

  'library.back': 'Back',

  'library.alsoInFolder': 'In this folder, not in this album',
  'library.play': 'Play',
  'library.pause': 'Pause',
  'library.stop': 'Stop',
  'library.previous': 'Previous',
  'library.next': 'Next',
  'library.shuffle': 'Shuffle',
  'library.repeat': 'Repeat',
  'library.repeat.all': 'Repeat everything',
  'library.repeat.one': 'Repeat this song',
  'library.repeat.off': 'Do not repeat',
  'library.volume': 'Volume',
  'library.position': 'Position',
  'library.queue': 'Queue',
  'library.queue.remove': 'Remove from the queue',
  'library.nowPlaying': 'Now playing',
  'library.fullScreen': 'Full screen',
} as const;

export default library;
