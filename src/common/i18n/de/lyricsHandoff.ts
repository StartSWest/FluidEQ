const lyricsHandoff = {
  'library.lyrics.karaoke.open': 'In Karaoke öffnen',
  'library.lyrics.karaoke.opening': 'Wird geöffnet…',
  'library.lyrics.karaoke.hintTimed':
    'Ein Karaoke aus diesem synchronisierten Songtext beginnen und das Timing im Editor korrigieren',
  'library.lyrics.karaoke.hintPlain':
    'Ein Karaoke aus diesem Songtext beginnen und ihn im Editor synchronisieren',
  'library.lyrics.karaoke.failed':
    'Dieser Titel konnte nicht in Karaoke geöffnet werden.',
  'library.lyrics.remove.button': 'Songtext entfernen',
  'library.lyrics.remove.askFile':
    '{name} entfernen? Die Songtext-Datei neben dem Titel wird gelöscht.',
  'library.lyrics.remove.askKept':
    'Die Kopie dieses Songtexts entfernen, die FluidEQ für diesen Titel aufbewahrt?',
  'library.lyrics.remove.busy': 'Songtext wird entfernt…',
  'library.lyrics.remove.confirm': 'Entfernen',
  'library.lyrics.remove.keep': 'Behalten',
  'library.lyrics.remove.inSong':
    'Dieser Songtext steckt in der Datei des Titels selbst. FluidEQ verändert Ihre Titel nie, deshalb lässt er sich hier nicht entfernen.',
  'library.lyrics.remove.failed': 'Der Songtext konnte nicht entfernt werden.',
  'library.lyrics.remove.understood': 'OK',

  'karaoke.maker.song.save': 'In Bibliothek speichern',
  'karaoke.maker.song.saveHint':
    'Dieses Timing als Songtext des Titels in der Bibliothek speichern',
  'karaoke.maker.song.openedTimed':
    'Mit dem synchronisierten Songtext des Titels aus der Bibliothek geöffnet.',
  'karaoke.maker.song.keptTimed':
    'Sie hatten schon ein Karaoke dieses Titels begonnen, deshalb ist es so geöffnet, wie Sie es verlassen haben. „Original wiederherstellen“ beginnt neu mit dem Songtext des Titels.',
  'karaoke.maker.song.keptPlain':
    'Sie hatten schon ein Karaoke dieses Titels begonnen, deshalb ist es so geöffnet, wie Sie es verlassen haben. Der Songtext des Titels steht im Editor, falls Sie lieber ihn verwenden möchten.',
  'karaoke.maker.song.savedBeside': 'Neben dem Titel als {name} gespeichert.',
  'karaoke.maker.song.savedKept':
    'Im Songtext-Ordner von FluidEQ gespeichert: Der Ordner des Titels lässt sich nicht beschreiben.',
  'karaoke.maker.song.untimedLeftOut':
    'Zeilen ohne Timing wurden weggelassen ({lines}).',
  'karaoke.maker.song.tagsFirst':
    'Die Tags des Titels enthalten ebenfalls einen synchronisierten Songtext, und die Bibliothek zeigt diesen zuerst.',
  'karaoke.maker.song.nothingTimed':
    'Noch nichts zu speichern: Keine Zeile hat eine Zeit.',
  'karaoke.maker.song.failed':
    'Der Songtext konnte nicht im Titel gespeichert werden.',
  'karaoke.maker.song.gone': 'Dieser Titel ist nicht mehr in der Bibliothek.',
  'karaoke.maker.song.replaceTitle': '{name} ersetzen?',
  'karaoke.maker.song.replaceKeptTitle': 'Die Kopie von FluidEQ ersetzen?',
  'karaoke.maker.song.replaceBody':
    'Der Titel hat bereits einen Songtext in {name}. Er wird durch das Timing aus dem Editor ersetzt.',
  'karaoke.maker.song.replaceKeptBody':
    'FluidEQ bewahrt für diesen Titel bereits einen Songtext auf. Er wird durch das Timing aus dem Editor ersetzt.',
  'karaoke.maker.song.replace': 'Ersetzen',
} as const;

export default lyricsHandoff;
