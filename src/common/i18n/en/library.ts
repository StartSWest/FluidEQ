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
  'library.searchPlaceholder': 'Search songs, artists, albums',

  'library.browse.album': 'Albums',
  'library.browse.artist': 'Artists',
  'library.browse.genre': 'Genres',
  'library.browse.song': 'Songs',
  'library.browse.folder': 'Folders',
  'library.jumpTo': 'Jump to a letter',
  'library.coverflow.previous': 'Previous cover',
  'library.coverflow.next': 'Next cover',
  'library.filterHere': 'Filter these songs',
  'library.view.list': 'Details',
  'library.view.grid': 'Grid',
  'library.view.coverflow': 'Cover Flow',
  'library.rail.library': 'Library',
  'library.rail.allPlaylists': 'All playlists',
  'library.roots.manage': 'Your folders',
  'library.tree.more': '{count} more…',
  'library.history': 'Back and forward',
  'library.forward': 'Forward',
  'library.length.minutes': '{minutes} min',
  'library.length.hours': '{hours} h {minutes} min',
  'library.status.songs': '{count} songs',
  'library.status.songsOne': '{count} song',
  'library.status.albums': '{count} albums',
  'library.status.albumsOne': '{count} album',
  'library.status.videos': '{count} videos',
  'library.status.videosOne': '{count} video',
  'library.status.upToDate': 'Library up to date',
  'library.sort.plays': 'Most played',
  'library.sort.length': 'Length',
  'library.column.genre': 'Genre',
  'library.column.format': 'Format',
  'library.column.plays': 'Plays',
  'library.columns.choose': 'Choose columns',
  'library.kind.album': 'Album',
  'library.kind.artist': 'Artist',
  'library.kind.genre': 'Genre',
  'library.kind.folder': 'Folder',
  'library.kind.folderAlbum': 'Folder · album inside',
  'library.kind.playlist': 'Playlist',
  'library.pane.details': 'Details',
  'library.pane.lyrics': 'Lyrics',
  'library.pane.tabs': 'What the pane shows',
  'library.now.nothing': 'Nothing playing',
  'library.now.nothingHint': 'Pick a song to start',
  'library.facts.nothing': 'Play a song to see its details',
  'library.facts.song': 'Song',
  'library.facts.file': 'File',
  'library.facts.sound': 'Sound',
  'library.facts.location': 'Location',
  'library.facts.track': 'Track',
  'library.facts.disc': 'Disc',
  'library.facts.codec': 'Codec',
  'library.facts.bitrate': 'Bitrate',
  'library.facts.sampleRate': 'Sample rate',
  'library.facts.bitDepth': 'Bit depth',
  'library.facts.channels': 'Channels',
  'library.facts.mono': 'Mono',
  'library.facts.stereo': 'Stereo',
  'library.facts.channelCount': '{count} channels',
  'library.facts.duration': 'Duration',
  'library.facts.size': 'File size',
  'library.facts.loudness': 'Loudness',
  'library.facts.truePeak': 'True peak',
  'library.facts.lossless': 'Lossless',
  'library.facts.lossy': 'Lossy',
  'library.facts.kbps': '{value} kbps',
  'library.facts.khz': '{value} kHz',
  'library.facts.bits': '{value}-bit',
  'library.facts.mb': '{value} MB',
  'library.facts.lufs': '{value} LUFS',
  'library.facts.dbtp': '{value} dBTP',
  'library.facts.readFailed': 'FluidEQ could not read this file’s details.',
  'library.lyrics.nothing': 'Play a song to see its lyrics',
  'library.lyrics.none': 'No lyrics in this song',
  'library.lyrics.looked':
    'FluidEQ looked in the song’s own tags and for a .lrc or .txt file with the same name beside it.',
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
  'library.sort.name': 'Name',
  'library.sort.count': 'Most tracks',

  'library.column.title': 'Title',
  'library.column.artist': 'Artist',
  'library.column.album': 'Album',
  'library.column.year': 'Year',
  'library.column.length': 'Time',
  'library.column.trackNo': 'Track number',

  'library.unknownAlbum': 'Unknown album',
  'library.unknownArtist': 'Unknown artist',
  'library.genre.unknown': 'Unknown genre',
  'library.trackCount': '{count} songs',
  'library.albumCount': '{count} albums',
  'library.artistCount': '{count} artists',

  'library.videos': 'Videos',
  'library.videos.empty': 'No videos in the folders you have added.',

  'library.scan.running': 'Reading {name}',
  'library.scan.counted': '{parsed} of {seen} files',
  'library.scan.cancel': 'Stop',
  'library.scan.hide': 'Hide this notice',
  'library.scan.hideHint':
    'Hide this notice. The Library keeps reading your files.',
  'library.scan.chip': 'Scanning {percent}%',
  'library.scan.chipFinding': 'Scanning…',
  'library.scan.show': 'Show the scan again, with Stop',

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
  'library.place.aria': 'Where you are in the library',
  'library.place.allHint': 'Leave this folder and show your whole library',
  'library.search.near': 'In {folder}',
  'library.search.nearEmpty': 'Nothing in {folder}',
  'library.search.elsewhere': 'Everywhere else',

  'library.upNext': 'Up next',
  'library.upNext.empty': 'Nothing queued yet',
  'library.upNext.added': 'Your picks',
  'library.upNext.rest': 'Then',
  'library.upNext.continued': 'More like this',
  'library.upNext.keepPlaying': 'Keep playing',
  'library.upNext.keepPlayingHint':
    'When the list runs out, keep going with more of the same genre, then a surprise when none is left',
  'library.upNext.surprise': 'Surprise me',
  'library.upNext.surpriseHint':
    'Play a random song from your library, then more of its style',
  'library.upNext.surpriseStart':
    'A random song from your library, then more of its style.',
  'library.upNext.surpriseNext':
    'When this song ends, Surprise me picks the next one.',
  'library.upNext.surpriseNothing':
    'Nothing in your library can be played right now.',
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
  'library.repeat.all': 'Repeat everything',
  'library.repeat.one': 'Repeat this song',
  'library.repeat.off': 'Do not repeat',
  'library.volume': 'Volume',
  'library.mute': 'Mute',
  'library.unmute': 'Unmute',
  'library.playbackOptions': 'Playback options',
  'library.position': 'Position',
  'library.queue.remove': 'Remove from the queue',
  'library.nowPlaying': 'Now playing',
  'library.nothingPlaying': 'Nothing playing',
  'library.nothingPlayingHint': 'Pick something to play',
  'library.systemAudio': 'System audio',
  'library.remoteAudio': 'Playing remote · {name}',
  'library.remoteAudioDelay': 'Playing remote · {name} · {milliseconds} ms',

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
  'library.drop.empty': 'No music in what you dropped',
  'library.drop.already': 'Everything you dropped is already in Up next',
  'library.drop.failed': 'The music you dropped could not be added',
} as const;

export default library;
