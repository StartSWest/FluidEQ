/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Mic tab: each microphone's own sound, played by the FluidEQ Engine on
 * the microphone itself, so every app hears it (Ivan, 2026-11-20).
 */
export default {
  'mic.tab': 'Микрофон',
  'mic.label': 'Микрофон',
  'mic.pickHint': 'Выберите микрофон для настройки',
  'mic.list.heading': 'Микрофоны на этом компьютере',
  'mic.list.on': 'Включён',
  'mic.list.off': 'Не настроен',
  'mic.live': 'Работает во всех приложениях · низкая задержка {ms} мс',
  'mic.notSetUp': 'Для этого микрофона ещё не настроено',
  'mic.picture.label':
    'Ваш голос: бледным — то, что улавливает микрофон, ярким — то, что слышат другие',
  'mic.picture.raw': 'Ваш микрофон',
  'mic.picture.heard': 'Что слышат другие',
  'mic.picture.gate': 'Гейт',
  'mic.profile.label': 'Профиль микрофона',
  'mic.profile.pickHint':
    'Начните с профиля под то, как вы пользуетесь микрофоном',
  'mic.profile.group.use': 'По назначению',
  'mic.profile.group.mic': 'По микрофону',
  'mic.profile.tuned': 'изменён',
  'mic.profile.stream': 'Стриминг',
  'mic.profile.stream.hint':
    'Тёплый, близкий и ровный голос для Twitch и YouTube',
  'mic.profile.podcast': 'Подкаст',
  'mic.profile.podcast.hint': 'Естественный голос с мягким контролем',
  'mic.profile.chat': 'Игровой чат',
  'mic.profile.chat.hint':
    'Чёткий голос на первом плане в Discord и командном чате, тишина между словами',
  'mic.profile.sing': 'Пение',
  'mic.profile.sing.hint':
    'Открытый и воздушный звук без пампинга, каждый вдох сохранён',
  'mic.profile.broadcast': 'Эфир',
  'mic.profile.broadcast.hint': 'Радиоголос: мощный низ, плотный и собранный',
  'mic.profile.noisy': 'Шумная комната',
  'mic.profile.noisy.hint':
    'Вентиляторы, дети, улица: очистка и гейт на максимум',
  'mic.profile.meet': 'Встречи',
  'mic.profile.meet.hint':
    'Teams и Zoom: чёткая речь, а свою очистку они делают сами',
  'mic.profile.laptop': 'Микрофон ноутбука',
  'mic.profile.laptop.hint':
    'Тонкий, далёкий и гулкий звук: срез низких выше, очистка сильнее',
  'mic.profile.headset': 'Микрофон гарнитуры',
  'mic.profile.headset.hint':
    'Маленький капсюль у самого рта: возвращает теплоту, убирает взрывные',
  'mic.reset': 'Сбросить до «{profile}»',
  'mic.setup.title': 'FluidEQ Engine ещё не настроен для {mic}.',
  'mic.setup.body':
    'Windows один раз попросит разрешение. Ваши выходы продолжат звучать, пока идёт настройка.',
  'mic.setup.button': 'Настроить на этом микрофоне',
  'mic.setup.working': 'Настройка…',
  'mic.setup.declined':
    'Windows не дала разрешения, поэтому ничего не изменилось.',
  'mic.setup.failed': 'Не удалось настроить на этом микрофоне.',
  'mic.notFluid.title':
    'Собственный звук микрофона воспроизводит FluidEQ Engine.',
  'mic.notFluid.body':
    'Его звук сохранён и зазвучит, как только будет выбран FluidEQ Engine.',
  'mic.empty.title': 'Микрофон не найден',
  'mic.empty.body':
    'Подключите микрофон или обновите FluidEQ Engine, чтобы он мог их показать.',
  'mic.stage.lowCut': 'Срез низких',
  'mic.stage.cleaner': 'Очистка голоса',
  'mic.stage.gate': 'Гейт',
  'mic.stage.deEsser': 'Де-эссер',
  'mic.stage.eq': 'EQ',
  'mic.stage.compressor': 'Компрессор',
  'mic.stage.limiter': 'Лимитер',
  'mic.lowCut.title': 'Срез низких',
  'mic.lowCut.description':
    'Убирает гул, стук по столу и вентилятор ниже голоса — до того, как их услышит очистка.',
  'mic.lowCut.group.below': 'Ниже голоса',
  'mic.lowCut.group.belowHint':
    '«Эффект близости» убирает лишний бас, который голос набирает в нескольких сантиметрах от капсюля.',
  'mic.lowCut.cut': 'Частота среза',
  'mic.lowCut.proximity': 'Эффект близости',
  'mic.lowCut.group.pops': 'Взрывные',
  'mic.lowCut.group.popsHint':
    'Смягчает удар «П» или «Б» и не трогает ровный голос.',
  'mic.lowCut.plosive': 'Поп-фильтр',
  'mic.gate.title': 'Гейт',
  'mic.gate.description':
    'Закрывает микрофон между словами, чтобы комната, вентилятор и клавиатура не попадали в звук. При небольшой глубине работает как мягкий экспандер.',
  'mic.gate.group.level': 'Когда открывается',
  'mic.gate.group.levelHint':
    'Следите за пунктирной линией на графике: голос должен подниматься выше неё, а шум комнаты — оставаться ниже.',
  'mic.gate.threshold': 'Порог',
  'mic.gate.range': 'Глубина',
  'mic.gate.group.time': 'Скорость',
  'mic.gate.group.timeHint':
    'Удержание не даёт гейту закрыться между слогами, поэтому окончания слов никогда не обрезаются.',
  'mic.gate.attack': 'Открытие',
  'mic.gate.hold': 'Удержание',
  'mic.gate.release': 'Закрытие',
};
