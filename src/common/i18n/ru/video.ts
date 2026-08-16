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

/** The Remote Media tab. */
import { Dictionary } from '../en';

const video: Partial<Dictionary> = {
  'video.sites': 'Видеосайты',
  'video.back': 'Назад',
  'video.forward': 'Вперёд',
  'video.reload': 'Обновить',
  'video.stop': 'Остановить',
  'video.searchAria': 'Поиск по текущему сайту',
  'video.searchOn': 'Поиск на {site}',
  'video.searchGo': 'Найти',
  'video.searchClear': 'Очистить поиск',
  'video.searchRecent': 'Недавние запросы',
  'video.searchForget': 'Забыть «{term}»',
  'video.searchForgetAll': 'Очистить недавние запросы',
  'video.adBlock': 'Блокировать рекламу',
  'video.adBlockHint':
    'Пропускает рекламу в видео и скрывает рекламные блоки на YouTube.',
  'video.signOut': 'Выйти со всех сайтов',
  'video.signOutBusy': 'Выход…',
  'video.signOutHint':
    'Удаляет все файлы cookie, сохранённые входы и кешированные страницы плеера.',
  'video.signOutDone': 'Выход выполнен',
  'video.signOutFailed': 'Не удалось выйти',
  'video.blockedTitle': 'Эта ссылка ведёт за пределы плеера',
  'video.openInBrowser': 'Открыть в браузере',
  'video.downloadChoosing': 'Выберите место сохранения файла',
  'video.downloadSaving': 'Сохранение {file}',
  'video.downloadComplete': 'Сохранено на компьютере',
  'video.downloadFailed': 'Не удалось сохранить загрузку',
  'video.downloadProgress': 'Ход загрузки',
  'video.downloadCopyPath': 'Копировать путь',
  'video.downloadCopied': 'Путь скопирован',
  'video.downloadShowFolder': 'Показать в папке',
  'video.resize': 'Потяните, чтобы изменить размер плеера',
};

export default video;
