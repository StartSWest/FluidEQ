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
  'library.tags.problems.failedCopy':
    'Die Kopie, über die geschrieben wird, ließ sich daneben nicht anlegen. Die Datei ist unverändert. Versuchen Sie es erneut; ist das Laufwerk voll oder beschäftigt, schaffen Sie zuerst Platz.',
  'library.tags.problems.failedTags':
    'Die Tags ließen sich nicht schreiben: Die Datei ist vielleicht beschädigt oder ungewöhnlich. Sie ist unverändert. Versuchen Sie es erneut oder öffnen Sie sie in einem anderen Tag-Editor.',
  'library.tags.problems.failedCheck':
    'Beim Prüfen ließ sich die geschriebene Kopie nicht als derselbe Song lesen; sie wurde nicht verwendet. Die Datei ist unverändert.',
  'library.tags.problems.failedUndo':
    'Was Rückgängig braucht, ließ sich nicht sichern; es wurde nichts geschrieben. Die Datei ist unverändert.',
  'library.tags.problems.failedPlace':
    'Die geschriebene Kopie konnte den Platz der Datei nicht einnehmen. Die Datei ist unverändert. Arbeitet eine Synchronisierung wie OneDrive gerade daran, versuchen Sie es danach erneut.',
  'library.tags.problems.options': 'Optionen für diese Datei',
  'library.tags.problems.openTags': 'Tags anzeigen',
  'library.tags.problems.reveal': 'Im Explorer anzeigen',
  'library.tags.problems.nothingToDo': 'Nichts zu tun.',
  'library.tags.problems.everythingElse': 'Alles andere ist geschrieben',
  'library.tags.problems.undoCovers': 'Rückgängig gilt auch für diese',
  'library.tags.menu.fix': 'Tags automatisch korrigieren…',
  'library.tags.menu.fixAlbum': 'Dieses Album korrigieren…',
  'library.tags.menu.fixShortcut': 'Strg+Umschalt+I',
  'library.tags.hero.fix': 'Tags korrigieren',
  'library.tags.selection.fix': 'Korrigieren',
  'library.tags.fix.empty': 'leer',
  'library.tags.fix.albums': '{count} Alben',
  'library.tags.fix.albumChanges': '{count} Änderungen',
  'library.tags.fix.albumChangesOne': '1 Änderung',
  'library.tags.fix.nothingFound':
    'FluidEQ hat in diesen Songs nichts zu korrigieren gefunden.',
  'library.tags.fix.noPicture':
    'Das Bild im Albumordner ließ sich nicht verwenden.',
  'library.tags.fix.filled':
    'FluidEQ hat Fehlendes ergänzt. Geändertes ist farbig, der alte Wert daneben durchgestrichen: Prüfen Sie es und speichern Sie, oder verwerfen Sie es.',
  'library.tags.fix.fixAlbum': 'Korrigieren',
  'library.tags.fix.openAlbum': 'Öffnen',
  'library.tags.fix.editByHand': 'Alles von Hand bearbeiten',
  'library.tags.fix.albumComplete': 'Vollständig',
  'library.tags.changes.title': 'Änderungen',
  'library.tags.changes.none':
    'Noch keine Änderungen. Was Sie ändern, steht hier, bevor Sie speichern.',
  'library.tags.changes.album': 'Für das ganze Album',
  'library.tags.changes.songs': 'Song für Song',
  'library.tags.changes.removed': 'wird entfernt',
  'library.tags.changes.cover': 'Cover',
  'library.tags.changes.coverNew': 'Neues Bild',
  'library.tags.changes.coverRemoved': 'Wird entfernt',
  'library.tags.cover.useOne': 'Eines für alle Songs verwenden',
  'library.tags.cover.useThis': 'Dieses Cover für alle Songs verwenden',
  'library.tags.cover.searchWeb': 'Cover im Internet suchen…',
  'library.tags.cover.searchHint':
    'Kopieren Sie im Browser das gewünschte Bild und wählen Sie Einfügen, oder ziehen Sie es auf das Cover.',
  'library.tags.set.searchWeb': 'Album im Internet nachschlagen',
  'library.tags.set.searchWebNote':
    'Öffnet das Album auf MusicBrainz in Ihrem Browser. FluidEQ lädt nichts herunter.',
  'library.tags.write.undoAsk':
    'Die alten Tags von {count} Dateien wiederherstellen?',
  'library.tags.write.undoAskOne':
    'Die alten Tags von 1 Datei wiederherstellen?',
  'library.tags.write.undoKeep': 'Nein',
  'library.tags.write.undoConfirm': 'Rückgängig',
};

export default libraryTags;
