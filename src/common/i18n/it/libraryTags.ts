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
  'library.tags.menu.edit': 'Modifica tag…',
  'library.tags.menu.editMany': 'Modifica i tag di {count} brani…',
  'library.tags.menu.editAlbum': 'Modifica i tag dell’album…',
  'library.tags.menu.cover': 'Cambia copertina…',
  'library.tags.menu.shortcut': 'Ctrl+I',
  'library.tags.selection.count': '{count} brani',
  'library.tags.selection.edit': 'Modifica tag',
  'library.tags.selection.clear': 'Annulla selezione',

  'library.tags.field.title': 'Titolo',
  'library.tags.field.artist': 'Artista',
  'library.tags.field.composer': 'Compositore',
  'library.tags.field.album': 'Album',
  'library.tags.field.albumArtist': 'Artista dell’album',
  'library.tags.field.trackNo': 'Traccia',
  'library.tags.field.trackTotal': 'Tracce totali',
  'library.tags.field.discNo': 'Disco',
  'library.tags.field.discTotal': 'Dischi totali',
  'library.tags.field.year': 'Anno',
  'library.tags.field.genre': 'Genere',
  'library.tags.field.bpm': 'BPM',
  'library.tags.field.comment': 'Commento',
  'library.tags.field.grouping': 'Raggruppamento',
  'library.tags.field.publisher': 'Etichetta',
  'library.tags.field.copyright': 'Copyright',
  'library.tags.field.isrc': 'ISRC',
  'library.tags.field.conductor': 'Direttore',
  'library.tags.field.subtitle': 'Sottotitolo',
  'library.tags.field.remixer': 'Remix di',
  'library.tags.field.initialKey': 'Tonalità',
  'library.tags.field.compilation': 'Compilation',
  'library.tags.field.titleSort': 'Ordinamento titolo',
  'library.tags.field.artistSort': 'Ordinamento artista',
  'library.tags.field.albumSort': 'Ordinamento album',
  'library.tags.field.albumArtistSort': 'Ordinamento artista dell’album',
  'library.tags.field.composerSort': 'Ordinamento compositore',
  'library.tags.field.musicBrainzTrackId': 'Registrazione MusicBrainz',
  'library.tags.field.musicBrainzReleaseId': 'Pubblicazione MusicBrainz',
  'library.tags.field.musicBrainzArtistId': 'Artista MusicBrainz',
  'library.tags.field.musicBrainzReleaseArtistId':
    'Artista dell’album MusicBrainz',
  'library.tags.field.musicBrainzReleaseGroupId':
    'Gruppo di pubblicazioni MusicBrainz',

  'library.tags.panel.title': 'Modifica tag',
  'library.tags.panel.position': '{index} di {count}',
  'library.tags.panel.previous': 'Brano precedente (Alt+↑)',
  'library.tags.panel.next': 'Brano successivo (Alt+↓)',
  'library.tags.panel.close': 'Chiudi (Esc): le modifiche restano',
  'library.tags.panel.reading': 'Lettura dei tag del file…',
  'library.tags.panel.readFailed':
    'Impossibile leggere i tag di questo file. Potrebbe essere danneggiato o in uso.',
  'library.tags.panel.missing': 'Questo brano non è più sul disco.',
  'library.tags.panel.unsupported':
    'FluidEQ non modifica i tag di questo tipo di file.',
  'library.tags.group.song': 'Brano',
  'library.tags.group.album': 'Album',
  'library.tags.group.details': 'Dettagli',
  'library.tags.group.file': 'File',
  'library.tags.of': 'di',
  'library.tags.sameAsArtist': 'Come l’artista',
  'library.tags.putBack': 'Ripristina',
  'library.tags.noArtist': 'Nessun artista',
  'library.tags.noAlbum': 'Nessun album',
  'library.tags.genre.inLibrary': 'Nella tua libreria',
  'library.tags.tip.fileName': 'Il titolo è il nome del file. Usare {title}?',
  'library.tags.tip.fileNameTrack':
    'Il titolo è il nome del file. Usare {title}, traccia {track}?',
  'library.tags.tip.use': 'Usa',

  'library.tags.cover.dropHint': 'Trascina o incolla un’immagine',
  'library.tags.cover.facts': '{width} × {height} · {kind} · {size}',
  'library.tags.cover.factsShort': '{kind} · {size}',
  'library.tags.cover.none': 'Nessuna copertina in questo file',
  'library.tags.cover.new': 'Nuova copertina · {width} × {height}',
  'library.tags.cover.removed': 'Copertina rimossa al salvataggio',
  'library.tags.cover.refused': 'Solo un’immagine JPEG o PNG fino a 20 MB.',
  'library.tags.cover.emptyClipboard':
    'Negli appunti non c’è nessuna immagine.',

  'library.tags.more.toggle': 'Altri campi',
  'library.tags.more.count': '{count} in questo file · aggiungine altri',
  'library.tags.more.countNone': 'aggiungine altri',
  'library.tags.more.add': 'Aggiungi un campo',
  'library.tags.more.addHint':
    'Qualsiasi campo consentito dal formato, tramite il suo codice.',
  'library.tags.more.code': 'Codice',
  'library.tags.more.value': 'Valore',
  'library.tags.more.addConfirm': 'Aggiungi',
  'library.tags.more.badCode':
    'Il formato di questo file non può conservare quel codice come testo.',

  'library.tags.file.format': 'Formato',
  'library.tags.file.tags': 'Tag nel file',
  'library.tags.file.noTags': 'Nessun tag',
  'library.tags.file.writeAs': 'Scrivi come',
  'library.tags.file.keep': 'Mantieni {version}',
  'library.tags.file.v23Note':
    'La v2.3 è quella che Esplora file di Windows, le autoradio e i lettori più vecchi leggono meglio. La v2.4 salva UTF-8 e più valori per campo.',
  'library.tags.file.v24Note':
    'Esplora file di Windows e alcune autoradio leggono male la v2.4; la v2.3 è la scelta sicura se questo file viaggia.',
  'library.tags.file.id3v1': 'Tieni aggiornato il vecchio tag ID3v1',
  'library.tags.file.readOnly':
    'Questo file è di sola lettura. Ti verrà chiesto prima di scriverlo.',

  'library.tags.foot.none': 'Nessuna modifica',
  'library.tags.foot.noneHint': 'Le modifiche restano mentre scorri l’album',
  'library.tags.foot.changes': '{count} modifiche non salvate',
  'library.tags.foot.changesOne': '1 modifica non salvata',
  'library.tags.foot.inSongs': 'in {count} brani',
  'library.tags.foot.inSongsOne': 'in 1 brano',
  'library.tags.revert': 'Annulla modifiche',
  'library.tags.save': 'Salva',
  'library.tags.saveSongs': 'Salva {count} brani',
  'library.tags.saveFailed':
    'Alcuni valori non si sono potuti scrivere così come sono. Controlla i campi segnati.',

  'library.tags.set.album': 'Album',
  'library.tags.set.reading': 'Lettura dei tag · {done} di {count}',
  'library.tags.set.use': 'Usa {value}',
  'library.tags.set.coversMixed': '{count} copertine diverse',
  'library.tags.set.coversNone': '{count} brani non ne hanno',
  'library.tags.set.coverOne': 'Una copertina per tutti',
  'library.tags.set.coverNoneAll': 'Nessun brano ha una copertina',
  'library.tags.set.coverToAll': 'Per tutti i {count} brani',
  'library.tags.set.songs': 'Brani',
  'library.tags.set.renumber': 'Rinumera per ordine',
  'library.tags.set.fixAuto': 'Correggi automaticamente',
  'library.tags.set.moreFields': 'Altri campi ({fields})',
  'library.tags.set.varies': 'Varia:',
  'library.tags.set.variesMore': 'e altri {count}',
  'library.tags.set.variesPlaceholder': 'Varia · scrivine uno per tutti',
  'library.tags.set.useForAll': 'Usa per tutti i {count} brani',
  'library.tags.set.found': '{count} brani trovati',
  'library.tags.set.foundOne': '1 brano trovato',
  'library.tags.set.foundNone': 'Nessun titolo lo contiene',
  'library.tags.cover.change': 'Cambia copertina',
  'library.tags.cover.changeShort': 'Cambia',
  'library.tags.cover.chooseImage': 'Scegli un’immagine…',
  'library.tags.cover.pasteImage': 'Incolla dagli appunti',
  'library.tags.cover.removeCover': 'Rimuovi la copertina',
  'library.tags.set.find': 'Trova nei titoli',
  'library.tags.set.replaceWith': 'Sostituisci con',
  'library.tags.set.replaceAll': 'Sostituisci tutto',
  'library.tags.set.sheetHint':
    'Invio scende · Tab va a destra · Ctrl+D copia la cella sopra · trascina una riga dalla maniglia per riordinarla, poi Rinumera.',
  'library.tags.set.col.no': 'N.',
  'library.tags.set.col.time': 'Durata',
  'library.tags.set.grip': 'Trascina per riordinare',
  'library.tags.set.missingCell': 'manca',
  'library.tags.set.groupSongs': '{count} brani',
  'library.tags.set.changes': '{count} modifiche',
  'library.tags.set.changesOne': '1 modifica',
  'library.tags.set.files': '{count} file · ancora nulla di scritto',
  'library.tags.set.filesOne': '1 file · ancora nulla di scritto',
  'library.tags.set.discard': 'Scarta',
  'library.tags.set.back': 'Indietro',
  'library.tags.set.leaveAsk': 'Uscire senza salvare queste modifiche?',
  'library.tags.set.keepEditing': 'Continua a modificare',
  'library.tags.set.unreadable':
    '{count} brani non si sono potuti leggere e restano fuori.',

  'library.tags.write.progress': 'Scrittura dei tag · {done} di {count}',
  'library.tags.write.undoing': 'Ripristino dei tag · {done} di {count}',
  'library.tags.write.background': 'Continua in background',
  'library.tags.write.show': 'Mostra',
  'library.tags.write.cancel': 'Annulla',
  'library.tags.write.written': '{done} di {count} scritti',
  'library.tags.write.needYou': '{count} hanno bisogno di te',
  'library.tags.write.review': 'Controlla {count} file',
  'library.tags.write.reviewOne': 'Controlla 1 file',
  'library.tags.write.done': '{count} file aggiornati',
  'library.tags.write.doneOne': '1 file aggiornato',
  'library.tags.write.doneNote':
    'I tag precedenti sono conservati: Annulla li rimette tutti.',
  'library.tags.write.undo': 'Annulla',
  'library.tags.write.undone': 'Annullato',
  'library.tags.write.undoneNote':
    'Ogni file ha di nuovo i tag precedenti, copertina compresa.',
  'library.tags.write.stopped': 'Fermato dopo {done} di {count}',
  'library.tags.write.stoppedNote':
    'I file già scritti mantengono i nuovi tag; Annulla rimette quelli vecchi.',
  'library.tags.write.failed': '{count} non si sono potuti scrivere',
  'library.tags.write.failedOne': '1 non si è potuto scrivere',
  'library.tags.write.dismiss': 'Chiudi',
  'library.tags.problems.title': '{count} file hanno bisogno di te',
  'library.tags.problems.titleOne': '1 file ha bisogno di te',
  'library.tags.problems.allHandled': 'Tutto risolto',
  'library.tags.problems.waiting': '{count} aspettano la fine del brano',
  'library.tags.problems.waitingOne': '1 aspetta la fine del brano',
  'library.tags.problems.held':
    'In riproduzione in FluidEQ: viene scritto appena finisce il brano.',
  'library.tags.problems.locked':
    'Aperto in un altro programma. Chiudilo lì e riprova.',
  'library.tags.problems.readOnly':
    'Questo file è di sola lettura, quindi non si può modificare così com’è.',
  'library.tags.problems.failed':
    'Impossibile scrivere questo file. È rimasto com’era; non si è perso nulla.',
  'library.tags.problems.missing':
    'Questo file non è più dove la libreria l’aveva trovato.',
  'library.tags.problems.retry': 'Riprova',
  'library.tags.problems.skip': 'Salta',
  'library.tags.problems.makeWritable': 'Rendi scrivibile e scrivi',
  'library.tags.problems.skipAll': 'Salta tutti',
  'library.tags.problems.nothingToDo': 'Niente da fare.',
  'library.tags.problems.everythingElse': 'Tutto il resto è scritto',
  'library.tags.problems.undoCovers': 'Annulla vale anche per questi',
  'library.tags.menu.fix': 'Correggi i tag automaticamente…',
  'library.tags.menu.fixAlbum': 'Correggi questo album…',
  'library.tags.menu.fixShortcut': 'Ctrl+Maiusc+I',
  'library.tags.hero.fix': 'Correggi i tag',
  'library.tags.selection.fix': 'Correggi',
  'library.tags.fix.leadNone':
    'Niente da correggere dai tag e dai nomi dei file dei brani.',
  'library.tags.fix.source.fileName': 'Nome del file',
  'library.tags.fix.source.capitals': 'Maiuscole',
  'library.tags.fix.source.junk': 'Pulizia',
  'library.tags.fix.source.majority': 'Maggioranza dell’album',
  'library.tags.fix.source.count': 'Numero di brani',
  'library.tags.fix.source.spelling': 'La tua grafia',
  'library.tags.fix.source.hand': 'Cambiato da te',
  'library.tags.fix.songsAll': 'Tutti e {count}',
  'library.tags.fix.empty': 'vuoto',
  'library.tags.fix.apply': 'Applica questa modifica',
  'library.tags.fix.rules.fileNames': 'Titoli dai nomi dei file',
  'library.tags.fix.rules.patternNeedsTitle':
    'Lo schema deve contenere %title%',
  'library.tags.fix.rules.preview': '{file} → traccia {track}, titolo {title}',
  'library.tags.fix.rules.previewTitle': '{file} → titolo {title}',
  'library.tags.fix.rules.previewNone':
    'Nessun nome di file di questo album corrisponde allo schema',
  'library.tags.fix.rules.strip': 'Togli dai titoli',
  'library.tags.fix.rules.stripPlaceholder': 'Testo da togliere',
  'library.tags.fix.rules.stripAdd': 'Aggiungi',
  'library.tags.fix.rules.stripRemove': 'Togli {text}',
  'library.tags.fix.rules.capitals': 'Maiuscole',
  'library.tags.fix.rules.capsReleased': 'Come pubblicato',
  'library.tags.fix.rules.capsTitle': 'Ogni Parola',
  'library.tags.fix.rules.capsSentence': 'Come una frase',
  'library.tags.fix.rules.capsNote':
    '“de”, “la”, “en”, “y”, “of”, “the” restano minuscole dentro un titolo; “¡” e “¿” vengono mantenuti. “Come pubblicato” corregge solo i titoli scritti tutti maiuscoli o tutti minuscoli.',
  'library.tags.fix.rules.spellings': 'Grafie imparate',
  'library.tags.fix.rules.spellingsNote':
    'Attiva: ogni album che correggi da ora in poi la usa anche.',
  'library.tags.fix.rules.spellingsNone':
    'Qui compaiono le grafie che questo album uniforma; attivane una per continuare a usarla.',
  'library.tags.fix.rules.keepSpelling': 'Usa sempre {to} al posto di {from}',
  'library.tags.fix.changes': '{count} modifiche',
  'library.tags.fix.changesOne': '1 modifica',
  'library.tags.fix.files': '{count} file · originali tenuti per Annulla',
  'library.tags.fix.filesOne': '1 file · originale tenuto per Annulla',
  'library.tags.fix.nothing': 'Niente spuntato',
  'library.tags.fix.nothingHint': 'Spunta una riga per correggerla',
  'library.tags.fix.write': 'Scrivi {count} modifiche',
  'library.tags.fix.writeOne': 'Scrivi 1 modifica',
  'library.tags.fix.cancel': 'Annulla',
  'library.tags.fix.albums': '{count} album',
  'library.tags.fix.review': 'Rivedi',
  'library.tags.fix.albumNothing': 'Niente da correggere',
  'library.tags.fix.albumChanges': '{count} modifiche',
  'library.tags.fix.albumChangesOne': '1 modifica',
  'library.tags.fix.allAlbums': 'Tutti gli album',
  'library.tags.fix.intro':
    'Ricavato da tag, nomi dei file e cartelle. Cambia quello che vuoi prima di salvare. Niente è stato cercato online.',
  'library.tags.fix.beforeCol': 'Prima',
  'library.tags.fix.now': 'Ora: {value}',
  'library.tags.fix.onlySong': 'Solo nel brano {songs}',
  'library.tags.fix.onlySongs': 'Solo nei brani {songs}',
  'library.tags.fix.settings': 'Regole per titoli e grafie',
  'library.tags.fix.source.folder': 'Dal nome della cartella',
  'library.tags.fix.source.parentFolder': 'Dalla cartella superiore',
  'library.tags.fix.source.artistInTitle': 'Artista nel titolo',
};

export default libraryTags;
