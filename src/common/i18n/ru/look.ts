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

/** The Look Designer, the support panel, the creature and its game. */
import { Dictionary } from '../en';

const look: Partial<Dictionary> = {
  'look.edit': 'Изменить оформление',
  'look.create': 'Создать оформление',
  'look.new': 'Новое оформление',
  'look.close': 'Закрыть редактор оформления',
  'look.closeHint': 'Закрыть без сохранения (Esc)',
  'look.pickForm': 'Выберите форму сверху или нажмите Пробел.',
  'look.colourBy': 'Раскрашивать по',
  'look.palette.cycle': 'Раскраска',
  'look.palette.flat': 'Однотонно',
  'look.palette.flatHint': 'Один цвет для всей фигуры',
  'look.palette.frequency': 'Частота',
  'look.palette.frequencyHint':
    'Цвет идёт вдоль оси и показывает положение каждой полосы.',
  'look.palette.level': 'Уровень',
  'look.palette.levelHint':
    'Цвет идёт вверх по оси и показывает громкость каждой полосы.',
  'look.palette.heat': 'Нагрев',
  'look.palette.heatHint':
    'Цвет следует за громкостью, от холодного к красному.',
  'look.colours': 'Цвета',
  'look.colourValue': 'Цвет {number}: {colour}',
  'look.removeColour': 'Удалить цвет {number}',
  'look.custom': 'Свой',
  'look.customColour': 'Другой цвет',
  'look.reset': 'Сбросить',
  'look.addColour': 'Добавить цвет',
  'look.addColourHint': 'Добавить цвет в конец градиента',
  'look.pieces': 'Части',
  'look.gap': 'Зазор',
  'look.continuous': 'Эта форма рисуется как единая фигура',
  'look.attack': 'Атака',
  'look.release': 'Спад',
  'look.releaseHint': 'Сколько пик держится перед спадом',
  'look.drawnAs': 'Отображение',
  'look.filled': 'Заливка',
  'look.stroked': 'Контур',
  'look.fill': 'Заполнение',
  'look.weight': 'Толщина',
  'look.rainbow': 'Радуга',
  'look.glow': 'Свечение',
  'look.off': 'Выкл.',
  'look.glowHint': 'Насколько фигура увеличивается и светится в такт.',
  'look.glowNeedsRainbow':
    'Нужен режим «Радуга». Без него свечение не меняет рисунок.',
  'look.needsRainbow': 'Нужен режим «Радуга».',
  'look.rainbowBorder': 'Радужная рамка',
  'look.rainbowBorderHint':
    'Обводит график цветом, проходящим через весь спектр.',
  'look.borderWeight': 'Толщина рамки',
  'look.litPeaks': 'Светящиеся пики',
  'look.litPeakWeight': 'Толщина пика',
  'look.peakStyle': 'Метка',
  'look.peak.bead': 'Квадрат',
  'look.peak.cap': 'Полка',
  'look.peak.ring': 'Кольцо',
  'look.peak.spark': 'Искра',
  'look.peak.chevron': 'Шеврон',
  'look.peak.halo': 'Ореол',
  'look.peak.pin': 'Булавка',
  'look.peak.crown': 'Корона',
  'look.peak.cross': 'Крест',
  'look.peak.wave': 'Волна',
  'look.noLitPeaks': 'У этой формы нет светящихся концов',
  'look.name': 'Название',
  'look.resetAll': 'Сбросить все настройки',
  'look.resetAllHint': 'Вернуть исходные настройки этой формы',
  'look.export': 'Экспортировать оформление в файл',
  'look.exportHint': 'Сохранить оформление в файл для обмена',
  'look.import': 'Импортировать оформление из файла',
  'look.delete': 'Удалить это оформление',
  'look.save': 'Сохранить',
  'look.saveHint': 'Сохранить и выбрать это оформление',
  'look.full': 'Список заполнен — удалите оформление, чтобы освободить место',
  'look.error.emptyFile': 'В этом файле не найдено оформлений.',
  'look.error.readFile': 'FluidEQ не удалось прочитать файл оформления.',
  'support.eyebrow': 'СОВЕРШЕННО ДОБРОВОЛЬНО',
  'support.petHint': 'Нажмите пробел, чтобы он подпрыгнул',
  'support.game.hint': 'Нажимайте в такт, когда пик доходит до линии',
  'support.game.howTo':
    'Нажимайте на питомца или пробел на каждый удар. Продолжайте — на ×10 кое-что случится.',
  'support.game.thanks':
    'Если что-то из этого вас порадовало — идеи и поддержка и есть то, что движет проектом.',
  'support.game.noAudio': 'Включите музыку, и ритм появится здесь',
  'support.game.listening': 'Ищем ритм…',
  'support.game.share': 'Поделиться',
  'support.game.shareEuphoria': 'Поделиться радугой',
  'support.game.shareTitle': 'Поделитесь результатом',
  'support.game.shareUnlock':
    'Дойдите до ×10 — и карточка перейдёт в режим радуги, со всем спектром.',
  'support.game.shareNote':
    'Сохраните карточку и прикрепите её к записи: ни одна из этих сетей не может взять изображение из ссылки.',
  'support.game.shareSave': 'Сохранить карточку',
  'support.game.shareCopyCard': 'Копировать карточку',
  'support.game.shareCardCopied': 'Скопировано — вставьте',
  'support.game.shareCopy': 'Копировать текст',
  'support.game.shareCopied': 'Скопировано',
  'support.game.shareLinkOnly':
    'Передаётся только ссылка — текст вставьте сами',
  'support.game.euphoria': 'Режим радуги',
  'support.game.euphoriaToggle': 'Включить или выключить режим радуги',
  'support.game.perfect': 'Идеально',
  'support.game.great': 'Отлично',
  'support.game.good': 'Хорошо',
  'support.game.miss': 'Мимо',
  'support.title': 'Поддержать работу',
  'support.close': 'Закрыть',
  'support.pitch':
    'FluidEQ бесплатен и с открытым исходным кодом — и таким останется: код открыт, вы всегда можете собрать его сами и бесплатно, и здесь ничего не отслеживается. Продаётся подписанная, готовая к запуску сборка. Если он заслужил место в вашей системе, поддержка оплачивает время на его сопровождение и следующие идеи из той же мастерской.',
  'support.craft':
    'Это работа одного человека, сделанная с большой любовью и неразумным вниманием к деталям. Каждая панель нарисована вручную и обдумана: как кривая читается с одного взгляда, как раскрывается меню, что делает ручка, если крутить её медленно, какие слова стоят на кнопке. Здесь нет ни одного готового компонента, на который просто натянули тему.',
  'support.card': 'Карта или кошелёк',
  'support.card.hint':
    'Безопасная оплата через Stripe. Откроется в браузере — приложение никогда не видит данные карты.',
  'support.coffee': 'Купить мне кофе',
  'support.coffee.hint':
    'Разовая благодарность, аккаунт не нужен. Нажмите, чтобы открыть в браузере, или отсканируйте код телефоном.',
  'support.verify': 'Проверьте адрес перед отправкой.',
  'support.copy': 'Скопировать адрес',
  'support.copied': 'Скопировано',
  'support.openWallet': 'Открыть в кошельке',
  'support.contributed': 'Я поддержал — открыть звезду и танец',
  'support.thanks':
    'Спасибо — у питомца появилась звезда, и теперь он танцует.',
  'support.releaseNotes': 'Что нового в этой версии',
  'support.footerBefore':
    'Хотите помочь временем? Issue и pull request так же желанны на',
};

export default look;
