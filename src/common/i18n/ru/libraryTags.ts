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

/**
 * The Library's tag editor. See `../en/libraryTags.ts`. Counts are written
 * as "Файлов: N", which reads right for every number.
 */
const libraryTags = {
  'library.tags.menu.edit': 'Изменить теги…',
  'library.tags.menu.editMany': 'Изменить теги песен ({count})…',
  'library.tags.menu.editAlbum': 'Изменить теги альбома…',
  'library.tags.menu.cover': 'Сменить обложку…',
  'library.tags.menu.shortcut': 'Ctrl+I',
  'library.tags.selection.count': 'Песен: {count}',
  'library.tags.selection.edit': 'Изменить теги',
  'library.tags.selection.clear': 'Снять выделение',

  'library.tags.field.title': 'Название',
  'library.tags.field.artist': 'Исполнитель',
  'library.tags.field.composer': 'Композитор',
  'library.tags.field.album': 'Альбом',
  'library.tags.field.albumArtist': 'Исполнитель альбома',
  'library.tags.field.trackNo': 'Трек',
  'library.tags.field.trackTotal': 'Всего треков',
  'library.tags.field.discNo': 'Диск',
  'library.tags.field.discTotal': 'Всего дисков',
  'library.tags.field.year': 'Год',
  'library.tags.field.genre': 'Жанр',
  'library.tags.field.bpm': 'BPM',
  'library.tags.field.comment': 'Комментарий',
  'library.tags.field.grouping': 'Группировка',
  'library.tags.field.publisher': 'Лейбл',
  'library.tags.field.copyright': 'Авторские права',
  'library.tags.field.isrc': 'ISRC',
  'library.tags.field.conductor': 'Дирижёр',
  'library.tags.field.subtitle': 'Подзаголовок',
  'library.tags.field.remixer': 'Ремикс',
  'library.tags.field.initialKey': 'Тональность',
  'library.tags.field.compilation': 'Сборник',
  'library.tags.field.titleSort': 'Сортировка названия',
  'library.tags.field.artistSort': 'Сортировка исполнителя',
  'library.tags.field.albumSort': 'Сортировка альбома',
  'library.tags.field.albumArtistSort': 'Сортировка исполнителя альбома',
  'library.tags.field.composerSort': 'Сортировка композитора',
  'library.tags.field.musicBrainzTrackId': 'Запись в MusicBrainz',
  'library.tags.field.musicBrainzReleaseId': 'Релиз в MusicBrainz',
  'library.tags.field.musicBrainzArtistId': 'Исполнитель в MusicBrainz',
  'library.tags.field.musicBrainzReleaseArtistId':
    'Исполнитель альбома в MusicBrainz',
  'library.tags.field.musicBrainzReleaseGroupId':
    'Группа релизов в MusicBrainz',

  'library.tags.panel.title': 'Изменить теги',
  'library.tags.panel.position': '{index} из {count}',
  'library.tags.panel.previous': 'Предыдущая песня (Alt+↑)',
  'library.tags.panel.next': 'Следующая песня (Alt+↓)',
  'library.tags.panel.close': 'Закрыть (Esc): правки сохранятся',
  'library.tags.panel.reading': 'Чтение тегов файла…',
  'library.tags.panel.readFailed':
    'Не удалось прочитать теги этого файла. Возможно, он повреждён или занят.',
  'library.tags.panel.missing': 'Этой песни больше нет на диске.',
  'library.tags.panel.unsupported':
    'FluidEQ не изменяет теги файлов этого типа.',
  'library.tags.group.song': 'Песня',
  'library.tags.group.album': 'Альбом',
  'library.tags.group.details': 'Подробности',
  'library.tags.group.file': 'Файл',
  'library.tags.of': 'из',
  'library.tags.sameAsArtist': 'Как у исполнителя',
  'library.tags.putBack': 'Вернуть',
  'library.tags.noArtist': 'Без исполнителя',
  'library.tags.noAlbum': 'Без альбома',
  'library.tags.genre.inLibrary': 'В вашей библиотеке',
  'library.tags.tip.fileName':
    'Название — это имя файла. Использовать «{title}»?',
  'library.tags.tip.fileNameTrack':
    'Название — это имя файла. Использовать «{title}», трек {track}?',
  'library.tags.tip.use': 'Использовать',

  'library.tags.cover.dropHint': 'Перетащите или вставьте изображение',
  'library.tags.cover.facts': '{width} × {height} · {kind} · {size}',
  'library.tags.cover.factsShort': '{kind} · {size}',
  'library.tags.cover.none': 'В этом файле нет обложки',
  'library.tags.cover.new': 'Новая обложка · {width} × {height}',
  'library.tags.cover.removed': 'Обложка будет удалена при сохранении',
  'library.tags.cover.refused':
    'Только изображение JPEG или PNG размером до 20 МБ.',
  'library.tags.cover.emptyClipboard': 'В буфере обмена нет изображения.',

  'library.tags.more.toggle': 'Другие поля',
  'library.tags.more.count': 'В этом файле: {count} · можно добавить любое',
  'library.tags.more.countNone': 'можно добавить любое',
  'library.tags.more.add': 'Добавить поле',
  'library.tags.more.addHint':
    'Любое поле, которое допускает формат, по его коду.',
  'library.tags.more.code': 'Код',
  'library.tags.more.value': 'Значение',
  'library.tags.more.addConfirm': 'Добавить',
  'library.tags.more.badCode':
    'Формат этого файла не может хранить этот код как текст.',

  'library.tags.file.format': 'Формат',
  'library.tags.file.tags': 'Теги в файле',
  'library.tags.file.noTags': 'Нет тегов',
  'library.tags.file.writeAs': 'Записать как',
  'library.tags.file.keep': 'Оставить {version}',
  'library.tags.file.v23Note':
    'v2.3 лучше всего читают Проводник Windows, автомагнитолы и старые плееры. v2.4 хранит UTF-8 и несколько значений в поле.',
  'library.tags.file.v24Note':
    'Проводник Windows и некоторые автомагнитолы плохо читают v2.4; v2.3 — надёжный выбор, если файл будут переносить.',
  'library.tags.file.id3v1': 'Обновлять и старый тег ID3v1',
  'library.tags.file.readOnly':
    'Файл доступен только для чтения. Перед записью вас спросят.',

  'library.tags.foot.none': 'Нет изменений',
  'library.tags.foot.noneHint':
    'Правки сохраняются, пока вы переходите по альбому',
  'library.tags.foot.changes': 'Несохранённых изменений: {count}',
  'library.tags.foot.changesOne': '1 несохранённое изменение',
  'library.tags.foot.inSongs': 'песен: {count}',
  'library.tags.foot.inSongsOne': 'в 1 песне',
  'library.tags.revert': 'Отменить правки',
  'library.tags.save': 'Сохранить',
  'library.tags.saveSongs': 'Сохранить песни ({count})',
  'library.tags.saveFailed':
    'Некоторые значения не удалось записать в таком виде. Проверьте отмеченные поля.',

  'library.tags.set.reading': 'Чтение тегов · {done} из {count}',
  'library.tags.set.use': 'Использовать «{value}»',
  'library.tags.set.coversMixed': 'Разных обложек: {count}',
  'library.tags.set.coversNone': 'Без обложки: {count}',
  'library.tags.set.coverOne': 'Одна обложка для всех',
  'library.tags.set.coverNoneAll': 'Ни у одной песни нет обложки',
  'library.tags.set.coverToAll': 'Для всех песен ({count})',
  'library.tags.set.songs': 'Песни',
  'library.tags.set.renumber': 'Пронумеровать по порядку',
  'library.tags.set.fixAuto': 'Исправить автоматически',
  'library.tags.set.moreFields': 'Другие поля ({fields})',
  'library.tags.set.varies': 'Разное:',
  'library.tags.set.variesPlaceholder': 'Разное · введите одно для всех',
  'library.tags.set.useForAll': 'Использовать для всех песен ({count})',
  'library.tags.set.found': 'Найдено песен: {count}',
  'library.tags.set.foundOne': 'Найдена 1 песня',
  'library.tags.set.foundNone': 'Ни в одном названии этого нет',
  'library.tags.cover.change': 'Сменить обложку',
  'library.tags.cover.changeShort': 'Сменить',
  'library.tags.cover.chooseImage': 'Выбрать изображение…',
  'library.tags.cover.pasteImage': 'Вставить из буфера обмена',
  'library.tags.cover.removeCover': 'Убрать обложку',
  'library.tags.set.find': 'Найти в названиях',
  'library.tags.set.replaceWith': 'Заменить на',
  'library.tags.set.replaceAll': 'Заменить все',
  'library.tags.set.sheetHint':
    'Enter — вниз · Tab — вправо · Ctrl+D копирует ячейку сверху · перетащите строку за ручку, чтобы изменить порядок, затем пронумеруйте.',
  'library.tags.set.col.no': '№',
  'library.tags.set.col.time': 'Длительность',
  'library.tags.set.grip': 'Перетащите, чтобы изменить порядок',
  'library.tags.set.missingCell': 'нет',
  'library.tags.set.groupSongs': 'песен: {count}',
  'library.tags.set.changes': 'Изменений: {count}',
  'library.tags.set.changesOne': '1 изменение',
  'library.tags.set.files': 'Файлов: {count} · пока ничего не записано',
  'library.tags.set.filesOne': '1 файл · пока ничего не записано',
  'library.tags.set.discard': 'Отменить',
  'library.tags.set.back': 'Назад',
  'library.tags.set.leaveAsk': 'Выйти, не сохранив эти изменения?',
  'library.tags.set.keepEditing': 'Продолжить',
  'library.tags.set.unreadable':
    'Не удалось прочитать песни ({count}), они не включены.',

  'library.tags.write.progress': 'Запись тегов · {done} из {count}',
  'library.tags.write.undoing': 'Возврат тегов · {done} из {count}',
  'library.tags.write.background': 'Продолжить в фоне',
  'library.tags.write.show': 'Показать',
  'library.tags.write.cancel': 'Отмена',
  'library.tags.write.written': 'Записано {done} из {count}',
  'library.tags.write.needYou': 'Требуют внимания: {count}',
  'library.tags.write.review': 'Посмотреть файлы ({count})',
  'library.tags.write.reviewOne': 'Посмотреть 1 файл',
  'library.tags.write.done': 'Обновлено файлов: {count}',
  'library.tags.write.doneOne': '1 файл обновлён',
  'library.tags.write.doneNote':
    'Прежние теги сохранены — «Отменить» вернёт их все.',
  'library.tags.write.undo': 'Отменить',
  'library.tags.write.undone': 'Отменено',
  'library.tags.write.undoneNote':
    'У каждого файла снова прежние теги, включая обложку.',
  'library.tags.write.stopped': 'Остановлено после {done} из {count}',
  'library.tags.write.stoppedNote':
    'Уже записанные файлы сохраняют новые теги; «Отменить» вернёт прежние.',
  'library.tags.write.failed': 'Не удалось записать: {count}',
  'library.tags.write.failedOne': '1 не удалось записать',
  'library.tags.write.dismiss': 'Закрыть',
  'library.tags.problems.title': 'Требуют внимания: {count}',
  'library.tags.problems.titleOne': '1 файл требует внимания',
  'library.tags.problems.allHandled': 'Всё решено',
  'library.tags.problems.waiting': 'Ждут конца песни: {count}',
  'library.tags.problems.waitingOne': '1 ждёт конца песни',
  'library.tags.problems.held':
    'Сейчас играет в FluidEQ — будет записан, как только песня закончится.',
  'library.tags.problems.locked':
    'Открыт в другой программе. Закройте его там и повторите.',
  'library.tags.problems.readOnly':
    'Файл доступен только для чтения, поэтому изменить его так нельзя.',
  'library.tags.problems.failed':
    'Не удалось записать этот файл. Он не изменился, ничего не потеряно.',
  'library.tags.problems.missing':
    'Этого файла больше нет там, где его нашла библиотека.',
  'library.tags.problems.retry': 'Повторить',
  'library.tags.problems.skip': 'Пропустить',
  'library.tags.problems.makeWritable': 'Разрешить запись и записать',
  'library.tags.problems.skipAll': 'Пропустить все',
  'library.tags.problems.nothingToDo': 'Ничего делать не нужно.',
  'library.tags.problems.everythingElse': 'Всё остальное записано',
  'library.tags.problems.undoCovers': '«Отменить» действует и на них',
  'library.tags.menu.fix': 'Исправить теги автоматически…',
  'library.tags.menu.fixAlbum': 'Исправить этот альбом…',
  'library.tags.menu.fixShortcut': 'Ctrl+Shift+I',
  'library.tags.hero.fix': 'Исправить теги',
  'library.tags.selection.fix': 'Исправить',
  'library.tags.fix.empty': 'пусто',
  'library.tags.fix.albums': 'Альбомов: {count}',
  'library.tags.fix.albumChanges': 'Изменений: {count}',
  'library.tags.fix.albumChangesOne': '1 изменение',
  'library.tags.fix.nothingFound':
    'FluidEQ не нашёл в этих песнях ничего, что нужно исправить.',
  'library.tags.fix.noPicture':
    'Не удалось использовать изображение из папки альбома.',
  'library.tags.fix.filled':
    'FluidEQ дополнил недостающее. Изменённое выделено цветом, старое значение зачёркнуто рядом: проверьте и сохраните или отмените.',
  'library.tags.fix.fixAlbum': 'Исправить',
  'library.tags.fix.openAlbum': 'Открыть',
  'library.tags.fix.editByHand': 'Править всё вручную',
  'library.tags.fix.albumComplete': 'Готово',
  'library.tags.changes.title': 'Изменения',
  'library.tags.changes.none':
    'Изменений пока нет. Всё, что вы измените, появится здесь до сохранения.',
  'library.tags.changes.album': 'Для всего альбома',
  'library.tags.changes.songs': 'По песням',
  'library.tags.changes.removed': 'удаляется',
  'library.tags.changes.cover': 'Обложка',
  'library.tags.changes.coverNew': 'Новое изображение',
  'library.tags.changes.coverRemoved': 'Удаляется',
  'library.tags.cover.useOne': 'Одну для всех песен',
  'library.tags.cover.useThis': 'Эту обложку для всех песен',
  'library.tags.write.undoAsk': 'Вернуть прежние теги файлов: {count}?',
  'library.tags.write.undoAskOne': 'Вернуть прежние теги 1 файла?',
  'library.tags.write.undoKeep': 'Нет',
  'library.tags.write.undoConfirm': 'Отменить',
};

export default libraryTags;
