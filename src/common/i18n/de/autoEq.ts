/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Auto EQ on the EQ page: its button, its panel, Manage, and the note that
 * took the Output panel’s old switch’s place. */
export default {
  'autoEq.title': 'Auto-EQ',
  'autoEq.aria': 'Auto-EQ: was den Klang jedes Songs bestimmt',
  'autoEq.chip.title': 'Es spielt {sound}. Auto-EQ öffnen',
  'autoEq.chip.song': 'Song · {preset}',
  'autoEq.restore': '{preset} wiederherstellen',
  'autoEq.now.albumSound': 'Album-Klang: {preset}',
  'autoEq.now.songSound': 'Klang dieses Songs: {preset}',
  'autoEq.now.playingNow': 'Jetzt läuft: {preset}',
  'autoEq.chip.changedAlbum': 'Von Hand geändert. Das Album spielt {preset}',
  'autoEq.chip.changedSong': 'Von Hand geändert. Dieser Song spielt {preset}',
  'autoEq.chip.open': 'Auto-EQ öffnen',
  'autoEq.tagline': 'Der Klang jedes Songs, für Sie gewählt',
  'autoEq.state.measuring': 'Misst',
  'autoEq.state.song': 'Song',
  'autoEq.state.album': 'Album',
  'autoEq.state.yours': 'Ihrer',
  'autoEq.aside':
    'Ein Spiel spielt seinen eigenen Klang, daher warten Song- und Album-Klänge. Sie kehren zurück, wenn es aufhört.',
  'autoEq.now.nothing': 'Nichts läuft',
  'autoEq.now.yours': 'Ihr Klang',
  'autoEq.now.yoursWhy':
    'Für diesen Song ist nichts gespeichert: Er spielt Ihren eigenen Klang, so wie Sie ihn gelassen haben.',
  'autoEq.now.song': 'Klang dieses Songs',
  'autoEq.now.songWhy': 'Kommt jedes Mal zurück, wenn dieser Song läuft.',
  'autoEq.now.album': 'Klang von {album}',
  'autoEq.now.albumUnnamed': 'Klang seines Albums',
  'autoEq.now.albumWhy': 'In der Bibliothek für das ganze Album festgelegt.',
  'autoEq.now.showPreset': '{preset} im Preset-Tab zeigen',
  'autoEq.songs.title': 'Song-Klänge',
  'autoEq.songs.hint':
    'Ein Song mit gespeichertem Klang spielt ihn. Ihre Änderungen bleiben bei diesem Song, bis Sie sie speichern. Andere Songs spielen Ihren.',
  'autoEq.songs.nothing':
    'Spielen Sie einen Song ab, um seinen Klang zu speichern',
  'autoEq.songs.saved': 'Für diesen Song gespeichert',
  'autoEq.songs.none': 'Für diesen Song ist nichts gespeichert',
  'autoEq.songs.save': 'Für diesen Song speichern',
  'autoEq.songs.forget': 'Vergessen',
  'autoEq.button.save': 'Speichern',
  'autoEq.state.changed': 'Geändert',
  'autoEq.songs.changed': 'Geändert, nicht gespeichert',
  'autoEq.songs.saveChanges': 'Änderungen speichern',
  'autoEq.button.saveFor': 'Speichern, was für {title} spielt',
  'autoEq.button.saved': 'Gespeichert',
  'autoEq.holds.preset': 'Preset',
  'autoEq.holds.eq': 'Ihr EQ',
  'autoEq.holds.curves': 'Kurven',
  'autoEq.holds.bands': '{count} Bänder',
  'autoEq.holds.bandsOne': '1 Band',
  'autoEq.holds.flat': 'Neutral',
  'autoEq.holds.none': 'Keine',
  'autoEq.holds.curve': 'Kurve von {preset}',
  'autoEq.holds.correction': 'Die Kopfhörerkorrektur bleibt beim Ausgang',
  'autoEq.albums.title': 'Album-Klänge',
  'autoEq.albums.hint':
    'Nur in der Bibliothek. Jeder Song des Albums spielt ihn, außer einem Song mit eigenem Preset.',
  'autoEq.albums.nothing':
    'Legen Sie den Klang eines Albums auf seiner Seite in der Bibliothek fest',
  'autoEq.albums.libraryOnly': 'Nur Bibliothek: nicht für andere Player',
  'autoEq.albums.set': '{album}: {preset}',
  'autoEq.albums.none': 'Für dieses Album ist kein Klang festgelegt',
  'autoEq.smart.title': 'Smart-Korrektur',
  'autoEq.smart.hint':
    'Misst jeden Song an der Quelle und behält seine Korrektur für diesen Song. Zusätzlich zu jedem Preset.',
  'autoEq.smart.waiting': 'Wartet auf einen Song',
  'autoEq.smart.onceHint':
    'Eine Messung dessen, was läuft, auf einmal angewendet',
  'autoEq.smart.once': 'Einmal messen',
  'autoEq.smart.phase.listening': 'Hört zu',
  'autoEq.smart.phase.settling': 'Pendelt sich ein',
  'autoEq.smart.phase.held': 'Für diesen Song festgelegt',
  'autoEq.smart.phase.paused': 'Pausiert',
  'autoEq.smart.heard': '{seconds} s',
  'autoEq.smart.note.listening':
    'Was jetzt spielt, spielt weiter, bis die Korrektur dieses Songs feststeht.',
  'autoEq.smart.note.waitingOn':
    'Wartet auf {ranges}. Was jetzt spielt, spielt weiter, bis die Korrektur dieses Songs feststeht.',
  'autoEq.smart.note.listeningLive':
    'Die Korrektur kommt beim Zuhören nach und nach.',
  'autoEq.smart.note.waitingOnLive':
    'Wartet auf {ranges}. Die Korrektur kommt beim Zuhören nach und nach.',
  'autoEq.smart.note.settling':
    'Prüft, ob die Kurve stillsteht, bevor sie geschrieben wird.',
  'autoEq.smart.note.held':
    'Die Messung ist beendet. Beim nächsten Song hört sie wieder zu.',
  'autoEq.smart.note.heldMissing':
    'Nicht auf dieser Aufnahme, daher unverändert: {ranges}. Die Messung ist beendet.',
  'autoEq.smart.note.heldShort':
    'Zu wenig von der Aufnahme für eine Korrektur, der Klang bleibt, wie er war.',
  'autoEq.smart.again': 'Erneut messen',
  'autoEq.smart.againHint':
    'Diesen Song noch einmal anhören und seine Korrektur ersetzen',
  'autoEq.savedCount': 'Gespeichert: {songs} · {albums}',
  'autoEq.manage': 'Verwalten',
  'autoEq.manage.title': 'Gespeicherte Klänge',
  'autoEq.manage.back': 'Zurück zu Auto-EQ',
  'autoEq.manage.songs': 'Songs',
  'autoEq.manage.albums': 'Alben',
  'autoEq.manage.search': 'Gespeicherte Klänge suchen',
  'autoEq.manage.wholeSound': '{preset} mit Klang-Reglern und EQ',
  'autoEq.manage.forget': 'Vergessen',
  'autoEq.manage.others': 'Songs aus anderen Playern: {count}',
  'autoEq.manage.othersHint':
    'Spotify, YouTube und der Browser. Ihre Namen werden nie gespeichert.',
  'autoEq.manage.empty': 'Noch nichts gespeichert',
  'autoEq.manage.noMatch': 'Keine Treffer',
  'autoEq.manage.resetKeeps':
    '„Alle Einstellungen zurücksetzen“ behält sie. Nur „Vergessen“ entfernt sie.',
  'autoEq.manage.forgetAll': 'Alle vergessen',
  'autoEq.manage.forgetAllConfirm': 'Alle endgültig vergessen',
  'autoEq.moved.title': 'Der Klang jedes Songs ist jetzt in Auto-EQ',
  'autoEq.moved.body':
    '„Klang jedes Songs merken“ ist zu Auto-EQ auf der EQ-Seite umgezogen. Ihre {count} gespeicherten Songs sind mitgekommen.',
  'autoEq.moved.bodyOne':
    '„Klang jedes Songs merken“ ist zu Auto-EQ auf der EQ-Seite umgezogen. Ihr gespeicherter Song ist mitgekommen.',
  'autoEq.moved.open': 'Auto-EQ öffnen',
  'autoEq.moved.dismiss': 'Verstanden',
  'autoEq.eqs.title': 'Gespeicherte EQs',
  'autoEq.eqs.saveThis': 'Diesen EQ speichern',
  'autoEq.eqs.empty': 'Noch nichts gespeichert',
  'autoEq.eqs.name': 'Name',
  'autoEq.eqs.defaultName': 'Mein EQ {count}',
  'autoEq.eqs.keepPreset': 'Preset mitspeichern',
  'autoEq.eqs.anyPreset': 'Klingt über jedem Preset',
  'autoEq.eqs.stays':
    'Kopfhörerkorrektur und Smart-Korrektur bleiben, wo sie sind.',
  'autoEq.eqs.cancel': 'Abbrechen',
  'autoEq.eqs.save': 'Speichern',
  'autoEq.eqs.saveFailed':
    'Speichern ist fehlgeschlagen. Bitte erneut versuchen.',
  'autoEq.eqs.update': 'Aktualisieren',
  'autoEq.eqs.updateWithLive': 'Mit dem Laufenden aktualisieren',
  'autoEq.eqs.playing': 'Läuft',
  'autoEq.eqs.more': 'Mehr für {name}',
  'autoEq.eqs.renameLabel': 'Neuer Name für {name}',
  'autoEq.eqs.deleteAsk': '{name} löschen?',
  'autoEq.eqs.deleteKeeps':
    'Verwendet von {what}. Jedes behält seinen Klang als eigenen.',
  'autoEq.eqs.usedBy': 'auf {what}',
  'autoEq.eqs.use': 'Gespeicherten EQ verwenden',
  'autoEq.eqs.saveNew': 'Als neuen EQ speichern…',
  'autoEq.eqs.manageAll': 'Gespeicherte EQs verwalten…',
  'autoEq.eqs.search': 'Gespeicherte EQs suchen',
  'autoEq.eqs.load': 'Laden',
  'autoEq.eqs.reload': 'Neu laden',
  'autoEq.eqs.loadNamed': '{name} laden',
  'autoEq.eqs.reloadNamed': '{name} wie gespeichert neu laden',
  'autoEq.eqs.saveChangesNamed': 'Änderungen in „{name}“ speichern',
  'autoEq.eqs.usedByWhat': 'Verwendet von {what}',
  'autoEq.eqs.savedNamed': '„{name}“ ist gespeichert',
  'autoEq.eqs.undo': 'Rückgängig',
  'autoEq.eqs.undoNamed': 'Speichern von „{name}“ rückgängig machen',
  'autoEq.eqs.replaceAsk': '„{name}“ durch das Laufende ersetzen?',
  'autoEq.eqs.replaceReach':
    'Verwendet von {what}. Sie spielen dann den neuen Klang.',
  'autoEq.eqs.replace': 'Ersetzen',
  'autoEq.songs.follows': 'Folgt {name}',
};
