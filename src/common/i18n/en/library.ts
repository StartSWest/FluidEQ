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
  'library.browse.folder': 'Folders',
  'library.browse.directory': 'Tree',
  'library.browse.folderHint': 'Every folder with music, all at once',
  'library.browse.directoryHint': 'From the root folder inwards',
  'library.browse.folderReading': 'How folders are read',
  'library.jumpTo': 'Jump to a letter',
  'library.coverflow.previous': 'Previous cover',
  'library.coverflow.next': 'Next cover',
  'library.folderCount': '{count} folders',
  'library.filterHere': 'Filter these songs',
  'library.view.list': 'List',
  'library.view.grid': 'Grid',
  'library.view.coverflow': 'Cover Flow',
  'library.view.aria': 'How the library is shown',
  'library.browse.aria': 'What the library is showing',

  'library.sort': 'Sort',
  'library.sortBy': 'Sort: {value}',
  'library.sort.direction': 'Sort direction',
  'library.sort.title': 'Title',
  'library.sort.artist': 'Artist',
  'library.sort.album': 'Album',
  'library.sort.year': 'Year',
  'library.sort.added': 'Recently added',
  'library.sort.track': 'Track order',

  'library.column.title': 'Title',
  'library.column.artist': 'Artist',
  'library.column.album': 'Album',
  'library.column.year': 'Year',
  'library.column.length': 'Length',
  'library.column.trackNo': 'Track number',

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
  'library.trackMenu': 'More actions',

  'library.unplayable': 'FluidEQ cannot play this format',
  'library.metadataError': "FluidEQ could not read this file's tags.",
  'library.pending':
    'This file has been found and its details are still being read.',
  'library.indexReset':
    'The library index could not be read and has been rebuilt.',

  'library.back': 'Back',

  'library.upNext': 'Up next',
  'library.upNext.empty': 'Nothing queued yet',
  'library.upNext.added': 'Your picks',
  'library.upNext.rest': 'Then',
  'library.queueAdd': 'Add to up next',

  'library.alsoInFolder': 'In this folder, not in this album',
  'library.play': 'Play',
  'library.pause': 'Pause',
  'library.stop': 'Stop',
  'library.previous': 'Previous',
  'library.back5': 'Back 5 seconds',
  'library.forward5': 'Forward 5 seconds',
  'library.next': 'Next',
  'library.shuffle': 'Shuffle',
  'library.repeat': 'Repeat',
  'library.repeat.all': 'Repeat everything',
  'library.repeat.one': 'Repeat this song',
  'library.repeat.off': 'Do not repeat',
  'library.volume': 'Volume',
  'library.mute': 'Mute',
  'library.unmute': 'Unmute',
  'library.playbackOptions': 'Playback options',
  'library.position': 'Position',
  'library.queue': 'Queue',
  'library.queue.remove': 'Remove from the queue',
  'library.nowPlaying': 'Now playing',
  'library.nothingPlaying': 'Nothing playing',
  'library.nothingPlayingHint': 'Pick something to play',
  'library.systemAudio': 'System audio',
  'library.fullScreen': 'Full screen',

  'library.trackActions': 'What to do with this song',
  'library.browse.playlist': 'Playlists',
  'library.playlist.favorites': 'Favourites',
  'library.playlist.addToFavorites': 'Add to Favourites',
  'library.playlist.removeFromFavorites': 'Remove from Favourites',
  'library.playlist.favorite': 'In your Favourites',
  'library.playlist.addTo': 'Add to playlist',
  'library.playlist.alreadyIn': 'Already in this playlist',
  'library.playlist.removeFrom': 'Remove from this playlist',
  'library.playlist.new': 'New playlist',
  'library.playlist.newName': 'Playlist name',
  'library.playlist.create': 'Create',
  'library.playlist.rename': 'Rename',
  'library.playlist.keep': 'Keep it',
  'library.playlist.delete': 'Delete playlist',
  'library.playlist.deleteConfirm':
    'Delete “{name}”? The songs stay in your library.',
  'library.playlist.builtIn': 'Favourites is always here and cannot be removed',
  'library.playlist.songCount': '{count} songs',
  'library.playlist.songCountOne': '1 song',
  'library.playlist.empty': 'Nothing in this playlist yet',
  'library.playlist.emptyHint':
    'Right-click a song and choose “Add to playlist”.',
  'library.playlist.missing':
    '{count} songs in this playlist are not in your library right now',
  'library.playlist.reset':
    'Your playlists could not be read and have been reset.',
  'library.karaoke.send': 'Send to Karaoke',
  'library.karaoke.sending': 'Sending to Karaoke…',
  'library.karaoke.failed':
    'This file could not be sent to Karaoke — it may be too large or unreadable.',
} as const;

export default library;
