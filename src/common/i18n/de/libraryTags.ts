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

/** The Library's tag editor. See `../en/libraryTags.ts`. */
const libraryTags = {
  'library.tags.menu.edit': 'Tags bearbeiten…',
  'library.tags.menu.editMany': 'Tags von {count} Songs bearbeiten…',
  'library.tags.menu.editAlbum': 'Album-Tags bearbeiten…',
  'library.tags.menu.cover': 'Cover ändern…',
  'library.tags.menu.shortcut': 'Strg+I',
  'library.tags.selection.count': '{count} Songs',
  'library.tags.selection.edit': 'Tags bearbeiten',
  'library.tags.selection.clear': 'Auswahl aufheben',

  'library.tags.field.title': 'Titel',
  'library.tags.field.artist': 'Interpret',
  'library.tags.field.composer': 'Komponist',
  'library.tags.field.album': 'Album',
  'library.tags.field.albumArtist': 'Albuminterpret',
  'library.tags.field.trackNo': 'Titelnr.',
  'library.tags.field.trackTotal': 'Titel gesamt',
  'library.tags.field.discNo': 'CD',
  'library.tags.field.discTotal': 'CDs gesamt',
  'library.tags.field.year': 'Jahr',
  'library.tags.field.genre': 'Genre',
  'library.tags.field.bpm': 'BPM',
  'library.tags.field.comment': 'Kommentar',
  'library.tags.field.grouping': 'Gruppierung',
  'library.tags.field.publisher': 'Label',
  'library.tags.field.copyright': 'Copyright',
  'library.tags.field.isrc': 'ISRC',
  'library.tags.field.conductor': 'Dirigent',
  'library.tags.field.subtitle': 'Untertitel',
  'library.tags.field.remixer': 'Remix von',
  'library.tags.field.initialKey': 'Tonart',
  'library.tags.field.compilation': 'Compilation',
  'library.tags.field.titleSort': 'Sortiertitel',
  'library.tags.field.artistSort': 'Sortierinterpret',
  'library.tags.field.albumSort': 'Sortieralbum',
  'library.tags.field.albumArtistSort': 'Sortier-Albuminterpret',
  'library.tags.field.composerSort': 'Sortierkomponist',
  'library.tags.field.musicBrainzTrackId': 'MusicBrainz-Aufnahme',
  'library.tags.field.musicBrainzReleaseId': 'MusicBrainz-Veröffentlichung',
  'library.tags.field.musicBrainzArtistId': 'MusicBrainz-Interpret',
  'library.tags.field.musicBrainzReleaseArtistId': 'MusicBrainz-Albuminterpret',
  'library.tags.field.musicBrainzReleaseGroupId':
    'MusicBrainz-Veröffentlichungsgruppe',

  'library.tags.panel.title': 'Tags bearbeiten',
  'library.tags.panel.position': '{index} von {count}',
  'library.tags.panel.previous': 'Vorheriger Song (Alt+↑)',
  'library.tags.panel.next': 'Nächster Song (Alt+↓)',
  'library.tags.panel.close': 'Schließen (Esc): Änderungen bleiben',
  'library.tags.panel.reading': 'Tags der Datei werden gelesen…',
  'library.tags.panel.readFailed':
    'Die Tags dieser Datei konnten nicht gelesen werden. Sie ist vielleicht beschädigt oder in Gebrauch.',
  'library.tags.panel.missing':
    'Dieser Song ist nicht mehr auf dem Datenträger.',
  'library.tags.panel.unsupported':
    'FluidEQ bearbeitet die Tags dieses Dateityps nicht.',
  'library.tags.group.song': 'Song',
  'library.tags.group.album': 'Album',
  'library.tags.group.details': 'Details',
  'library.tags.group.file': 'Datei',
  'library.tags.of': 'von',
  'library.tags.sameAsArtist': 'Wie der Interpret',
  'library.tags.putBack': 'Zurücksetzen',
  'library.tags.noArtist': 'Kein Interpret',
  'library.tags.noAlbum': 'Kein Album',
  'library.tags.genre.inLibrary': 'In Ihrer Bibliothek',
  'library.tags.tip.fileName':
    'Der Titel ist der Dateiname. {title} verwenden?',
  'library.tags.tip.fileNameTrack':
    'Der Titel ist der Dateiname. {title}, Titelnr. {track} verwenden?',
  'library.tags.tip.use': 'Verwenden',

  'library.tags.cover.dropHint': 'Bild ablegen oder einfügen',
  'library.tags.cover.facts': '{width} × {height} · {kind} · {size}',
  'library.tags.cover.factsShort': '{kind} · {size}',
  'library.tags.cover.none': 'Kein Cover in dieser Datei',
  'library.tags.cover.new': 'Neues Cover · {width} × {height}',
  'library.tags.cover.removed': 'Cover wird beim Speichern entfernt',
  'library.tags.cover.refused': 'Nur ein JPEG- oder PNG-Bild bis 20 MB.',
  'library.tags.cover.emptyClipboard': 'In der Zwischenablage ist kein Bild.',

  'library.tags.more.toggle': 'Weitere Felder',
  'library.tags.more.count': '{count} in dieser Datei · beliebige hinzufügen',
  'library.tags.more.countNone': 'beliebige hinzufügen',
  'library.tags.more.add': 'Feld hinzufügen',
  'library.tags.more.addHint':
    'Jedes Feld, das das Format erlaubt, über seinen Code.',
  'library.tags.more.code': 'Code',
  'library.tags.more.value': 'Wert',
  'library.tags.more.addConfirm': 'Hinzufügen',
  'library.tags.more.badCode':
    'Das Format dieser Datei kann diesen Code nicht als Text speichern.',

  'library.tags.file.format': 'Format',
  'library.tags.file.tags': 'Tags in der Datei',
  'library.tags.file.noTags': 'Keine Tags',
  'library.tags.file.writeAs': 'Schreiben als',
  'library.tags.file.keep': '{version} beibehalten',
  'library.tags.file.v23Note':
    'v2.3 lesen der Windows-Explorer, Autoradios und ältere Player am besten. v2.4 speichert UTF-8 und mehrere Werte pro Feld.',
  'library.tags.file.v24Note':
    'Der Windows-Explorer und manche Autoradios lesen v2.4 schlecht; v2.3 ist die sichere Wahl, wenn diese Datei unterwegs ist.',
  'library.tags.file.id3v1': 'Das alte ID3v1-Tag mitpflegen',
  'library.tags.file.readOnly':
    'Diese Datei ist schreibgeschützt. Sie werden gefragt, bevor sie geschrieben wird.',

  'library.tags.foot.none': 'Keine Änderungen',
  'library.tags.foot.noneHint':
    'Änderungen bleiben, während Sie durch das Album gehen',
  'library.tags.foot.changes': '{count} ungespeicherte Änderungen',
  'library.tags.foot.changesOne': '1 ungespeicherte Änderung',
  'library.tags.foot.inSongs': 'in {count} Songs',
  'library.tags.foot.inSongsOne': 'in 1 Song',
  'library.tags.revert': 'Verwerfen',
  'library.tags.save': 'Speichern',
  'library.tags.saveSongs': '{count} Songs speichern',
  'library.tags.saveFailed':
    'Einige Werte konnten nicht wie eingegeben geschrieben werden. Prüfen Sie die markierten Felder.',

  'library.tags.set.album': 'Album',
  'library.tags.set.reading': 'Tags werden gelesen · {done} von {count}',
  'library.tags.set.use': '{value} verwenden',
  'library.tags.set.coversMixed': '{count} verschiedene Cover',
  'library.tags.set.coversNone': '{count} Songs haben keins',
  'library.tags.set.coverOne': 'Ein Cover für alle',
  'library.tags.set.coverNoneAll': 'Kein Song hat ein Cover',
  'library.tags.set.coverToAll': 'Für alle {count} Songs',
  'library.tags.set.songs': 'Songs',
  'library.tags.set.renumber': 'Nach Reihenfolge nummerieren',
  'library.tags.set.fixAuto': 'Automatisch korrigieren',
  'library.tags.set.moreFields': 'Weitere Felder ({fields})',
  'library.tags.set.varies': 'Unterschiedlich:',
  'library.tags.set.variesMore': 'und {count} weitere',
  'library.tags.set.variesPlaceholder':
    'Unterschiedlich · einen für alle eingeben',
  'library.tags.set.useForAll': 'Für alle {count} Songs verwenden',
  'library.tags.set.found': '{count} Songs gefunden',
  'library.tags.set.foundOne': '1 Song gefunden',
  'library.tags.set.foundNone': 'Kein Titel enthält das',
  'library.tags.cover.change': 'Cover ändern',
  'library.tags.cover.changeShort': 'Ändern',
  'library.tags.cover.chooseImage': 'Bild auswählen…',
  'library.tags.cover.pasteImage': 'Aus der Zwischenablage einfügen',
  'library.tags.cover.removeCover': 'Cover entfernen',
  'library.tags.set.find': 'In Titeln suchen',
  'library.tags.set.replaceWith': 'Ersetzen durch',
  'library.tags.set.replaceAll': 'Alle ersetzen',
  'library.tags.set.sheetHint':
    'Eingabe geht nach unten · Tab nach rechts · Strg+D kopiert die Zelle darüber · ziehen Sie eine Zeile am Griff, um sie zu verschieben, dann Nummerieren.',
  'library.tags.set.col.no': 'Nr.',
  'library.tags.set.col.time': 'Dauer',
  'library.tags.set.grip': 'Zum Verschieben ziehen',
  'library.tags.set.missingCell': 'fehlt',
  'library.tags.set.groupSongs': '{count} Songs',
  'library.tags.set.changes': '{count} Änderungen',
  'library.tags.set.changesOne': '1 Änderung',
  'library.tags.set.files': '{count} Dateien · noch nichts geschrieben',
  'library.tags.set.filesOne': '1 Datei · noch nichts geschrieben',
  'library.tags.set.discard': 'Verwerfen',
  'library.tags.set.back': 'Zurück',
  'library.tags.set.leaveAsk': 'Ohne Speichern dieser Änderungen verlassen?',
  'library.tags.set.keepEditing': 'Weiter bearbeiten',
  'library.tags.set.unreadable':
    '{count} Songs konnten nicht gelesen werden und bleiben außen vor.',

  'library.tags.write.progress': 'Tags werden geschrieben · {done} von {count}',
  'library.tags.write.undoing':
    'Tags werden zurückgesetzt · {done} von {count}',
  'library.tags.write.background': 'Im Hintergrund fortsetzen',
  'library.tags.write.show': 'Anzeigen',
  'library.tags.write.cancel': 'Abbrechen',
  'library.tags.write.written': '{done} von {count} geschrieben',
  'library.tags.write.needYou': '{count} brauchen Sie',
  'library.tags.write.review': '{count} Dateien prüfen',
  'library.tags.write.reviewOne': '1 Datei prüfen',
  'library.tags.write.done': '{count} Dateien aktualisiert',
  'library.tags.write.doneOne': '1 Datei aktualisiert',
  'library.tags.write.doneNote':
    'Die bisherigen Tags werden aufbewahrt – Rückgängig stellt alle wieder her.',
  'library.tags.write.undo': 'Rückgängig',
  'library.tags.write.undone': 'Rückgängig gemacht',
  'library.tags.write.undoneNote':
    'Jede Datei hat wieder ihre bisherigen Tags, Cover eingeschlossen.',
  'library.tags.write.stopped': 'Angehalten nach {done} von {count}',
  'library.tags.write.stoppedNote':
    'Bereits geschriebene Dateien behalten ihre neuen Tags; Rückgängig stellt die alten wieder her.',
  'library.tags.write.failed': '{count} konnten nicht geschrieben werden',
  'library.tags.write.failedOne': '1 konnte nicht geschrieben werden',
  'library.tags.write.dismiss': 'Schließen',
  'library.tags.problems.title': '{count} Dateien brauchen Sie',
  'library.tags.problems.titleOne': '1 Datei braucht Sie',
  'library.tags.problems.allHandled': 'Alles erledigt',
  'library.tags.problems.waiting': '{count} warten auf das Ende ihres Songs',
  'library.tags.problems.waitingOne': '1 wartet auf das Ende seines Songs',
  'library.tags.problems.held':
    'Läuft gerade in FluidEQ – wird geschrieben, sobald der Song endet.',
  'library.tags.problems.locked':
    'In einem anderen Programm geöffnet. Schließen Sie sie dort und versuchen Sie es erneut.',
  'library.tags.problems.readOnly':
    'Diese Datei ist schreibgeschützt und kann so nicht geändert werden.',
  'library.tags.problems.failed':
    'Diese Datei konnte nicht geschrieben werden. Sie ist unverändert; nichts ging verloren.',
  'library.tags.problems.missing':
    'Diese Datei ist nicht mehr dort, wo die Bibliothek sie gefunden hat.',
  'library.tags.problems.retry': 'Erneut versuchen',
  'library.tags.problems.skip': 'Überspringen',
  'library.tags.problems.makeWritable': 'Schreibbar machen und schreiben',
  'library.tags.problems.skipAll': 'Alle überspringen',
  'library.tags.problems.nothingToDo': 'Nichts zu tun.',
  'library.tags.problems.everythingElse': 'Alles andere ist geschrieben',
  'library.tags.problems.undoCovers': 'Rückgängig gilt auch für diese',
  'library.tags.menu.fix': 'Tags automatisch korrigieren…',
  'library.tags.menu.fixAlbum': 'Dieses Album korrigieren…',
  'library.tags.menu.fixShortcut': 'Strg+Umschalt+I',
  'library.tags.hero.fix': 'Tags korrigieren',
  'library.tags.selection.fix': 'Korrigieren',
  'library.tags.fix.leadNone':
    'Aus den Tags und Dateinamen der Songs gibt es nichts zu korrigieren.',
  'library.tags.fix.source.fileName': 'Dateiname',
  'library.tags.fix.source.capitals': 'Großschreibung',
  'library.tags.fix.source.junk': 'Bereinigung',
  'library.tags.fix.source.majority': 'Album-Mehrheit',
  'library.tags.fix.source.count': 'Anzahl der Songs',
  'library.tags.fix.source.spelling': 'Ihre Schreibweise',
  'library.tags.fix.source.hand': 'Von Ihnen geändert',
  'library.tags.fix.songsAll': 'Alle {count}',
  'library.tags.fix.empty': 'leer',
  'library.tags.fix.apply': 'Diese Änderung übernehmen',
  'library.tags.fix.rules.fileNames': 'Titel aus Dateinamen',
  'library.tags.fix.rules.patternNeedsTitle': 'Das Muster braucht %title%',
  'library.tags.fix.rules.preview':
    '{file} → Titelnummer {track}, Titel {title}',
  'library.tags.fix.rules.previewTitle': '{file} → Titel {title}',
  'library.tags.fix.rules.previewNone':
    'Kein Dateiname in diesem Album passt zum Muster',
  'library.tags.fix.rules.strip': 'Aus Titeln entfernen',
  'library.tags.fix.rules.stripPlaceholder': 'Zu entfernender Text',
  'library.tags.fix.rules.stripAdd': 'Hinzufügen',
  'library.tags.fix.rules.stripRemove': '{text} entfernen',
  'library.tags.fix.rules.capitals': 'Großschreibung',
  'library.tags.fix.rules.capsReleased': 'Wie veröffentlicht',
  'library.tags.fix.rules.capsTitle': 'Jedes Wort groß',
  'library.tags.fix.rules.capsSentence': 'Wie ein Satz',
  'library.tags.fix.rules.capsNote':
    '„de“, „la“, „en“, „y“, „of“, „the“ bleiben innerhalb eines Titels klein; „¡“ und „¿“ bleiben erhalten. „Wie veröffentlicht“ korrigiert nur Titel, die ganz in einer Schreibweise geschrieben sind.',
  'library.tags.fix.rules.spellings': 'Gelernte Schreibweisen',
  'library.tags.fix.rules.spellingsNote':
    'An: Jedes Album, das Sie ab jetzt korrigieren, nutzt sie auch.',
  'library.tags.fix.rules.spellingsNone':
    'Schreibweisen, die dieses Album vereinheitlicht, erscheinen hier; schalten Sie eine ein, um sie weiter zu nutzen.',
  'library.tags.fix.rules.keepSpelling': 'Immer {to} statt {from} verwenden',
  'library.tags.fix.changes': '{count} Änderungen',
  'library.tags.fix.changesOne': '1 Änderung',
  'library.tags.fix.files':
    '{count} Dateien · Originale für Rückgängig behalten',
  'library.tags.fix.filesOne': '1 Datei · Original für Rückgängig behalten',
  'library.tags.fix.nothing': 'Nichts angehakt',
  'library.tags.fix.nothingHint':
    'Haken Sie eine Zeile an, um sie zu korrigieren',
  'library.tags.fix.write': '{count} Änderungen schreiben',
  'library.tags.fix.writeOne': '1 Änderung schreiben',
  'library.tags.fix.cancel': 'Abbrechen',
  'library.tags.fix.albums': '{count} Alben',
  'library.tags.fix.review': 'Ansehen',
  'library.tags.fix.albumNothing': 'Nichts zu korrigieren',
  'library.tags.fix.albumChanges': '{count} Änderungen',
  'library.tags.fix.albumChangesOne': '1 Änderung',
  'library.tags.fix.allAlbums': 'Alle Alben',
  'library.tags.fix.intro':
    'Aus den Tags, Dateinamen und Ordnern ermittelt. Ändern Sie vor dem Speichern, was Sie möchten. Nichts wurde online abgefragt.',
  'library.tags.fix.beforeCol': 'Vorher',
  'library.tags.fix.now': 'Jetzt: {value}',
  'library.tags.fix.onlySong': 'Nur bei Song {songs}',
  'library.tags.fix.onlySongs': 'Nur bei den Songs {songs}',
  'library.tags.fix.settings': 'Regeln für Titel und Schreibweisen',
  'library.tags.fix.source.folder': 'Aus dem Ordnernamen',
  'library.tags.fix.source.parentFolder': 'Aus dem übergeordneten Ordner',
  'library.tags.fix.source.artistInTitle': 'Interpret im Titel',
};

export default libraryTags;
