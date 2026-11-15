const lyricsHandoff = {
  'library.lyrics.karaoke.open': 'Открыть в караоке',
  'library.lyrics.karaoke.opening': 'Открывается…',
  'library.lyrics.karaoke.hintTimed':
    'Начать караоке с этого синхронизированного текста и поправить тайминг в редакторе',
  'library.lyrics.karaoke.hintPlain':
    'Начать караоке с этого текста и синхронизировать его в редакторе',
  'library.lyrics.karaoke.failed': 'Не удалось открыть эту песню в караоке.',
  'library.lyrics.remove.button': 'Удалить текст',
  'library.lyrics.remove.askFile':
    'Удалить {name}? Файл с текстом рядом с песней будет стёрт.',
  'library.lyrics.remove.askKept':
    'Удалить копию этого текста, которую FluidEQ хранит для песни?',
  'library.lyrics.remove.busy': 'Текст удаляется…',
  'library.lyrics.remove.confirm': 'Удалить',
  'library.lyrics.remove.keep': 'Оставить',
  'library.lyrics.remove.inSong':
    'Этот текст хранится в самом файле песни. FluidEQ никогда не изменяет ваши песни, поэтому здесь его удалить нельзя.',
  'library.lyrics.remove.failed': 'Не удалось удалить текст.',
  'library.lyrics.remove.understood': 'Понятно',

  'karaoke.maker.song.save': 'Сохранить в библиотеку',
  'karaoke.maker.song.saveHint':
    'Сохранить этот тайминг как текст песни в библиотеке',
  'karaoke.maker.song.openedTimed':
    'Открыто с синхронизированным текстом песни из библиотеки.',
  'karaoke.maker.song.keptTimed':
    'Вы уже делали караоке этой песни, поэтому оно открылось таким, каким вы его оставили. «Восстановить оригинал» начинает заново с текста песни.',
  'karaoke.maker.song.keptPlain':
    'Вы уже делали караоке этой песни, поэтому оно открылось таким, каким вы его оставили. Текст песни — в редакторе, если хотите взять его.',
  'karaoke.maker.song.savedBeside': 'Сохранено рядом с песней как {name}.',
  'karaoke.maker.song.savedKept':
    'Сохранено в папке текстов FluidEQ: в папку песни нельзя записывать.',
  'karaoke.maker.song.untimedLeftOut':
    'Строки без тайминга не вошли ({lines}).',
  'karaoke.maker.song.tagsFirst':
    'В тегах песни тоже есть синхронизированный текст, и библиотека показывает сначала его.',
  'karaoke.maker.song.nothingTimed':
    'Пока нечего сохранять: ни у одной строки нет времени.',
  'karaoke.maker.song.failed': 'Не удалось сохранить текст в песню.',
  'karaoke.maker.song.gone': 'Этой песни больше нет в библиотеке.',
  'karaoke.maker.song.replaceTitle': 'Заменить {name}?',
  'karaoke.maker.song.replaceKeptTitle': 'Заменить копию FluidEQ?',
  'karaoke.maker.song.replaceBody':
    'У песни уже есть текст в {name}. Он будет заменён таймингом из редактора.',
  'karaoke.maker.song.replaceKeptBody':
    'FluidEQ уже хранит текст для этой песни. Он будет заменён таймингом из редактора.',
  'karaoke.maker.song.replace': 'Заменить',
} as const;

export default lyricsHandoff;
