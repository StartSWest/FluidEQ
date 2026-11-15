const lyricsHandoff = {
  'library.lyrics.karaoke.open': 'Ouvrir dans Karaoké',
  'library.lyrics.karaoke.opening': 'Ouverture…',
  'library.lyrics.karaoke.hintTimed':
    'Commencer un karaoké à partir de ces paroles synchronisées et corriger leur synchronisation dans le créateur',
  'library.lyrics.karaoke.hintPlain':
    'Commencer un karaoké à partir de ces paroles et les synchroniser dans le créateur',
  'library.lyrics.karaoke.failed': 'Impossible d’ouvrir ce titre dans Karaoké.',
  'library.lyrics.remove.button': 'Supprimer les paroles',
  'library.lyrics.remove.askFile':
    'Supprimer {name} ? Le fichier de paroles à côté du titre est effacé.',
  'library.lyrics.remove.askKept':
    'Supprimer la copie de ces paroles que FluidEQ conserve pour ce titre ?',
  'library.lyrics.remove.busy': 'Suppression des paroles…',
  'library.lyrics.remove.confirm': 'Supprimer',
  'library.lyrics.remove.keep': 'Conserver',
  'library.lyrics.remove.inSong':
    'Ces paroles se trouvent dans le fichier même du titre. FluidEQ ne modifie jamais vos titres, elles ne peuvent donc pas être supprimées ici.',
  'library.lyrics.remove.failed': 'Impossible de supprimer les paroles.',
  'library.lyrics.remove.understood': 'OK',

  'karaoke.maker.song.save': 'Enregistrer dans la bibliothèque',
  'karaoke.maker.song.saveHint':
    'Enregistrer cette synchronisation comme paroles du titre dans la bibliothèque',
  'karaoke.maker.song.openedTimed':
    'Ouvert avec les paroles synchronisées du titre depuis la bibliothèque.',
  'karaoke.maker.song.keptTimed':
    'Vous aviez déjà commencé un karaoké de ce titre : il s’est ouvert tel que vous l’avez laissé. « Restaurer l’original » recommence à partir des paroles du titre.',
  'karaoke.maker.song.keptPlain':
    'Vous aviez déjà commencé un karaoké de ce titre : il s’est ouvert tel que vous l’avez laissé. Les paroles du titre sont dans l’éditeur si vous préférez les utiliser.',
  'karaoke.maker.song.savedBeside': 'Enregistrées à côté du titre sous {name}.',
  'karaoke.maker.song.savedKept':
    'Enregistrées dans le dossier de paroles de FluidEQ : impossible d’écrire dans le dossier du titre.',
  'karaoke.maker.song.untimedLeftOut':
    'Les lignes sans synchronisation ont été laissées de côté ({lines}).',
  'karaoke.maker.song.tagsFirst':
    'Les tags du titre contiennent aussi des paroles synchronisées, et la bibliothèque affiche celles-ci en premier.',
  'karaoke.maker.song.nothingTimed':
    'Rien à enregistrer pour l’instant : aucune ligne n’a de temps.',
  'karaoke.maker.song.failed':
    'Impossible d’enregistrer les paroles dans le titre.',
  'karaoke.maker.song.gone': 'Ce titre n’est plus dans la bibliothèque.',
  'karaoke.maker.song.replaceTitle': 'Remplacer {name} ?',
  'karaoke.maker.song.replaceKeptTitle': 'Remplacer la copie de FluidEQ ?',
  'karaoke.maker.song.replaceBody':
    'Le titre a déjà des paroles dans {name}. Elles seront remplacées par la synchronisation du créateur.',
  'karaoke.maker.song.replaceKeptBody':
    'FluidEQ conserve déjà des paroles pour ce titre. Elles seront remplacées par la synchronisation du créateur.',
  'karaoke.maker.song.replace': 'Remplacer',
} as const;

export default lyricsHandoff;
