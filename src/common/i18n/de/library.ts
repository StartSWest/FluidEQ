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
    'Fügen Sie einen Ordner hinzu, und FluidEQ liest die Songs und Videos darin ein.',
  'library.empty.add': 'Ordner hinzufügen',
  'library.empty.drop': 'oder hier einen Ordner ablegen',
  'library.empty.feature.sound': 'Jeder Song läuft durch Ihren EQ und DSP',
  'library.empty.feature.lyrics': 'Liedtexte, die Wort für Wort aufleuchten',
  'library.empty.feature.browse':
    'Alben, Cover Flow, Als Nächstes und Überraschen lassen',
  'library.karaokeSkipped':
    '{count} Karaoke-Songs übersprungen — öffnen Sie sie im Karaoke-Tab',

  'library.add': 'Ordner hinzufügen',
  'library.rescan': 'Erneut einlesen',
  'library.rescan.force': 'Neu einlesen erzwingen',
  'library.searchPlaceholder': 'Songs, Interpreten, Alben durchsuchen',

  'library.browse.album': 'Alben',
  'library.browse.artist': 'Interpreten',
  'library.browse.genre': 'Genres',
  'library.browse.song': 'Songs',
  'library.browse.folder': 'Ordner',
  'library.jumpTo': 'Zu einem Buchstaben springen',
  'library.coverflow.previous': 'Vorheriges Cover',
  'library.coverflow.next': 'Nächstes Cover',
  'library.filterHere': 'Diese Songs filtern',
  'library.view.list': 'Details',
  'library.view.grid': 'Raster',
  'library.view.coverflow': 'Cover Flow',
  'library.rail.library': 'Bibliothek',
  'library.rail.allPlaylists': 'Alle Playlists',
  'library.roots.manage': 'Ihre Ordner',
  'library.tree.more': '{count} weitere…',
  'library.history': 'Zurück und vor',
  'library.forward': 'Vor',
  'library.length.minutes': '{minutes} Min.',
  'library.length.hours': '{hours} Std. {minutes} Min.',
  'library.status.songs': '{count} Titel',
  'library.status.songsOne': '{count} Titel',
  'library.status.albums': '{count} Alben',
  'library.status.albumsOne': '{count} Album',
  'library.status.videos': '{count} Videos',
  'library.status.videosOne': '{count} Video',
  'library.status.upToDate': 'Bibliothek ist aktuell',
  'library.sort.plays': 'Meistgespielt',
  'library.sort.length': 'Länge',
  'library.column.genre': 'Genre',
  'library.column.format': 'Format',
  'library.column.plays': 'Wiedergaben',
  'library.columns.choose': 'Spalten wählen',
  'library.kind.album': 'Album',
  'library.kind.artist': 'Interpret',
  'library.kind.genre': 'Genre',
  'library.kind.folder': 'Ordner',
  'library.kind.folderAlbum': 'Ordner · Album darin',
  'library.kind.playlist': 'Playlist',
  'library.pane.details': 'Details',
  'library.pane.lyrics': 'Songtext',
  'library.pane.tabs': 'Was der Bereich zeigt',
  'library.now.nothing': 'Es läuft nichts',
  'library.now.nothingHint': 'Wählen Sie einen Titel',
  'library.facts.nothing':
    'Spielen Sie einen Titel ab, um seine Details zu sehen',
  'library.facts.song': 'Titel',
  'library.facts.file': 'Datei',
  'library.facts.sound': 'Klang',
  'library.facts.location': 'Speicherort',
  'library.facts.track': 'Titelnummer',
  'library.facts.disc': 'Disc',
  'library.facts.codec': 'Codec',
  'library.facts.bitrate': 'Bitrate',
  'library.facts.sampleRate': 'Abtastrate',
  'library.facts.bitDepth': 'Bittiefe',
  'library.facts.channels': 'Kanäle',
  'library.facts.mono': 'Mono',
  'library.facts.stereo': 'Stereo',
  'library.facts.channelCount': '{count} Kanäle',
  'library.facts.duration': 'Dauer',
  'library.facts.size': 'Dateigröße',
  'library.facts.loudness': 'Lautheit',
  'library.facts.truePeak': 'True Peak',
  'library.facts.lossless': 'Verlustfrei',
  'library.facts.lossy': 'Verlustbehaftet',
  'library.facts.kbps': '{value} kbit/s',
  'library.facts.khz': '{value} kHz',
  'library.facts.bits': '{value} Bit',
  'library.facts.mb': '{value} MB',
  'library.facts.lufs': '{value} LUFS',
  'library.facts.dbtp': '{value} dBTP',
  'library.facts.readFailed':
    'FluidEQ konnte die Details dieser Datei nicht lesen.',
  'library.lyrics.nothing':
    'Spielen Sie einen Titel ab, um seinen Text zu sehen',
  'library.lyrics.none': 'Kein Songtext in diesem Titel',
  'library.lyrics.looked':
    'FluidEQ hat in den Tags des Titels gesucht und nach einer .lrc- oder .txt-Datei mit demselben Namen daneben.',
  'library.lyrics.fromTags': 'Aus den Tags des Titels',
  'library.lyrics.fromFile': 'Aus {name}',
  'library.lyrics.reading': 'Songtext wird gesucht…',
  'library.lyrics.follow': 'Zurück zur aktuellen Zeile',
  'library.lyrics.listLabel':
    'Songtext. Klicken Sie auf eine Zeile, um ab dort abzuspielen.',
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
  'library.sort.name': 'Name',
  'library.sort.count': 'Meiste Titel',

  'library.column.title': 'Titel',
  'library.column.artist': 'Interpret',
  'library.column.album': 'Album',
  'library.column.year': 'Jahr',
  'library.column.length': 'Zeit',
  'library.column.trackNo': 'Titelnummer',

  'library.unknownAlbum': 'Unbekanntes Album',
  'library.unknownArtist': 'Unbekannter Interpret',
  'library.genre.unknown': 'Unbekanntes Genre',
  'library.trackCount': '{count} Songs',
  'library.albumCount': '{count} Alben',
  'library.artistCount': '{count} Interpreten',
  'library.trackCountOne': '1 Song',
  'library.albumCountOne': '1 Album',
  'library.artistCountOne': '1 Interpret',

  'library.videos': 'Videos',
  'library.videos.empty': 'Keine Videos in den hinzugefügten Ordnern.',

  'library.scan.running': '{name} wird eingelesen',
  'library.scan.counted': '{parsed} von {seen} Dateien',
  'library.scan.cancel': 'Stopp',
  'library.scan.hide': 'Hinweis ausblenden',
  'library.scan.hideHint':
    'Hinweis ausblenden. Die Bibliothek liest Ihre Dateien weiter ein.',
  'library.scan.chip': 'Einlesen {percent} %',
  'library.scan.chipFinding': 'Einlesen…',
  'library.scan.show': 'Fortschritt und Stopp wieder anzeigen',

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
  'library.place.aria': 'Ihr Ort in der Bibliothek',
  'library.place.allHint':
    'Diesen Ordner verlassen und die ganze Bibliothek zeigen',
  'library.search.near': 'In {folder}',
  'library.search.nearEmpty': 'Nichts in {folder}',
  'library.search.elsewhere': 'Überall sonst',

  'library.upNext': 'Als Nächstes',
  'library.upNext.empty': 'Noch nichts in der Warteschlange',
  'library.upNext.added': 'Ihre Auswahl',
  'library.upNext.rest': 'Danach',
  'library.upNext.continued': 'Mehr in dieser Richtung',
  'library.upNext.keepPlaying': 'Weiterspielen',
  'library.upNext.keepPlayingHint':
    'Wenn die Liste zu Ende ist, mit weiterer Musik desselben Genres fortfahren und danach mit einer Überraschung',
  'library.upNext.surprise': 'Überraschen lassen',
  'library.upNext.surpriseHint':
    'Einen zufälligen Song aus Ihrer Bibliothek abspielen, danach mehr in dieser Richtung',
  'library.upNext.surpriseStart':
    'Ein zufälliger Song aus Ihrer Bibliothek, danach mehr in dieser Richtung.',
  'library.upNext.surpriseNext':
    'Wenn dieser Song endet, wählt „Überraschen lassen“ den nächsten.',
  'library.upNext.surpriseNothing':
    'In Ihrer Bibliothek lässt sich gerade nichts abspielen.',
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
  'library.repeat.all': 'Alles wiederholen',
  'library.repeat.one': 'Diesen Song wiederholen',
  'library.repeat.off': 'Nicht wiederholen',
  'library.volume': 'Lautstärke',
  'library.mute': 'Stumm schalten',
  'library.unmute': 'Ton einschalten',
  'library.playbackOptions': 'Wiedergabeoptionen',
  'library.position': 'Position',
  'library.queue.remove': 'Aus der Warteschlange entfernen',
  'library.nowPlaying': 'Wird gerade wiedergegeben',
  'library.nothingPlaying': 'Nichts läuft',
  'library.nothingPlayingHint': 'Wählen Sie etwas zum Abspielen',
  'library.systemAudio': 'Systemaudio',
  'library.remoteAudio': 'Remote-Wiedergabe · {name}',
  'library.remoteAudioDelay': 'Remote-Wiedergabe · {name} · {milliseconds} ms',

  'library.trackActions': 'Was mit diesem Titel geschehen soll',
  'library.browse.playlist': 'Playlists',
  'library.playlist.favorites': 'Favoriten',
  'library.playlist.addToFavorites': 'Zu Favoriten hinzufügen',
  'library.playlist.removeFromFavorites': 'Aus Favoriten entfernen',
  'library.playlist.favorite': 'In Ihren Favoriten',
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
    '„{name}“ löschen? Die Titel bleiben in Ihrer Bibliothek.',
  'library.playlist.builtIn':
    'Favoriten ist immer da und lässt sich nicht entfernen',
  'library.playlist.songCount': '{count} Titel',
  'library.playlist.songCountOne': '1 Titel',
  'library.playlist.empty': 'In dieser Playlist ist noch nichts',
  'library.playlist.emptyHint':
    'Rechtsklick auf einen Titel und „Zu Playlist hinzufügen“ wählen.',
  'library.playlist.missing':
    '{count} Titel dieser Playlist sind derzeit nicht in Ihrer Bibliothek',
  'library.playlist.reset':
    'Ihre Playlists konnten nicht gelesen werden und wurden zurückgesetzt.',
  'library.karaoke.send': 'An Karaoke senden',
  'library.karaoke.sending': 'Wird an Karaoke gesendet…',
  'library.karaoke.failed':
    'Diese Datei konnte nicht an Karaoke gesendet werden — sie ist vielleicht zu groß oder nicht lesbar.',
  'library.drop.empty': 'In dem, was Sie abgelegt haben, ist keine Musik',
  'library.drop.already':
    'Alles, was Sie abgelegt haben, steht schon in „Als Nächstes“',
  'library.drop.failed': 'Die abgelegte Musik konnte nicht hinzugefügt werden',
};

export default library;
