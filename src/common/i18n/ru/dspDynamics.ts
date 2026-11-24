/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export default {
  'dsp.dynamics.key.now': 'Полоса сейчас',
  'dsp.dynamics.key.lifted': 'Поднято',
  'dsp.dynamics.key.held': 'Удержано',
  'dsp.dynamics.untouched': 'Без изменений',
  'dsp.dynamics.dragHint':
    'Перетащите точку: полая — где полоса начинается, закрашенная — насколько сильно.',
  'dsp.dynamics.idleHint':
    'Ничего не играет. Точка каждой полосы пойдёт по своей кривой, как только появится звук.',
  'dsp.dynamics.state.lifting': 'Поднимает',
  'dsp.dynamics.state.holding': 'Удерживает',
  'dsp.dynamics.state.silent': 'Нет звука',
  'dsp.dynamics.bands': 'Полосы',
  'dsp.dynamics.axisIn': 'Вход',
  'dsp.dynamics.axisOut': 'Выход',
  'dsp.dynamics.table.starts': 'Начало',
  'dsp.dynamics.table.atMost': 'Не более',
  'dsp.dynamics.table.liftUnder': 'Подъём ниже',
  'dsp.dynamics.table.holdOver': 'Удержание выше',
  'dsp.dynamics.point.liftStart': 'Где начинается подъём',
  'dsp.dynamics.point.liftTop': 'Насколько идёт подъём',
  'dsp.dynamics.point.liftPull': 'Вытянуть подъём',
  'dsp.dynamics.point.holdStart': 'Где начинается удержание',
  'dsp.dynamics.point.holdEnd': 'Насколько сильно удержание',
  'dsp.dynamics.engineLiveOld':
    'Обновите движок, чтобы видеть работу Dynamics. Звук уже обрабатывается.',
  'dsp.dynamics.title': 'Динамика',
  'dsp.dynamics.description':
    'Поднимает тихое и придерживает громкое в трёх полосах, чтобы шёпот и взрыв встретились посередине. Задержки не добавляет.',
  'dsp.dynamics.engineOld':
    'Для «Динамики» нужен новейший FluidEQ Engine. Остальная часть рэка играет; этот фильтр заработает после обновления движка.',
  'dsp.dynamics.graphLabel': 'Что каждая полоса делает со своим уровнем',
  'dsp.dynamics.band.low': 'Низы',
  'dsp.dynamics.band.lowRange': 'ниже 150 Гц',
  'dsp.dynamics.band.lowHint': 'Ниже 150 Гц: гул взрыва, бочка, мотор.',
  'dsp.dynamics.band.mid': 'Середина',
  'dsp.dynamics.band.midRange': '150 Гц – 4 кГц',
  'dsp.dynamics.band.midHint':
    'От 150 Гц до 4 кГц: голоса, шаги и большая часть звука.',
  'dsp.dynamics.band.high': 'Верха',
  'dsp.dynamics.band.highRange': 'выше 4 кГц',
  'dsp.dynamics.band.highHint': 'Выше 4 кГц: детали, воздух, край шага.',
  'dsp.dynamics.lift': 'Подъём',
  'dsp.dynamics.hold': 'Удержание',
  'dsp.dynamics.upThreshold': 'Ниже',
  'dsp.dynamics.upRatio': 'Соотношение',
  'dsp.dynamics.upMax': 'До',
  'dsp.dynamics.downThreshold': 'Выше',
  'dsp.dynamics.downRatio': 'Соотношение',
  'dsp.dynamics.timing': 'Время и уровень',
  'dsp.dynamics.timingHint':
    'Как быстро приходит удержание и возвращается подъём, и насколько громким получается результат.',
  'dsp.dynamics.attack': 'Атака',
  'dsp.dynamics.release': 'Восстановление',
  'dsp.dynamics.makeup': 'Компенсация',
  'dsp.dynamics.mix': 'Смешивание',
  'dsp.dynamicsPreset.gentle': 'Мягкое выравнивание',
  'dsp.dynamicsPreset.speech': 'Речь',
  'dsp.gamingPreset.quietLift': 'Подъём тихого',
  'dsp.gamingPreset.blastGuard': 'Защита от взрывов',
  'dsp.gamingPreset.longSession': 'Долгая сессия',
  'dsp.gamingPreset.competitiveLight': 'Лёгкий соревновательный',
};
