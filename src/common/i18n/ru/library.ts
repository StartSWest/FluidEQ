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
  'library.rescan.force': 'Принудительное сканирование',
  'library.search': 'Поиск по библиотеке',
  'library.searchPlaceholder': 'Поиск песен, исполнителей, альбомов',

  'library.browse.album': 'Альбомы',
  'library.browse.artist': 'Исполнители',
  'library.browse.genre': 'Жанры',
  'library.browse.song': 'Песни',
  'library.browse.folder': 'Папки',
  'library.browse.directory': 'Дерево',
  'library.browse.folderHint': 'Все папки с музыкой сразу',
  'library.browse.directoryHint': 'От корневой папки внутрь',
  'library.browse.folderReading': 'Как показывать папки',
  'library.jumpTo': 'Перейти к букве',
  'library.coverflow.previous': 'Предыдущая обложка',
  'library.coverflow.next': 'Следующая обложка',
  'library.folderCount': 'Папок: {count}',
  'library.filterHere': 'Фильтр по этим песням',
  'library.view.list': 'Список',
  'library.view.grid': 'Сетка',
  'library.view.coverflow': 'Cover Flow',
  'library.view.aria': 'Как отображается библиотека',
  'library.browse.aria': 'Что показывает библиотека',

  'library.sort': 'Сортировка',
  'library.sortBy': 'Сортировка: {value}',
  'library.sort.direction': 'Направление сортировки',
  'library.sort.title': 'Название',
  'library.sort.artist': 'Исполнитель',
  'library.sort.album': 'Альбом',
  'library.sort.year': 'Год',
  'library.sort.added': 'Недавно добавленные',
  'library.sort.track': 'Порядок на диске',

  'library.column.title': 'Название',
  'library.column.artist': 'Исполнитель',
  'library.column.album': 'Альбом',
  'library.column.year': 'Год',
  'library.column.length': 'Длительность',
  'library.column.trackNo': 'Номер трека',

  'library.unknownAlbum': 'Неизвестный альбом',
  'library.unknownArtist': 'Неизвестный исполнитель',
  'library.genre.unknown': 'Неизвестный жанр',
  'library.trackCount': '{count} песен',
  'library.albumCount': '{count} альбомов',
  'library.artistCount': '{count} исполнителей',

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
  'library.trackMenu': 'Другие действия',

  'library.unplayable': 'FluidEQ не может воспроизвести этот формат',
  'library.metadataError': 'FluidEQ не смог прочитать теги этого файла.',
  'library.pending': 'Этот файл найден, и его данные ещё считываются.',
  'library.indexReset':
    'Индекс библиотеки не удалось прочитать, и он был перестроен.',

  'library.back': 'Назад',

  'library.upNext': 'Далее',
  'library.upNext.empty': 'В очереди пока пусто',
  'library.upNext.added': 'Ваш выбор',
  'library.upNext.rest': 'Затем',
  'library.upNext.continued': 'Похожее',
  'library.upNext.keepPlaying': 'Продолжать воспроизведение',
  'library.upNext.keepPlayingHint':
    'Когда очередь закончится, продолжить музыкой того же жанра',
  'library.queueAdd': 'Добавить в очередь',

  'library.alsoInFolder': 'В этой папке, но не в этом альбоме',
  'library.play': 'Воспроизвести',
  'library.pause': 'Пауза',
  'library.stop': 'Стоп',
  'library.previous': 'Предыдущий',
  'library.back5': 'Назад на 5 секунд',
  'library.forward5': 'Вперёд на 5 секунд',
  'library.next': 'Следующий',
  'library.shuffle': 'Перемешать',
  'library.repeat': 'Повтор',
  'library.repeat.all': 'Повторять всё',
  'library.repeat.one': 'Повторять эту песню',
  'library.repeat.off': 'Не повторять',
  'library.volume': 'Громкость',
  'library.mute': 'Выключить звук',
  'library.unmute': 'Включить звук',
  'library.playbackOptions': 'Параметры воспроизведения',
  'library.position': 'Позиция',
  'library.queue': 'Очередь',
  'library.queue.remove': 'Удалить из очереди',
  'library.nowPlaying': 'Сейчас играет',
  'library.nothingPlaying': 'Ничего не играет',
  'library.nothingPlayingHint': 'Выберите, что послушать',
  'library.systemAudio': 'Звук системы',
  'library.remoteAudio': 'Удалённое воспроизведение · {name}',

  'library.trackActions': 'Что сделать с этой песней',
  'library.browse.playlist': 'Плейлисты',
  'library.playlist.favorites': 'Избранное',
  'library.playlist.addToFavorites': 'Добавить в Избранное',
  'library.playlist.removeFromFavorites': 'Убрать из Избранного',
  'library.playlist.favorite': 'В вашем Избранном',
  'library.playlist.addTo': 'Добавить в плейлист',
  'library.playlist.alreadyIn': 'Уже в этом плейлисте',
  'library.playlist.removeFrom': 'Убрать из этого плейлиста',
  'library.playlist.new': 'Новый плейлист',
  'library.playlist.newName': 'Название плейлиста',
  'library.playlist.create': 'Создать',
  'library.playlist.rename': 'Переименовать',
  'library.playlist.keep': 'Оставить',
  'library.playlist.delete': 'Удалить плейлист',
  'library.playlist.deleteConfirm':
    'Удалить «{name}»? Песни останутся в вашей библиотеке.',
  'library.playlist.builtIn': 'Избранное есть всегда, и его нельзя удалить',
  'library.playlist.songCount': 'Песен: {count}',
  'library.playlist.songCountOne': '1 песня',
  'library.playlist.empty': 'В этом плейлисте пока ничего нет',
  'library.playlist.emptyHint':
    'Нажмите на песню правой кнопкой и выберите «Добавить в плейлист».',
  'library.playlist.missing':
    'Песен из этого плейлиста сейчас нет в библиотеке: {count}',
  'library.playlist.reset':
    'Не удалось прочитать ваши плейлисты, они были сброшены.',
  'library.karaoke.send': 'Отправить в Караоке',
  'library.karaoke.sending': 'Отправляем в Караоке…',
  'library.karaoke.failed':
    'Не удалось отправить этот файл в Караоке — возможно, он слишком большой или нечитаемый.',
};

export default library;
