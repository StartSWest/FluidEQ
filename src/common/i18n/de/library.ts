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
import { Dictionary } from '../en';

const library: Partial<Dictionary> = {
  'tabs.library': 'Bibliothek',

  'library.empty.title': 'Noch keine Musik',
  'library.empty.body':
    'Füge einen Ordner hinzu, und FluidEQ liest die Songs und Videos darin ein.',
  'library.empty.add': 'Ordner hinzufügen',
  'library.empty.drop': 'oder hier einen Ordner ablegen',
  'library.karaokeSkipped':
    '{count} Karaoke-Songs übersprungen — öffne sie im Karaoke-Tab',

  'library.add': 'Ordner hinzufügen',
  'library.rescan': 'Erneut einlesen',
  'library.rescan.force': 'Neu einlesen erzwingen',
  'library.search': 'Bibliothek durchsuchen',
  'library.searchPlaceholder': 'Songs, Interpreten, Alben durchsuchen',

  'library.browse.album': 'Alben',
  'library.browse.artist': 'Interpreten',
  'library.browse.genre': 'Genres',
  'library.browse.song': 'Songs',
  'library.browse.folder': 'Ordner',
  'library.browse.directory': 'Baum',
  'library.browse.folderHint': 'Jeder Ordner mit Musik, auf einmal',
  'library.browse.directoryHint': 'Vom Stammordner nach innen',
  'library.browse.folderReading': 'Wie Ordner gelesen werden',
  'library.jumpTo': 'Zu einem Buchstaben springen',
  'library.coverflow.previous': 'Vorheriges Cover',
  'library.coverflow.next': 'Nächstes Cover',
  'library.folderCount': '{count} Ordner',
  'library.filterHere': 'Diese Songs filtern',
  'library.view.list': 'Liste',
  'library.view.grid': 'Raster',
  'library.view.coverflow': 'Cover Flow',
  'library.view.aria': 'Wie die Bibliothek angezeigt wird',
  'library.browse.aria': 'Was die Bibliothek gerade zeigt',

  'library.sort': 'Sortieren',
  'library.sortBy': 'Sortieren: {value}',
  'library.sort.direction': 'Sortierrichtung',
  'library.sort.title': 'Titel',
  'library.sort.artist': 'Interpret',
  'library.sort.album': 'Album',
  'library.sort.year': 'Jahr',
  'library.sort.added': 'Zuletzt hinzugefügt',
  'library.sort.track': 'Albumreihenfolge',

  'library.column.title': 'Titel',
  'library.column.artist': 'Interpret',
  'library.column.album': 'Album',
  'library.column.year': 'Jahr',
  'library.column.length': 'Länge',
  'library.column.trackNo': 'Titelnummer',

  'library.unknownAlbum': 'Unbekanntes Album',
  'library.unknownArtist': 'Unbekannter Interpret',
  'library.genre.unknown': 'Unbekanntes Genre',
  'library.trackCount': '{count} Songs',
  'library.albumCount': '{count} Alben',
  'library.artistCount': '{count} Interpreten',

  'library.videos': 'Videos',
  'library.videos.empty': 'Keine Videos in den hinzugefügten Ordnern.',

  'library.scan.running': '{name} wird eingelesen',
  'library.scan.counted': '{parsed} von {seen} Dateien',
  'library.scan.cancel': 'Stopp',
  'library.scan.background': 'Im Hintergrund fortsetzen',
  'library.scan.done': '{count} Songs hinzugefügt',

  'library.roots': 'Ordner',
  'library.root.remove': 'Diesen Ordner entfernen',
  'library.root.offline': 'Dieser Ordner ist gerade nicht verfügbar',
  'library.reveal': 'Im Explorer anzeigen',
  'library.trackMenu': 'Weitere Aktionen',

  'library.unplayable': 'FluidEQ kann dieses Format nicht wiedergeben',
  'library.metadataError': 'FluidEQ konnte die Tags dieser Datei nicht lesen.',
  'library.pending':
    'Diese Datei wurde gefunden, ihre Details werden noch gelesen.',
  'library.indexReset':
    'Der Bibliotheksindex konnte nicht gelesen werden und wurde neu aufgebaut.',

  'library.back': 'Zurück',

  'library.upNext': 'Als Nächstes',
  'library.upNext.empty': 'Noch nichts in der Warteschlange',
  'library.upNext.added': 'Deine Auswahl',
  'library.upNext.rest': 'Danach',
  'library.upNext.continued': 'Mehr in dieser Richtung',
  'library.upNext.keepPlaying': 'Weiterspielen',
  'library.upNext.keepPlayingHint':
    'Wenn die Liste zu Ende ist, mit weiterer Musik desselben Genres fortfahren',
  'library.queueAdd': 'Zur Warteschlange',

  'library.alsoInFolder': 'In diesem Ordner, nicht in diesem Album',
  'library.play': 'Wiedergeben',
  'library.pause': 'Pause',
  'library.stop': 'Stopp',
  'library.previous': 'Vorheriger Titel',
  'library.back5': '5 Sekunden zurück',
  'library.forward5': '5 Sekunden vor',
  'library.next': 'Nächster Titel',
  'library.shuffle': 'Zufallswiedergabe',
  'library.repeat': 'Wiederholen',
  'library.repeat.all': 'Alles wiederholen',
  'library.repeat.one': 'Diesen Song wiederholen',
  'library.repeat.off': 'Nicht wiederholen',
  'library.volume': 'Lautstärke',
  'library.mute': 'Stumm schalten',
  'library.unmute': 'Ton einschalten',
  'library.playbackOptions': 'Wiedergabeoptionen',
  'library.position': 'Position',
  'library.queue': 'Warteschlange',
  'library.queue.remove': 'Aus der Warteschlange entfernen',
  'library.nowPlaying': 'Wird gerade wiedergegeben',
  'library.nothingPlaying': 'Nichts läuft',
  'library.nothingPlayingHint': 'Wähle etwas zum Abspielen',
  'library.systemAudio': 'Systemaudio',
  'library.remoteAudio': 'Remote-Wiedergabe · {name}',

  'library.trackActions': 'Was mit diesem Titel geschehen soll',
  'library.browse.playlist': 'Playlists',
  'library.playlist.favorites': 'Favoriten',
  'library.playlist.addToFavorites': 'Zu Favoriten hinzufügen',
  'library.playlist.removeFromFavorites': 'Aus Favoriten entfernen',
  'library.playlist.favorite': 'In deinen Favoriten',
  'library.playlist.addTo': 'Zu Playlist hinzufügen',
  'library.playlist.alreadyIn': 'Schon in dieser Playlist',
  'library.playlist.removeFrom': 'Aus dieser Playlist entfernen',
  'library.playlist.new': 'Neue Playlist',
  'library.playlist.newName': 'Name der Playlist',
  'library.playlist.create': 'Anlegen',
  'library.playlist.rename': 'Umbenennen',
  'library.playlist.keep': 'Behalten',
  'library.playlist.delete': 'Playlist löschen',
  'library.playlist.deleteConfirm':
    '„{name}“ löschen? Die Titel bleiben in deiner Bibliothek.',
  'library.playlist.builtIn':
    'Favoriten ist immer da und lässt sich nicht entfernen',
  'library.playlist.songCount': '{count} Titel',
  'library.playlist.songCountOne': '1 Titel',
  'library.playlist.empty': 'In dieser Playlist ist noch nichts',
  'library.playlist.emptyHint':
    'Rechtsklick auf einen Titel und „Zu Playlist hinzufügen“ wählen.',
  'library.playlist.missing':
    '{count} Titel dieser Playlist sind derzeit nicht in deiner Bibliothek',
  'library.playlist.reset':
    'Deine Playlists konnten nicht gelesen werden und wurden zurückgesetzt.',
  'library.karaoke.send': 'An Karaoke senden',
  'library.karaoke.sending': 'Wird an Karaoke gesendet…',
  'library.karaoke.failed':
    'Diese Datei konnte nicht an Karaoke gesendet werden — sie ist vielleicht zu groß oder nicht lesbar.',
};

export default library;
