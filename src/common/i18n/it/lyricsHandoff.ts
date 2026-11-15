const lyricsHandoff = {
  'library.lyrics.karaoke.open': 'Apri in Karaoke',
  'library.lyrics.karaoke.opening': 'Apertura…',
  'library.lyrics.karaoke.hintTimed':
    'Inizia un karaoke da questo testo sincronizzato e correggi la sincronizzazione nel creatore',
  'library.lyrics.karaoke.hintPlain':
    'Inizia un karaoke da questo testo e sincronizzalo nel creatore',
  'library.lyrics.karaoke.failed':
    'Impossibile aprire questo brano in Karaoke.',
  'library.lyrics.remove.button': 'Rimuovi il testo',
  'library.lyrics.remove.askFile':
    'Rimuovere {name}? Il file del testo accanto al brano viene eliminato.',
  'library.lyrics.remove.askKept':
    'Rimuovere la copia di questo testo che FluidEQ conserva per il brano?',
  'library.lyrics.remove.busy': 'Rimozione del testo…',
  'library.lyrics.remove.confirm': 'Rimuovi',
  'library.lyrics.remove.keep': 'Mantieni',
  'library.lyrics.remove.inSong':
    'Questo testo è dentro il file stesso del brano. FluidEQ non modifica mai i tuoi brani, quindi non si può rimuovere qui.',
  'library.lyrics.remove.failed': 'Impossibile rimuovere il testo.',
  'library.lyrics.remove.understood': 'OK',

  'karaoke.maker.song.save': 'Salva nella libreria',
  'karaoke.maker.song.saveHint':
    'Salva questa sincronizzazione come testo del brano nella libreria',
  'karaoke.maker.song.openedTimed':
    'Aperto con il testo sincronizzato del brano dalla libreria.',
  'karaoke.maker.song.keptTimed':
    'Stavi già creando un karaoke di questo brano, quindi si è aperto come l’avevi lasciato. «Ripristina originale» ricomincia dal testo del brano.',
  'karaoke.maker.song.keptPlain':
    'Stavi già creando un karaoke di questo brano, quindi si è aperto come l’avevi lasciato. Il testo del brano è nell’editor, se preferisci usarlo.',
  'karaoke.maker.song.savedBeside': 'Salvato accanto al brano come {name}.',
  'karaoke.maker.song.savedKept':
    'Salvato nella cartella dei testi di FluidEQ: non si può scrivere nella cartella del brano.',
  'karaoke.maker.song.untimedLeftOut':
    'Le righe senza sincronizzazione sono state escluse ({lines}).',
  'karaoke.maker.song.tagsFirst':
    'Anche i tag del brano contengono un testo sincronizzato, e la libreria mostra prima quello.',
  'karaoke.maker.song.nothingTimed':
    'Ancora niente da salvare: nessuna riga ha un tempo.',
  'karaoke.maker.song.failed': 'Impossibile salvare il testo nel brano.',
  'karaoke.maker.song.gone': 'Questo brano non è più nella libreria.',
  'karaoke.maker.song.replaceTitle': 'Sostituire {name}?',
  'karaoke.maker.song.replaceKeptTitle': 'Sostituire la copia di FluidEQ?',
  'karaoke.maker.song.replaceBody':
    'Il brano ha già un testo in {name}. Verrà sostituito dalla sincronizzazione del creatore.',
  'karaoke.maker.song.replaceKeptBody':
    'FluidEQ conserva già un testo per questo brano. Verrà sostituito dalla sincronizzazione del creatore.',
  'karaoke.maker.song.replace': 'Sostituisci',
} as const;

export default lyricsHandoff;
