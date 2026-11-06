/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The Gaming Lab. See `en/gaming.ts`. */
export default {
  'gaming.tab': 'Игровая лаборатория',
  'gaming.view.games': 'Игры',
  'gaming.view.profiles': 'Игровые профили',
  'gaming.switch': 'Переключать, когда игра на переднем плане',
  'gaming.switch.hint':
    'Если выключено, ваши игры звучат вашим музыкальным звуком и ничего не переключается само.',
  'gaming.add': 'Добавить игру',
  'gaming.list.show': 'Показать названия игр',
  'gaming.list.hide': 'Показать значки игр',
  'gaming.list.resize': 'Изменить размер списка игр',
  'gaming.list.count': 'Ваши игры · {count}',
  'gaming.list.from': 'Из профиля {profile}',
  'gaming.list.tuned': 'настроено',
  'gaming.list.playing': 'Запущена',
  'gaming.empty.title': 'Игр пока нет',
  'gaming.empty.more':
    'Добавьте игру, и у неё будет свой звук, скопированный из игрового профиля, сделанного для неё. Здесь вы настраиваете копию; профиль остаётся прежним.',
  'gaming.game.where': '{source} · на {output}',
  'gaming.profile.label': 'Игровой профиль',
  'gaming.profile.kind.title': 'Для этой игры',
  'gaming.profile.kind.kind': 'По типу',
  'gaming.profile.kind.yours': 'Ваши',
  'gaming.profile.kind.chain': 'Пресет DSP',
  'gaming.profile.gone': 'Профиль, которого больше нет',
  'gaming.profile.pickHint':
    'Выбор другого профиля даёт этой игре его свежую копию.',
  'gaming.save': 'Сохранить как профиль',
  'gaming.save.new': 'Сохранить как новый профиль…',
  'gaming.save.newHint':
    'Попадает в «Ваши», чтобы другие игры могли начинать с него. {game} затем начинает с него.',
  'gaming.save.update': 'Обновить {profile}',
  'gaming.save.updateHint':
    'Ваш профиль принимает эти изменения. Игры, начавшие с него, сохраняют свои копии.',
  'gaming.save.reset': 'Вернуть к {profile}',
  'gaming.save.resetHint':
    'Отбрасывает настройку этой игры и начинает заново с профиля.',
  'gaming.save.rename': 'Переименовать эту копию…',
  'gaming.save.delete': 'Удалить эту копию',
  'gaming.save.deleteHint':
    'Убирает эту игру и её настройку. Профиль остаётся как есть.',
  'gaming.action.unload': 'Выгрузить',
  'gaming.action.unloadHint': 'Ваш музыкальный звук вернётся сейчас.',
  'gaming.action.try': 'Попробовать сейчас',
  'gaming.action.tryHint':
    'Включает сейчас собственный звук {game}, чтобы вы могли его послушать и настроить.',
  'gaming.status.tuned':
    'Копия профиля {profile} для этой игры. Настроено: {parts}. Сам профиль не тронут.',
  'gaming.status.tunedNamed':
    '{copy}: копия профиля {profile} для этой игры. Настроено: {parts}. Сам профиль не тронут.',
  'gaming.status.same':
    'Так же, как в профиле. Всё, что вы меняете здесь, остаётся у этой игры; сам профиль не меняется никогда.',
  'gaming.rail.game': 'Игра',
  'gaming.rail.sound': 'Звук',
  'gaming.rail.dsp': 'DSP',
  'gaming.rail.tuned': 'настроено',
  'gaming.stage.footsteps': 'Фильтр «Игра»',
  'gaming.stage.mainEq': 'EQ',
  'gaming.stage.curve': 'Кривая',
  'gaming.curve.any': 'Любая игра',
  'gaming.editor.notLoaded': 'Собственный звук {game} сейчас не играет',
  'gaming.editor.notLoadedMore':
    'Попробуйте сейчас, чтобы услышать его и настроить прямо здесь. Музыкальный звук вернётся по кнопке «Выгрузить» или когда игра закроется.',
  'gaming.editor.eqNote':
    'Собственные полосы этой игры, нарисованные на графике выше, когда он показан.',
  'gaming.editor.curveNote':
    'Коррекция наушников, которую играет эта игра, из ваших кривых или для наушников, и каждая кривая, применённая вместе с ней, — у каждой свой ×, чтобы её убрать.',
  'gaming.saveDialog.title': 'Сохранить как игровой профиль',
  'gaming.saveDialog.hint':
    'Другие игры смогут начинать с него, в списке игровых профилей.',
  'gaming.saveDialog.placeholder': 'Название профиля',
  'gaming.renameDialog.title': 'Переименовать эту копию',
  'gaming.renameDialog.hint': 'Название получает только копия этой игры.',
  'gaming.renameDialog.placeholder': 'Название копии',
  'gaming.addDialog.title': 'Добавить игру',
  'gaming.addDialog.intro':
    'Выберите игру. Она начинает с игрового профиля и получает свою копию: вы настраиваете копию для этой игры, сам профиль не меняется никогда.',
  'gaming.addDialog.running': 'Запущены сейчас',
  'gaming.addDialog.installed': 'Найдены на этом ПК',
  'gaming.addDialog.startsFrom': 'Начинает с',
  'gaming.addDialog.browse': 'Нет в списке? Найдите программу игры…',
  'gaming.addDialog.later':
    'Другой игровой профиль для неё можно выбрать в любой момент.',
  'gaming.addDialog.add': 'Добавить {game}',
  'gaming.addDialog.cancel': 'Отмена',
  'gaming.addDialog.loading': 'Ищем ваши игры…',
  'gaming.addDialog.none':
    'Ни один из ваших лаунчеров не знает игры, которой здесь ещё нет. Найдите программу игры вручную.',
  'gaming.addDialog.close': 'Закрыть',
  'gaming.profiles.intro':
    'Игра получает свою копию профиля. Вы настраиваете копию; профиль не меняется никогда.',
  'gaming.profiles.search': 'Поиск профилей и игр',
  'gaming.profiles.searchClear': 'Очистить поиск',
  'gaming.profiles.noMatch': 'Нет игровых профилей по запросу «{query}».',
  'gaming.profiles.filterLabel': 'Показать',
  'gaming.profiles.noCurve': 'Без кривой: как игра сведена',
  'gaming.profiles.filter.all': 'Все',
  'gaming.profiles.filter.yours': 'Ваши',
  'gaming.profiles.yours': 'Ваши · сохранены из копии игры',
  'gaming.profiles.yoursEmpty':
    'Пока нет. Настройте игру и нажмите «Сохранить как профиль», чтобы сохранить её звук здесь.',
  'gaming.profiles.readyGroup': 'Готовые · {group}',
  'gaming.profiles.savedFrom': 'Сохранён из копии {game}',
  'gaming.profiles.usedBy': 'С него начинает: {games}',
  'gaming.profiles.use': 'Для игры',
  'gaming.profiles.rename': 'Переименовать',
  'gaming.profiles.delete': 'Удалить',
  'gaming.profiles.confirmDelete': 'Удалить? Игры сохранят свои копии.',
  'gaming.profiles.keep': 'Оставить',
  'gaming.profiles.renameTitle': 'Переименовать игровой профиль',
  'gaming.profiles.renameHint':
    'Игры, начавшие с него, сохраняют свои копии; меняется только название.',
  'gaming.toast.loaded': 'Игровой профиль загружен',
  'gaming.toast.restored': 'Музыкальный профиль восстановлен',
  'gaming.paused.notice': 'Пауза: играет собственный звук {game}',
  'gaming.paused.tune': 'Настроить {game}',
  'gaming.paused.title': 'Ваша музыкальная стойка ждёт',
  'gaming.paused.body':
    'Пока идёт {game}, включён собственный звук игры, а эта стойка на паузе. Она вернётся точно такой, какой была, когда игра закроется, или сейчас по кнопке «Выгрузить».',
  'gaming.paused.stages': '{preset} · что вернётся',
  'gaming.paused.none': 'Все этапы в ней выключены.',
  'gaming.profileSelect.game': '{game} · звук игры',
  'gaming.preset.tuned': '{game} (настроено)',
  'gaming.preset.openHint':
    'Загружен собственный звук {game}. Его пресет меняется в игровой лаборатории.',
  'gaming.now.hint': 'Играет собственный звук {game}. Показать игру.',
} as const;
