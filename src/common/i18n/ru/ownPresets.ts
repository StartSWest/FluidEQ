/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The listener's own presets. See `en/ownPresets.ts`. */
export default {
  'eq.own.new': 'Новый пресет',
  'eq.own.newHint': 'Своя кривая и свой рэк',
  'eq.own.dialogHint':
    'Кривая для основного эквалайзера и рэк для страницы DSP, сохранённые под вашим именем.',
  'eq.own.name': 'Название',
  'eq.own.defaultName': 'Мой пресет',
  'eq.own.defaultFrom': 'Мой {name}',
  'eq.own.curveFrom': 'Кривая начинается с',
  'eq.own.curveFromHint': 'Затем вы её настроите',
  'eq.own.fromPlaying': '{name}, играет',
  'eq.own.flat': 'Ровная',
  'eq.own.rackFrom': 'Рэк начинается с',
  'eq.own.rackOf': 'Рэк пресета «{name}»',
  'eq.own.rackNow': 'Текущая страница DSP',
  'eq.own.rackEmpty': 'Пустой',
  'eq.own.create': 'Создать и настроить кривую',
  'eq.own.editing': 'Редактирование',
  'eq.own.parts': 'Части пресета',
  'eq.own.curve': 'Кривая',
  'eq.own.rack': 'Рэк',
  'eq.own.unsaved': 'Не сохранено',
  'eq.own.discard': 'Отменить',
  'eq.own.save': 'Сохранить пресет',
  'eq.own.addBand': 'Добавить полосу',
  'eq.own.curveBands': 'Полосы кривой «{name}»',
  'eq.own.edit': 'Изменить',
  'eq.own.editCopy': 'Изменить копию',
  'eq.own.copyName': '{name} (копия)',
  'eq.own.more': 'Ещё для «{name}»',
  'eq.own.renameLabel': 'Новое название для «{name}»',
  'eq.own.about':
    'Ваш собственный пресет. Его кривая звучит в основном эквалайзере, а рэк — на странице DSP.',
  'eq.own.deleteAsk':
    'Удалить «{name}»? Он исчезнет из раздела «Свои». Если он играет, его кривая и рэк остановятся.',
  'eq.own.keep': 'Оставить',
  'eq.own.emptyTitle': 'Своих пресетов пока нет',
  'eq.own.emptyHint':
    '«Новый пресет» создаёт его: кривую для основного эквалайзера и рэк для страницы DSP.',
} as const;
