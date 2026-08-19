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
  'tabs.library': 'Библиотека',

  'library.empty.title': 'Музыки пока нет',
  'library.empty.body':
    'Добавьте папку, и FluidEQ прочитает песни и видео внутри неё.',
  'library.empty.add': 'Добавить папку',
  'library.empty.drop': 'или перетащите папку сюда',
  'library.karaokeSkipped':
    '{count} песен караоке пропущено — откройте их на вкладке Караоке',

  'library.add': 'Добавить папку',
  'library.rescan': 'Пересканировать',
  'library.search': 'Поиск по библиотеке',
  'library.searchPlaceholder': 'Поиск песен, исполнителей, альбомов',

  'library.browse.album': 'Альбомы',
  'library.browse.artist': 'Исполнители',
  'library.browse.song': 'Песни',
  'library.view.list': 'Список',
  'library.view.grid': 'Сетка',
  'library.view.coverflow': 'Cover Flow',
  'library.view.aria': 'Как отображается библиотека',
  'library.browse.aria': 'Что показывает библиотека',

  'library.sort': 'Сортировка',
  'library.sort.title': 'Название',
  'library.sort.artist': 'Исполнитель',
  'library.sort.album': 'Альбом',
  'library.sort.year': 'Год',
  'library.sort.added': 'Недавно добавленные',

  'library.column.title': 'Название',
  'library.column.artist': 'Исполнитель',
  'library.column.album': 'Альбом',
  'library.column.year': 'Год',
  'library.column.length': 'Длительность',

  'library.unknownAlbum': 'Неизвестный альбом',
  'library.unknownArtist': 'Неизвестный исполнитель',
  'library.trackCount': '{count} песен',
  'library.albumCount': '{count} альбомов',

  'library.videos': 'Видео',
  'library.videos.empty': 'В добавленных папках нет видео.',

  'library.scan.running': 'Чтение {name}',
  'library.scan.counted': '{parsed} из {seen} файлов',
  'library.scan.cancel': 'Остановить',
  'library.scan.background': 'Продолжить в фоне',
  'library.scan.done': 'Добавлено {count} песен',

  'library.roots': 'Папки',
  'library.root.remove': 'Удалить эту папку',
  'library.root.offline': 'Эта папка сейчас недоступна',
  'library.reveal': 'Показать в проводнике',

  'library.unplayable': 'FluidEQ не может воспроизвести этот формат',
  'library.indexReset':
    'Индекс библиотеки не удалось прочитать, и он был перестроен.',

  'library.play': 'Воспроизвести',
  'library.pause': 'Пауза',
  'library.previous': 'Предыдущий',
  'library.next': 'Следующий',
  'library.shuffle': 'Перемешать',
  'library.repeat': 'Повтор',
  'library.repeat.all': 'Повторять всё',
  'library.repeat.one': 'Повторять эту песню',
  'library.repeat.off': 'Не повторять',
  'library.volume': 'Громкость',
  'library.position': 'Позиция',
  'library.queue': 'Очередь',
  'library.queue.remove': 'Удалить из очереди',
  'library.nowPlaying': 'Сейчас играет',
  'library.fullScreen': 'Полный экран',
};

export default library;
