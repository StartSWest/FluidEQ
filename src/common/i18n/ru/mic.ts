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
  'mic.live': 'Работает во всех приложениях',
  'mic.notSetUp': 'Для этого микрофона ещё не настроено',
  'mic.state.opening': 'Открываем микрофон…',
  'mic.state.noInput': 'Windows сейчас не показывает вход для этого микрофона',
  'mic.state.blocked': 'Windows не дала FluidEQ открыть этот микрофон',
  'mic.state.waiting': 'Микрофон открыт · ждём, пока на нём запустится движок',
  'mic.meter.gateOpen': 'Голос проходит',
  'mic.meter.gateClosed': 'Гейт закрыт',
  'mic.meter.compressor': 'Компрессор',
  'mic.meter.limiter': 'Лимитер',
  'mic.monitor.label': 'Слушать итоговый звук',
  'mic.monitor.hint':
    'Воспроизводит то, что слышат другие, на выход, который вы слушаете',
  'mic.monitor.warning':
    'Используйте наушники: через колонки голос возвращается в микрофон и возникает свист.',
  'mic.effectsOff.short':
    'Улучшения звука Windows выключены для этого микрофона',
  'mic.effectsOff.title': 'Улучшения звука выключены для {mic}',
  'mic.effectsOff.body':
    'Пока они выключены, Windows не применяет к этому микрофону никаких эффектов, и FluidEQ не может его обрабатывать. Включите «Улучшения звука» в свойствах микрофона.',
  'mic.effectsOff.button': 'Открыть параметры звука Windows',
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
  'mic.stage.cleaner': 'Шумоподавление',
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
  'mic.monitor.on': 'Звучит итоговый звук',
  'mic.delay.label': 'Задержка',
  'mic.delay.measured':
    'измерена движком на этом микрофоне, от капсюля до каждого приложения',
  'mic.delay.unknown': 'движок ещё не измерил этот микрофон',
  'mic.delay.windows': 'Windows',
  'mic.rail.master': 'Обработка микрофона',
  'mic.rail.note':
    'Каждый переключатель выключает свою ступень полностью: звук не меняется, задержки нет. Число рядом со ступенью — задержка, которую она добавляет.',
  'mic.meter.noise': 'Убрано шума',
  'mic.cleaner.description':
    'Убирает клавиатуру, вентиляторы и комнату из-под голоса, пока вы говорите.',
  'mic.cleaner.strength': 'Сила',
  'mic.cleaner.noiseNow': 'Убрано шума сейчас',
  'mic.cleaner.noiseHint':
    'Насколько комната ниже голоса после очистки; бледная линия — максимум за последние секунды. Выше 80% голос начинает звучать обработанным.',
  'mic.cleaner.neverCuts': 'Никогда не обрывает',
  'mic.cleaner.neverCutsHint':
    'Если модель опоздает, голос сохраняет уровень последнего очищенного момента и стыкуется без щелчка, а не сырым шумом комнаты. Такие моменты считаются здесь.',
  'mic.cleaner.lateMinute': 'опоздавших блоков за последнюю минуту',
  'mic.gate.live.title': 'Ваш голос и гейт',
  'mic.gate.live.hint':
    'Полоса — ваш голос сейчас. Ниже линии гейт его приглушает; закрывается он чуть ниже, чтобы голос на самой линии не дребезжал.',
  'mic.gate.live.open': 'Открыт — голос на {db} дБ выше гейта.',
  'mic.gate.live.closed': 'Закрыт — голос на {db} дБ ниже гейта.',
  'mic.gate.live.opens': 'открывается на {db} дБ',
};
